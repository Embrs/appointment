// 公開商家資訊（不需 token，套 IP rate limit 5/秒）
import { defineEventHandler, getRouterParam, getRequestIP, setResponseHeader } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { badRequestError, notFoundError, successResponse, tooManyRequestsError } from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import {
  getTicketDate,
  projectQueueServingPublic,
  computeNextWaitMinutes,
  getEffectiveAvgServiceMinutes,
  getResourcesForQueueService,
  resolveProviderByResourceMap,
  getResourceProviderEntry,
  type ResourceProviderMap
} from '@@/utils/queue';

const SlugSchema = z.string().min(1).max(64).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i);

interface CancelPolicyShape {
  mode?: unknown;
  hoursBeforeCannotCancel?: unknown;
}

/** 只回白名單欄位避免洩漏內部 key */
const sanitizeCancelPolicy = (value: unknown) => {
  const policy = (value ?? {}) as CancelPolicyShape;
  const mode = policy.mode === 'cutoff' ? 'cutoff' : 'free';
  const out: { mode: 'free' | 'cutoff'; hoursBeforeCannotCancel?: number } = { mode };
  if (mode === 'cutoff' && typeof policy.hoursBeforeCannotCancel === 'number') {
    out.hoursBeforeCannotCancel = policy.hoursBeforeCannotCancel;
  }
  return out;
};

