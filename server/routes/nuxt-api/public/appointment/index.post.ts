// 顧客建立預約（無 token，rate limit + advisory lock）
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
import { createAppointment, isValidPhone, normalizePhone } from '@@/utils/booking';

const BodySchema = z.object({
  slug: z.string().min(1).max(64),
  serviceId: z.string().min(1),
  resourceId: z.string().min(1).optional(),
  startAt: z.string().min(1),
  customer: z.object({
    lastName: z.string().min(1).max(20),
    title: z.enum(['MR', 'MRS', 'MISS', 'MX']),
    phone: z.string().min(6).max(20)
  }),
  note: z.string().max(200).optional()
});

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';

  // 雙鎖：IP + phone
  const rlIp = await checkRateLimit(`book-ip:${ip}`, 20, 60);
  if (!rlIp.ok) {
    setResponseHeader(event, 'Retry-After', String(rlIp.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);

  if (!isValidPhone(parsed.data.customer.phone)) {
    return badRequestError(event);
  }

  const rlPhone = await checkRateLimit(`book-phone:${normalizePhone(parsed.data.customer.phone)}`, 5, 60);
  if (!rlPhone.ok) {
    setResponseHeader(event, 'Retry-After', String(rlPhone.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const merchant = await prisma.merchant.findFirst({
    where: { slug: parsed.data.slug, status: 'ACTIVE', deletedAt: null },
    select: { id: true }
  });
  if (!merchant) return notFoundError(event);

  const result = await createAppointment({
    event,
    merchantId: merchant.id,
    serviceId: parsed.data.serviceId,
    resourceId: parsed.data.resourceId,
    startAtIso: parsed.data.startAt,
    customer: parsed.data.customer,
    note: parsed.data.note
  });

  if (!result.ok) return result.response;

  return successResponse({
    id: result.appointment.id,
    startAt: result.appointment.startAt.toISOString(),
    endAt: result.appointment.endAt.toISOString()
  });
});
