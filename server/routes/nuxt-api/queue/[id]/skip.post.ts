// 商家標過號（CALLED → SKIPPED）
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';
import {
  MSG_QUEUE_INVALID_TRANSITION,
  MSG_QUEUE_TICKET_NOT_FOUND,
  broadcastQueue,
  buildBroadcastEtaFields
} from '@@/utils/queue';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;
  const merchantId = auth.merchantId!;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);

  const ticket = await prisma.queueTicket.findFirst({
    where: { id, merchantId },
    select: {
      id: true,
      status: true,
      serviceId: true,
      ticketDate: true,
      service: { select: { avgServiceMinutes: true, durationMinutes: true } }
    }
  });
  if (!ticket) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);
  if (ticket.status !== 'CALLED') return badRequestError(event, MSG_QUEUE_INVALID_TRANSITION);

  const updated = await prisma.queueTicket.update({
    where: { id: ticket.id },
    data: { status: 'SKIPPED' },
    select: { id: true, ticketNumber: true, status: true }
  });

  const counter = await prisma.queueCounter.findUnique({
    where: {
      merchantId_serviceId_counterDate: {
        merchantId,
        serviceId: ticket.serviceId,
        counterDate: ticket.ticketDate
      }
    },
    select: { lastCalledNumber: true, lastTicketNumber: true }
  });
  const etaFields = buildBroadcastEtaFields(
    counter ? { lastCalledNumber: counter.lastCalledNumber } : null,
    counter?.lastTicketNumber ?? 0,
    {
      avgServiceMinutes: ticket.service.avgServiceMinutes,
      durationMinutes: ticket.service.durationMinutes
    }
  );
  broadcastQueue(merchantId, {
    type: 'TICKET_SKIPPED',
    serviceId: ticket.serviceId,
    servingTicketId: ticket.id,
    ...etaFields,
    timestamp: Date.now()
  });

  return successResponse({
    ticketId: updated.id,
    ticketNumber: updated.ticketNumber,
    status: updated.status
  });
});
