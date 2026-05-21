// 公開拿號（無 token，rate limit + 委派 internalCreateTicket 處理 Counter / 並發 / 寫票）
import { defineEventHandler, readBody, getRequestIP, setResponseHeader } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import {
  badRequestError,
  conflictError,
  notFoundError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import { isValidPhone, normalizePhone } from '@@/utils/booking';
import {
  MSG_NOT_QUEUE_SERVICE,
  MSG_QUEUE_ALREADY_TAKEN,
  MSG_QUEUE_FULL,
  MSG_QUEUE_WINDOW_CLOSED,
  broadcastQueue,
  buildBroadcastEtaFields,
  getTicketDate,
  getTicketWeekday,
  internalCreateTicket,
  isWithinQueueWindow
} from '@@/utils/queue';

const BodySchema = z.object({
  slug: z.string().min(1).max(64),
  serviceId: z.string().min(1),
  customer: z.object({
    lastName: z.string().min(1).max(20),
    title: z.enum(['MR', 'MRS', 'MISS', 'MX']),
    phone: z.string().min(6).max(20)
  })
});

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';

  const rlIp = await checkRateLimit(`queue-take-ip:${ip}`, 5, 60);
  if (!rlIp.ok) {
    setResponseHeader(event, 'Retry-After', String(rlIp.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);
  if (!isValidPhone(parsed.data.customer.phone)) return badRequestError(event);

  const phone = normalizePhone(parsed.data.customer.phone);
  const rlPhone = await checkRateLimit(`queue-take-phone:${phone}`, 3, 60);
  if (!rlPhone.ok) {
    setResponseHeader(event, 'Retry-After', String(rlPhone.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  // 1. 取商家
  const merchant = await prisma.merchant.findFirst({
    where: { slug: parsed.data.slug, status: 'ACTIVE', deletedAt: null },
    select: { id: true, timezone: true }
  });
  if (!merchant) return notFoundError(event);

  // 2. 取服務、驗 bookingMode=QUEUE
  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, merchantId: merchant.id, isActive: true, deletedAt: null },
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

  // 3. 驗領號時間窗（公開端嚴格校驗；商家代建端不套用）
  const now = new Date();
  const weekday = getTicketWeekday(merchant.timezone, now);
  const windows = await prisma.queueWindow.findMany({
    where: {
      merchantId: merchant.id,
      serviceId: service.id,
      weekday,
      isActive: true
    },
    select: { weekday: true, startTime: true, endTime: true, maxTickets: true, isActive: true }
  });
  const winCheck = isWithinQueueWindow(windows, merchant.timezone, now);
  if (!winCheck.ok || !winCheck.window) return badRequestError(event, MSG_QUEUE_WINDOW_CLOSED);

  const ticketDate = getTicketDate(merchant.timezone, now);

  // 4. 委派共用拿號核心
  try {
    const result = await internalCreateTicket({
      merchantId: merchant.id,
      serviceId: service.id,
      ticketDate,
      customer: {
        lastName: parsed.data.customer.lastName,
        title: parsed.data.customer.title,
        phone
      },
      createdByMerchant: false,
      maxTickets: winCheck.window.maxTickets
    });

    if (!result.ok) {
      if (result.reason === 'ALREADY_TAKEN') return conflictError(event, MSG_QUEUE_ALREADY_TAKEN);
      return conflictError(event, MSG_QUEUE_FULL);
    }

    // 廣播 TICKET_TAKEN（讓商家面板即時更新）
    const etaFields = buildBroadcastEtaFields(
      { lastCalledNumber: result.currentServing },
      result.ticket.ticketNumber,
      { avgServiceMinutes: service.avgServiceMinutes, durationMinutes: service.durationMinutes }
    );
    broadcastQueue(merchant.id, {
      type: 'TICKET_TAKEN',
      serviceId: service.id,
      ticketNumber: result.ticket.ticketNumber,
      servingTicketId: result.ticket.id,
      ...etaFields,
      timestamp: Date.now()
    });

    return successResponse({
      ticketId: result.ticket.id,
      ticketNumber: result.ticket.ticketNumber,
      ticketDate: result.ticket.ticketDate.toISOString().slice(0, 10),
      status: result.ticket.status,
      currentServing: result.currentServing,
      serviceName: service.name,
      timezone: merchant.timezone,
      claimToken: result.ticket.claimToken
    });
  } catch {
    return badRequestError(event);
  }
});
