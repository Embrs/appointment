// 公開：以 claimToken 換取自己當日票券詳情（QR 掃碼入口）
// 條件：當日 + status IN ('WAITING','CALLED')；其餘一律 404（不洩漏 token 是否存在）
// RateLimit：queue-claim-ip 30/60s + queue-claim-token 20/60s 雙桶
// 回應 shape 對齊 /public/queue/[id]，但不洩漏 customerPhone/lastName/title
import { defineEventHandler, getRouterParam, getRequestIP, setResponseHeader } from 'h3';
import { prisma } from '@@/utils/prisma';
import {
  notFoundError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import {
  MSG_QUEUE_TICKET_NOT_FOUND,
  estimateWaitMinutes,
  getEffectiveAvgServiceMinutes,
  getTicketDate
} from '@@/utils/queue';

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';

  // IP 桶：擋暴力枚舉
  const rlIp = await checkRateLimit(`queue-claim-ip:${ip}`, 30, 60);
  if (!rlIp.ok) {
    setResponseHeader(event, 'Retry-After', String(rlIp.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const token = getRouterParam(event, 'token') ?? '';
  if (!token || token.length > 32) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);

  // token 桶：防同 token 被高頻探測
  const rlToken = await checkRateLimit(`queue-claim-token:${token}`, 20, 60);
  if (!rlToken.ok) {
    setResponseHeader(event, 'Retry-After', String(rlToken.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const ticket = await prisma.queueTicket.findUnique({
    where: { claimToken: token },
    select: {
      id: true,
      merchantId: true,
      serviceId: true,
      ticketDate: true,
      ticketNumber: true,
      status: true,
      takenAt: true,
      calledAt: true,
      doneAt: true,
      service: { select: { name: true, avgServiceMinutes: true, durationMinutes: true } },
      merchant: { select: { timezone: true, name: true } }
    }
  });
  if (!ticket) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);

  // 僅允許「當日 + 進行中」票；其他狀態（DONE/SKIPPED/CANCELED）或跨日票一律 404
  const todayInTz = getTicketDate(ticket.merchant.timezone, new Date());
  if (ticket.ticketDate.getTime() !== todayInTz.getTime()) {
    return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);
  }
  if (ticket.status !== 'WAITING' && ticket.status !== 'CALLED') {
    return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);
  }

  const counter = await prisma.queueCounter.findUnique({
    where: {
      merchantId_serviceId_counterDate: {
        merchantId: ticket.merchantId,
        serviceId: ticket.serviceId,
        counterDate: ticket.ticketDate
      }
    },
    select: { lastTicketNumber: true, lastCalledNumber: true }
  });

  const waitingAhead = await prisma.queueTicket.count({
    where: {
      merchantId: ticket.merchantId,
      serviceId: ticket.serviceId,
      ticketDate: ticket.ticketDate,
      status: 'WAITING',
      ticketNumber: { lt: ticket.ticketNumber }
    }
  });

  const effectiveAvg = getEffectiveAvgServiceMinutes(ticket.service);
  let estimatedWaitMinutes: number | null;
  if (!counter) {
    estimatedWaitMinutes = null;
  } else if (ticket.status !== 'WAITING') {
    estimatedWaitMinutes = 0;
  } else {
    estimatedWaitMinutes = estimateWaitMinutes(waitingAhead, effectiveAvg);
  }

  return successResponse({
    ticket: {
      id: ticket.id,
      serviceId: ticket.serviceId,
      ticketNumber: ticket.ticketNumber,
      ticketDate: ticket.ticketDate.toISOString().slice(0, 10),
      status: ticket.status,
      takenAt: ticket.takenAt.toISOString(),
      calledAt: ticket.calledAt ? ticket.calledAt.toISOString() : null,
      doneAt: ticket.doneAt ? ticket.doneAt.toISOString() : null,
      serviceName: ticket.service.name
    },
    merchant: {
      id: ticket.merchantId,
      name: ticket.merchant.name,
      timezone: ticket.merchant.timezone
    },
    currentServing: counter?.lastCalledNumber ?? 0,
    lastTicketNumber: counter?.lastTicketNumber ?? 0,
    waitingAhead,
    estimatedWaitMinutes,
    avgServiceMinutes: effectiveAvg
  });
});
