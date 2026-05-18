// 顧客取消預約（無 token，需三元組驗證，受 cancelPolicy 限制）
import { defineEventHandler, readBody, getRouterParam, getRequestIP, setResponseHeader } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import {
  badRequestError,
  notFoundError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import {
  MSG_APPOINTMENT_ALREADY_CANCELED,
  MSG_APPOINTMENT_NOT_FOUND,
  checkCancelCutoff,
  isValidPhone,
  normalizePhone,
  parseCancelPolicy
} from '@@/utils/booking';

const BodySchema = z.object({
  lastName: z.string().min(1).max(20),
  title: z.enum(['MR', 'MRS', 'MISS', 'MX']),
  phone: z.string().min(6).max(20)
});

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const rl = await checkRateLimit(`cancel-ip:${ip}`, 10, 60);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', String(rl.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const id = getRouterParam(event, 'id');
  if (!id) return badRequestError(event);

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);
  if (!isValidPhone(parsed.data.phone)) return badRequestError(event);

  const phone = normalizePhone(parsed.data.phone);
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      customerLastName: parsed.data.lastName,
      customerTitle: parsed.data.title,
      customerPhone: phone
    },
    include: { merchant: { select: { cancelPolicy: true } } }
  });
  if (!appointment) return notFoundError(event, MSG_APPOINTMENT_NOT_FOUND);
  if (appointment.status !== 'CONFIRMED') {
    return badRequestError(event, MSG_APPOINTMENT_ALREADY_CANCELED);
  }

  const policy = parseCancelPolicy(appointment.merchant.cancelPolicy);
  const blocked = checkCancelCutoff(policy, appointment.startAt);
  if (blocked) return badRequestError(event, blocked);

  await prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELED',
      canceledBy: 'CUSTOMER',
      canceledAt: new Date()
    }
  });

  return successResponse({ id });
});
