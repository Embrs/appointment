// 公開查單張號碼牌（WS 兜底輪詢用）
import { defineEventHandler, getRouterParam, getRequestIP, setResponseHeader } from 'h3';
import { prisma } from '@@/utils/prisma';
import {
  notFoundError,
  successResponse,
  tooManyRequestsError
} from '@@/utils/response';
import { checkRateLimit } from '@@/utils/rate-limit';
import { MSG_QUEUE_TICKET_NOT_FOUND } from '@@/utils/queue';

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const rl = await checkRateLimit(`queue-get-ip:${ip}`, 30, 60);
  if (!rl.ok) {
    setResponseHeader(event, 'Retry-After', String(rl.retryAfterSeconds ?? 60));
    return tooManyRequestsError(event);
  }

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);

  const ticket = await prisma.queueTicket.findUnique({
    where: { id },
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
      service: { select: { name: true } },
      merchant: { select: { timezone: true, name: true } }
    }
  });
  if (!ticket) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);

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

  // 前面還有多少 WAITING 的票（號碼小於自己且狀態 WAITING）
  const waitingAhead = await prisma.queueTicket.count({
    where: {
      merchantId: ticket.merchantId,
      serviceId: ticket.serviceId,
      ticketDate: ticket.ticketDate,
      status: 'WAITING',
      ticketNumber: { lt: ticket.ticketNumber }
    }
  });

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
    waitingAhead
  });
});
