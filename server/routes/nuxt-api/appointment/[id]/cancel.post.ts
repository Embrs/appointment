// 商家取消預約（可填 reason，標 canceledBy=MERCHANT，不受 cancelPolicy 限制）
import { defineEventHandler, readBody, getRouterParam } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';
import { MSG_APPOINTMENT_ALREADY_CANCELED, MSG_APPOINTMENT_NOT_FOUND } from '@@/utils/booking';

const BodySchema = z.object({
  reason: z.string().max(200).optional()
});

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id');
  if (!id) return badRequestError(event);

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);

  const appointment = await prisma.appointment.findFirst({
    where: { id, merchantId: auth.merchantId }
  });
  if (!appointment) return notFoundError(event, MSG_APPOINTMENT_NOT_FOUND);
  if (appointment.status !== 'CONFIRMED') {
    return badRequestError(event, MSG_APPOINTMENT_ALREADY_CANCELED);
  }

  await prisma.appointment.update({
    where: { id },
    data: {
      status: 'CANCELED',
      canceledBy: 'MERCHANT',
      cancelReason: parsed.data.reason ?? null,
      canceledAt: new Date()
    }
  });

  return successResponse({ id });
});
