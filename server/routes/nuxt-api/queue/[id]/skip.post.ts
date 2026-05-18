// 商家標過號（CALLED → SKIPPED）
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';
import {
  MSG_QUEUE_INVALID_TRANSITION,
  MSG_QUEUE_TICKET_NOT_FOUND,
  broadcastQueue
} from '@@/utils/queue';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;
  const merchantId = auth.merchantId!;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);

  const ticket = await prisma.queueTicket.findFirst({
    where: { id, merchantId },
    select: { id: true, status: true, serviceId: true }
  });
  if (!ticket) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);
  if (ticket.status !== 'CALLED') return badRequestError(event, MSG_QUEUE_INVALID_TRANSITION);

  const updated = await prisma.queueTicket.update({
    where: { id: ticket.id },
    data: { status: 'SKIPPED' },
    select: { id: true, ticketNumber: true, status: true }
  });

  broadcastQueue(merchantId, {
    type: 'TICKET_SKIPPED',
    serviceId: ticket.serviceId,
    servingTicketId: ticket.id,
    timestamp: Date.now()
  });

  return successResponse({
    ticketId: updated.id,
    ticketNumber: updated.ticketNumber,
    status: updated.status
  });
});
