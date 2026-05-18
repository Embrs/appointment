// 商家代客建立預約（同並發鎖，但不檢查 cancelPolicy；不限 customer 三元組唯一性）
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, successResponse } from '@@/utils/response';
import { createAppointment, isValidPhone } from '@@/utils/booking';

const BodySchema = z.object({
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
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);
  if (!isValidPhone(parsed.data.customer.phone)) return badRequestError(event);

  const result = await createAppointment({
    event,
    merchantId: auth.merchantId!,
    serviceId: parsed.data.serviceId,
    resourceId: parsed.data.resourceId,
    startAtIso: parsed.data.startAt,
    customer: parsed.data.customer,
    note: parsed.data.note,
    byMerchant: true
  });
  if (!result.ok) return result.response;

  return successResponse({
    id: result.appointment.id,
    startAt: result.appointment.startAt.toISOString(),
    endAt: result.appointment.endAt.toISOString()
  });
});
