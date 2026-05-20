// 商家：整批覆寫某 QUEUE 服務的整週領號時間窗
// 規範：requireMerchant；事務內 deleteMany → createMany；空陣列 = 全清除
import { defineEventHandler, readBody } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';
import { MSG_NOT_QUEUE_SERVICE } from '@@/utils/queue';
import { QueueWindowPutBodySchema } from '@@/utils/queue-window-schema';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;

  const raw = await readBody(event).catch(() => null);
  const parsed = QueueWindowPutBodySchema.safeParse(raw);
  if (!parsed.success) return badRequestError(event);
  const { serviceId, windows } = parsed.data;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, merchantId: auth.merchantId, deletedAt: null },
    select: { id: true, bookingMode: true }
  });
  if (!service) return notFoundError(event);
  if (service.bookingMode !== 'QUEUE') return badRequestError(event, MSG_NOT_QUEUE_SERVICE);

  await prisma.$transaction(async (tx) => {
    await tx.queueWindow.deleteMany({
      where: { merchantId: auth.merchantId!, serviceId: service.id }
    });
    if (windows.length > 0) {
      await tx.queueWindow.createMany({
        data: windows.map((w) => ({
          merchantId: auth.merchantId!,
          serviceId: service.id,
          weekday: w.weekday,
          startTime: w.startTime,
          endTime: w.endTime,
          maxTickets: w.maxTickets,
          isActive: w.isActive
        }))
      });
    }
  });

  const next = await prisma.queueWindow.findMany({
    where: { merchantId: auth.merchantId, serviceId: service.id },
    orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    select: { weekday: true, startTime: true, endTime: true, maxTickets: true, isActive: true }
  });

  return successResponse({ windows: next });
});
