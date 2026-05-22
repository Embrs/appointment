// 商家：讀取某 QUEUE 服務的整週領號時間窗
// 規範：requireMerchant；只回該商家擁有的服務
import { defineEventHandler, getQuery } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';
import { MSG_NOT_QUEUE_SERVICE } from '@@/utils/queue';

const QuerySchema = z.object({
  serviceId: z.string().min(1)
});

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;

  const parsed = QuerySchema.safeParse(getQuery(event));
  if (!parsed.success) return badRequestError(event);

  const service = await prisma.service.findFirst({
    where: {
      id: parsed.data.serviceId,
      merchantId: auth.merchantId,
      deletedAt: null
    },
    select: { id: true, bookingMode: true }
  });
  if (!service) return notFoundError(event);
  if (service.bookingMode !== 'QUEUE') return badRequestError(event, MSG_NOT_QUEUE_SERVICE);

  const windows = await prisma.queueWindow.findMany({
    where: { merchantId: auth.merchantId, serviceId: service.id },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    select: { weekday: true, startTime: true, endTime: true, maxTickets: true, isActive: true }
  });

  return successResponse({ windows });
});
