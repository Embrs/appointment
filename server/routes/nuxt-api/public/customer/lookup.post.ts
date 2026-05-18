// 顧客多商家彙整查詢（無 token，rate limit + slug 列表）
import { defineEventHandler, readBody, getRequestIP, setResponseHeader } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import {
  badRequestError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import { isValidPhone, normalizePhone, parseCancelPolicy } from '@@/utils/booking';

const BodySchema = z.object({
  lastName: z.string().min(1).max(20),
  title: z.enum(['MR', 'MRS', 'MISS', 'MX']),
  phone: z.string().min(6).max(20),
  /** 當前 session 用過的商家 slug 列表 */
  slugs: z.array(z.string().min(1).max(64)).min(1).max(50)
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

  const merchants = await prisma.merchant.findMany({
    where: { slug: { in: parsed.data.slugs }, status: 'ACTIVE', deletedAt: null },
    select: { id: true, slug: true, name: true, timezone: true, cancelPolicy: true, logoUrl: true }
  });
  if (merchants.length === 0) return successResponse({ groups: [] });

  const merchantIds = merchants.map((m) => m.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const phone = normalizePhone(parsed.data.phone);

  const appointments = await prisma.appointment.findMany({
    where: {
      merchantId: { in: merchantIds },
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
      resource: { select: { id: true, name: true } }
    }
  });

  const byMerchant = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const list = byMerchant.get(a.merchantId) ?? [];
    list.push(a);
    byMerchant.set(a.merchantId, list);
  }

  const groups = merchants.map((m) => ({
    merchant: {
      slug: m.slug,
      name: m.name,
      timezone: m.timezone,
      logoUrl: m.logoUrl,
      cancelPolicy: parseCancelPolicy(m.cancelPolicy)
    },
    appointments: (byMerchant.get(m.id) ?? []).map((a) => ({
      id: a.id,
      mode: a.mode,
      status: a.status,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      service: { id: a.service.id, name: a.service.name },
      resource: a.resource ? { id: a.resource.id, name: a.resource.name } : null,
      note: a.note,
      cancelReason: a.cancelReason,
      canceledBy: a.canceledBy,
      canceledAt: a.canceledAt ? a.canceledAt.toISOString() : null
    }))
  })).filter((g) => g.appointments.length > 0);

  return successResponse({ groups });
});
