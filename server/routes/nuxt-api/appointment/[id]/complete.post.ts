// 商家標記預約完成：將 CONFIRMED → COMPLETED，需 startAt 已過
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';
import {
  MSG_APPOINTMENT_NOT_CONFIRMED,
  MSG_APPOINTMENT_NOT_FOUND,
  checkAppointmentTransitionable
} from '@@/utils/booking';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id');
  if (!id) return badRequestError(event);

  const appointment = await prisma.appointment.findFirst({
    where: { id, merchantId: auth.merchantId },
    select: { merchantId: true, status: true, startAt: true }
  });
  const check = checkAppointmentTransitionable(appointment, auth.merchantId);
  if (!check.ok) {
    if (check.kind === 'not_found') return notFoundError(event, MSG_APPOINTMENT_NOT_FOUND);
    return badRequestError(event, check.message);
  }

  const result = await prisma.appointment.updateMany({
    where: { id, merchantId: auth.merchantId, status: 'CONFIRMED' },
    data: { status: 'COMPLETED' }
  });
  if (result.count === 0) return badRequestError(event, MSG_APPOINTMENT_NOT_CONFIRMED);

  return successResponse({ id, status: 'COMPLETED' as const });
});
