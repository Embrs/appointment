// 公開商家資訊（不需 token，套 IP rate limit 5/秒）
import { defineEventHandler, getRouterParam, getRequestIP, setResponseHeader } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { badRequestError, notFoundError, successResponse, tooManyRequestsError } from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';

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

  return successResponse({
    merchant: {
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
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      bookingMode: s.bookingMode,
      durationMinutes: s.durationMinutes,
      slotIntervalMinutes: s.slotIntervalMinutes,
      capacityPerSlot: s.capacityPerSlot,
      priceCents: s.priceCents,
      resourceIds: s.bookingMode === 'RESOURCE' ? s.resources.map((r) => r.resourceId) : []
    })),
    resources
  });
});
