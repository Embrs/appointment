// 商家現場代客領號（requireMerchant；跳過 QueueWindow 時間窗校驗；phone 可選）
// 與公開端 take.post.ts 共用 internalCreateTicket，確保 Counter 序列化只有一份實作
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  conflictError,
  notFoundError,
  successResponse
} from '@@/utils/response';
import { isValidPhone, normalizePhone } from '@@/utils/booking';
import {
  MSG_NOT_QUEUE_SERVICE,
  MSG_QUEUE_ALREADY_TAKEN,
  MSG_QUEUE_FULL,
  MSG_QUEUE_RESOURCE_INVALID,
  MSG_QUEUE_RESOURCE_REQUIRED,
  MSG_QUEUE_WINDOW_CLOSED,
  broadcastQueue,
  buildBroadcastEtaFields,
  getTicketDate,
  getTicketWeekday,
  internalCreateTicket,
  validateResourceIdForQueueService,
  resolveProviderByResourceMap,
  getResourceProviderEntry
} from '@@/utils/queue';

export const BodySchema = z.object({
  serviceId: z.string().min(1),
  resourceId: z.string().min(1).optional(),
  customer: z.object({
    lastName: z.string().min(1).max(20),
    title: z.enum(['MR', 'MRS', 'MISS', 'MX']),
    /** 商家代建可省略；提供時格式仍須合法 */
    phone: z.string().min(6).max(20).optional()
  })
});

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
  if ('status' in auth) return auth;
  const merchantId = auth.merchantId!;

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);

  // phone 提供時須合法（normalize 後 6–20 位數字 / +）
  const rawPhone = parsed.data.customer.phone;
  if (rawPhone !== undefined && !isValidPhone(rawPhone)) return badRequestError(event);
  const phone = rawPhone !== undefined ? normalizePhone(rawPhone) : null;

  // 1. 取服務並校驗 ownership 與 bookingMode=QUEUE
  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, merchantId, deletedAt: null },
    select: {
      id: true,
      bookingMode: true,
      name: true,
      avgServiceMinutes: true,
      durationMinutes: true
    }
  });
  if (!service) return notFoundError(event);
  if (service.bookingMode !== 'QUEUE') return badRequestError(event, MSG_NOT_QUEUE_SERVICE);

  // 1.5 驗 resourceId（service 已綁 resources 時必填）
  const rv = await validateResourceIdForQueueService(service.id, parsed.data.resourceId);
  if (!rv.ok) {
    return badRequestError(
      event,
      rv.code === 'REQUIRED' ? MSG_QUEUE_RESOURCE_REQUIRED : MSG_QUEUE_RESOURCE_INVALID
    );
  }
  const resource = rv.resource;

  // 2. 取商家 timezone
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { timezone: true }
  });
  const tz = merchant?.timezone ?? 'Asia/Taipei';
  const now = new Date();
  const ticketDate = getTicketDate(tz, now);

  // 3. 校驗該 service 至少存在一筆 QueueWindow 設定
  //    （區別於公開端：不檢查「在區間內」；但若整個服務的 QueueWindow 為空陣列，視為商家明確關閉此服務的號碼牌）
  const windowsAny = await prisma.queueWindow.count({
    where: { merchantId, serviceId: service.id }
  });
  if (windowsAny === 0) return badRequestError(event, MSG_QUEUE_WINDOW_CLOSED);

  // 4. 取今日 weekday 的當班 window 拿 maxTickets（找不到啟用中的視為不限）
  const weekday = getTicketWeekday(tz, now);
  const todayWindow = await prisma.queueWindow.findFirst({
    where: { merchantId, serviceId: service.id, weekday, isActive: true },
    select: { maxTickets: true }
  });
  const maxTickets = todayWindow?.maxTickets ?? 0;

  // 5. 委派共用拿號核心
  try {
    const result = await internalCreateTicket({
      merchantId,
      serviceId: service.id,
      resourceId: resource?.id ?? null,
      ticketDate,
      customer: {
        lastName: parsed.data.customer.lastName,
        title: parsed.data.customer.title,
        phone
      },
      createdByMerchant: true,
      maxTickets
    });

    if (!result.ok) {
      if (result.reason === 'ALREADY_TAKEN') return conflictError(event, MSG_QUEUE_ALREADY_TAKEN);
      return conflictError(event, MSG_QUEUE_FULL);
    }

    // 廣播 TICKET_TAKEN（讓 admin/queue.vue、display 頁、其他商家 tab 即時更新，按 resource 分群）
    const etaFields = buildBroadcastEtaFields(
      { lastCalledNumber: result.currentServing },
      result.ticket.ticketNumber,
      { avgServiceMinutes: service.avgServiceMinutes, durationMinutes: service.durationMinutes }
    );
    const providerMap = await resolveProviderByResourceMap(merchantId);
    const providerEntry = getResourceProviderEntry(providerMap, result.ticket.resourceId);
    broadcastQueue(merchantId, {
      type: 'TICKET_TAKEN',
      serviceId: service.id,
      resourceId: result.ticket.resourceId,
      resourceName: resource?.name,
      ticketNumber: result.ticket.ticketNumber,
      servingTicketId: result.ticket.id,
      ...etaFields,
      providerId: providerEntry?.providerId ?? null,
      providerName: providerEntry?.providerName ?? null,
      timestamp: Date.now()
    });

    return successResponse({
      ticketId: result.ticket.id,
      ticketNumber: result.ticket.ticketNumber,
      ticketDate: result.ticket.ticketDate.toISOString().slice(0, 10),
      status: result.ticket.status,
      currentServing: result.currentServing,
      serviceName: service.name,
      timezone: tz,
      claimToken: result.ticket.claimToken,
      resourceId: result.ticket.resourceId,
      resourceName: resource?.name ?? null
    });
  } catch {
    return badRequestError(event);
  }
});
