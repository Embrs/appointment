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
  getEffectiveAvgServiceMinutes
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
      cancelPolicy: true
    }
  });
  if (!merchant) return notFoundError(event);

  const services = await prisma.service.findMany({
    where: { merchantId: merchant.id, isActive: true, deletedAt: null },
    include: { resources: { select: { resourceId: true } } },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });

  const resources = await prisma.resource.findMany({
    where: { merchantId: merchant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, description: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }]
  });

  // 取所有 QUEUE 服務的當日 counter，供領號頁顯示「目前叫到 N 號 / 等待 M 人」
  const queueServiceIds = services.filter((s) => s.bookingMode === 'QUEUE').map((s) => s.id);
  const counterMap = new Map<string, { lastCalledNumber: number; lastTicketNumber: number }>();
  if (queueServiceIds.length > 0) {
    const ticketDate = getTicketDate(merchant.timezone);
    const counters = await prisma.queueCounter.findMany({
      where: {
        merchantId: merchant.id,
        counterDate: ticketDate,
        serviceId: { in: queueServiceIds }
      },
      select: { serviceId: true, lastCalledNumber: true, lastTicketNumber: true }
    });
    for (const c of counters) {
      counterMap.set(c.serviceId, {
        lastCalledNumber: c.lastCalledNumber,
        lastTicketNumber: c.lastTicketNumber
      });
    }
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
      cancelPolicy: sanitizeCancelPolicy(merchant.cancelPolicy)
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
        resourceIds:
          s.bookingMode === 'RESOURCE' || s.bookingMode === 'RESOURCE_OPTIONAL'
            ? s.resources.map((r) => r.resourceId)
            : []
      };
      if (s.bookingMode !== 'QUEUE') return base;
      const counter = counterMap.get(s.id) ?? null;
      const serving = projectQueueServingPublic(counter);
      const estimatedNextCallMinutes = computeNextWaitMinutes(
        counter,
        serving.ticketsTaken,
        { avgServiceMinutes: s.avgServiceMinutes, durationMinutes: s.durationMinutes }
      );
      const avgServiceMinutes = getEffectiveAvgServiceMinutes({
        avgServiceMinutes: s.avgServiceMinutes,
        durationMinutes: s.durationMinutes
      });
      return { ...base, ...serving, estimatedNextCallMinutes, avgServiceMinutes };
    }),
    resources
  });
});