export default defineEventHandler(async (event) => {
  // rate limit
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const rl = await checkRateLimit(`public-merchant:${ip}`, 5, 1);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', String(rl.retryAfterSeconds ?? 1));
    return tooManyRequestsError(event);
  }

  // 驗 slug
  const rawSlug = getRouterParam(event, 'slug');
  const parsed = SlugSchema.safeParse(rawSlug);
  if (!parsed.success) return badRequestError(event);
  const slug = parsed.data;

  const merchant = await prisma.merchant.findFirst({
    where: { slug, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      logoUrl: true,
      coverUrl: true,
      timezone: true,
      address: true,
      contactPhone: true,
      contactEmail: true,
      cancelPolicy: true,
      providerModeEnabled: true,
      providerLabel: true
    }
  });
  if (!merchant) return notFoundError(event);

  const services = await prisma.service.findMany({
    where: { merchantId: merchant.id, isActive: true, deletedAt: null },
    include: {
      resources: { select: { resourceId: true } },
      providers: { select: { providerId: true } }
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });

  const resources = await prisma.resource.findMany({
    where: { merchantId: merchant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, description: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });

  // 取所有 QUEUE 服務的當日 counter（按 serviceId + resourceId 兩層）供領號頁／大螢幕顯示
  const queueServiceIds = services.filter((s) => s.bookingMode === 'QUEUE').map((s) => s.id);
  type CounterSnapshot = { lastCalledNumber: number; lastTicketNumber: number };
  const counterMap = new Map<string, CounterSnapshot>();
  const counterKey = (serviceId: string, resourceId: string | null) =>
    `${serviceId}::${resourceId ?? 'null'}`;
  const queueResourcesByService = new Map<string, Awaited<ReturnType<typeof getResourcesForQueueService>>>();
  let providerMap: ResourceProviderMap = new Map();
  if (queueServiceIds.length > 0) {
    const ticketDate = getTicketDate(merchant.timezone);
    const counters = await prisma.queueCounter.findMany({
      where: {
        merchantId: merchant.id,
        counterDate: ticketDate,
        serviceId: { in: queueServiceIds }
      },
      select: {
        serviceId: true,
        resourceId: true,
        lastCalledNumber: true,
        lastTicketNumber: true
      }
    });
    for (const c of counters) {
      counterMap.set(counterKey(c.serviceId, c.resourceId), {
        lastCalledNumber: c.lastCalledNumber,
        lastTicketNumber: c.lastTicketNumber
      });
    }
    // 載入每個 QUEUE service 綁定的 active resources + schedule → provider 反查
    await Promise.all([
      ...queueServiceIds.map(async (sid) => {
        queueResourcesByService.set(sid, await getResourcesForQueueService(sid));
      }),
      resolveProviderByResourceMap(merchant.id).then((m) => {
        providerMap = m;
      })
    ]);
  }

  return successResponse({
    merchant: {
      id: merchant.id,
      slug: merchant.slug,
      name: merchant.name,
      description: merchant.description,
      logoUrl: merchant.logoUrl,
      coverUrl: merchant.coverUrl,
      timezone: merchant.timezone,
      address: merchant.address,
      contactPhone: merchant.contactPhone,
      contactEmail: merchant.contactEmail,
      cancelPolicy: sanitizeCancelPolicy(merchant.cancelPolicy),
      providerModeEnabled: merchant.providerModeEnabled,
      providerLabel: merchant.providerLabel
    },
    services: services.map((s) => {
      const base = {
        id: s.id,
        name: s.name,
        description: s.description,
        bookingMode: s.bookingMode,
        durationMinutes: s.durationMinutes,
        slotIntervalMinutes: s.slotIntervalMinutes,
        capacityPerSlot: s.capacityPerSlot,
        priceCents: s.priceCents,
        requiresProvider: s.requiresProvider,
        providerIds: s.providers.map((p) => p.providerId),
        resourceIds:
          s.bookingMode === 'RESOURCE' || s.bookingMode === 'RESOURCE_OPTIONAL'
            ? s.resources.map((r) => r.resourceId)
            : []
      };
      if (s.bookingMode !== 'QUEUE') return base;
      const serviceForEta = { avgServiceMinutes: s.avgServiceMinutes, durationMinutes: s.durationMinutes };
      const avgServiceMinutes = getEffectiveAvgServiceMinutes(serviceForEta);
      const bound = queueResourcesByService.get(s.id) ?? [];

      // resources 陣列：綁了 → 每個 resource 一項；未綁 → 單元素 null
      type ResourceSlot = { id: string | null; name: string | null; displayOrder: number | null };
      const slots: ResourceSlot[] =
        bound.length > 0
          ? bound.map((r) => ({ id: r.id, name: r.name, displayOrder: r.displayOrder }))
          : [{ id: null, name: null, displayOrder: null }];

      const resourceStats = slots.map((slot) => {
        const counter = counterMap.get(counterKey(s.id, slot.id)) ?? null;
        const serving = projectQueueServingPublic(counter);
        const estimatedNextCallMinutes = computeNextWaitMinutes(
          counter,
          serving.ticketsTaken,
          serviceForEta
        );
        const providerEntry = getResourceProviderEntry(providerMap, slot.id);
        return {
          id: slot.id,
          name: slot.name,
          displayOrder: slot.displayOrder,
          ...serving,
          avgServiceMinutes,
          estimatedNextCallMinutes,
          provider: providerEntry
            ? { id: providerEntry.providerId, name: providerEntry.providerName }
            : null,
          hasCounter: counter !== null
        };
      });

      // 頂層合計（向後相容；綁多 resource 時取合計／代表值）
      let topServing;
      let topEta: number | null;
      if (resourceStats.length === 1) {
        const only = resourceStats[0];
        topServing = {
          currentServing: only.currentServing,
          ticketsTaken: only.ticketsTaken,
          waitingCount: only.waitingCount
        };
        topEta = only.estimatedNextCallMinutes;
      } else {
        const ticketsTaken = resourceStats.reduce((acc, r) => acc + r.ticketsTaken, 0);
        const waitingCount = resourceStats.reduce((acc, r) => acc + r.waitingCount, 0);
        const activeCalled = resourceStats
          .filter((r) => r.waitingCount > 0)
          .map((r) => r.currentServing);
        const currentServing = activeCalled.length > 0 ? Math.min(...activeCalled) : 0;
        topServing = { currentServing, ticketsTaken, waitingCount };
        const nonNullEta = resourceStats
          .filter((r) => r.estimatedNextCallMinutes !== null)
          .map((r) => r.estimatedNextCallMinutes as number);
        topEta = nonNullEta.length > 0 ? Math.min(...nonNullEta) : null;
      }

      return {
        ...base,
        ...topServing,
        estimatedNextCallMinutes: topEta,
        avgServiceMinutes,
        resources: resourceStats.map(({ hasCounter: _hasCounter, ...rest }) => rest)
      };
    }),
    resources
  });
});
