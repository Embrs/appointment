// 商家修改既有預約：改 startAt / resourceId；force=true 允許過去時段並跳過班表檢查（仍阻擋雙開）
import { defineEventHandler, readBody, getRouterParam } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';
import { rescheduleAppointment } from '@@/utils/booking';

const BodySchema = z.object({
  startAt: z.string().min(1),
  resourceId: z.string().min(1).nullable().optional(),
  force: z.boolean().optional()
});

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const id = getRouterParam(event, 'id');
  if (!id) return badRequestError(event);

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);

  const result = await rescheduleAppointment({
    event,
    merchantId: auth.merchantId!,
    appointmentId: id,
    startAtIso: parsed.data.startAt,
    resourceId: parsed.data.resourceId,
    force: parsed.data.force
  });
  if (!result.ok) return result.response;

  // 回傳更新後的 appointment（與 GetAppointmentList item 對齊）
  const appt = await prisma.appointment.findUnique({
    where: { id: result.appointment.id },
    include: {
      service: { select: { id: true, name: true, bookingMode: true, durationMinutes: true } },
      resource: { select: { id: true, name: true } }
    }
  });
  if (!appt) return badRequestError(event);

  return successResponse({
    appointment: {
      id: appt.id,
      mode: appt.mode,
      status: appt.status,
      startAt: appt.startAt.toISOString(),
      endAt: appt.endAt.toISOString(),
      service: {
        id: appt.service.id,
        name: appt.service.name,
        bookingMode: appt.service.bookingMode,
        durationMinutes: appt.service.durationMinutes
      },
      resource: appt.resource ? { id: appt.resource.id, name: appt.resource.name } : null,
      customerLastName: appt.customerLastName,
      customerTitle: appt.customerTitle,
      customerPhone: appt.customerPhone,
      note: appt.note,
      cancelReason: appt.cancelReason,
      canceledBy: appt.canceledBy,
      canceledAt: appt.canceledAt ? appt.canceledAt.toISOString() : null,
      createdAt: appt.createdAt.toISOString()
    }
  });
});
