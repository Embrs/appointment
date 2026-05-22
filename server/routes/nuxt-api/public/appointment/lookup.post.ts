// 顧客三元組查詢預約（無 token，rate limit 防爆破）
import { defineEventHandler, readBody, getRequestIP, setResponseHeader } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import {
  badRequestError,
  notFoundError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import { isValidPhone, normalizePhone, parseCancelPolicy } from '@@/utils/booking';

const BodySchema = z.object({
  slug: z.string().min(1).max(64),
  lastName: z.string().min(1).max(20),
  title: z.enum(['MR', 'MRS', 'MISS', 'MX']),
  phone: z.string().min(6).max(20),
  /** 是否包含已取消 */
  includeCanceled: z.boolean().optional()
});

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const rl = await checkRateLimit(`lookup-ip:${ip}`, 10, 60);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', String(rl.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);
  if (!isValidPhone(parsed.data.phone)) return badRequestError(event);

  const merchant = await prisma.merchant.findFirst({
    where: { slug: parsed.data.slug, status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true, slug: true, timezone: true, cancelPolicy: true }
  });
  if (!merchant) return notFoundError(event);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const phone = normalizePhone(parsed.data.phone);

  const appointments = await prisma.appointment.findMany({
    where: {
      merchantId: merchant.id,
      customerPhone: phone,
      customerLastName: parsed.data.lastName,
      customerTitle: parsed.data.title,
      OR: [
        { startAt: { gt: sevenDaysAgo } },
        { status: 'CONFIRMED' }
      ]
    },
    orderBy: { startAt: 'desc' },
    include: {
      service: { select: { id: true, name: true } },
      resource: { select: { id: true, name: true } },
      provider: { select: { id: true, name: true, isActive: true, deletedAt: true } }
    }
  });

  return successResponse({
    merchant: {
      slug: merchant.slug,
      name: merchant.name,
      timezone: merchant.timezone,
      cancelPolicy: parseCancelPolicy(merchant.cancelPolicy)
    },
    appointments: appointments.map((a) => ({
      id: a.id,
      mode: a.mode,
      status: a.status,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      service: { id: a.service.id, name: a.service.name },
      resource: a.resource ? { id: a.resource.id, name: a.resource.name } : null,
      provider: a.provider
        ? {
            id: a.provider.id,
            name: a.provider.name,
            isActive: a.provider.isActive && a.provider.deletedAt === null
          }
        : null,
      note: a.note,
      cancelReason: a.cancelReason,
      canceledBy: a.canceledBy,
      canceledAt: a.canceledAt ? a.canceledAt.toISOString() : null
    }))
  });
});
