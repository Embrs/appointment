// 商家標完成（CALLED → DONE）
import { defineEventHandler, getRouterParam } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, notFoundError, successResponse } from '@@/utils/response';
import {
  MSG_QUEUE_INVALID_TRANSITION,
  MSG_QUEUE_TICKET_NOT_FOUND,
  broadcastQueue,
  buildBroadcastEtaFields,
  resolveProviderByResourceMap,
  getResourceProviderEntry
} from '@@/utils/queue';

export default defineEventHandler(async (event) => {
  const auth = await requireMerchant(event);
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
      resourceId: true,
      ticketDate: true,
      service: { select: { avgServiceMinutes: true, durationMinutes: true } },
      resource: { select: { name: true } }
    }
  });
  if (!ticket) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);
  if (ticket.status !== 'CALLED') return badRequestError(event, MSG_QUEUE_INVALID_TRANSITION);

  const updated = await prisma.queueTicket.update({
    where: { id: ticket.id },
    data: { status: 'DONE', doneAt: new Date() },
    select: { id: true, ticketNumber: true, status: true, doneAt: true }
  });

  // counter 按 (merchantId, serviceId, resourceId, ticketDate) 分群查
  const counter = await prisma.queueCounter.findUnique({
    where: {
      merchantId_serviceId_resourceId_counterDate: {
        merchantId,
        serviceId: ticket.serviceId,
        resourceId: ticket.resourceId,
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
  const providerMap = await resolveProviderByResourceMap(merchantId);
  const providerEntry = getResourceProviderEntry(providerMap, ticket.resourceId);
  broadcastQueue(merchantId, {
    type: 'TICKET_DONE',
    serviceId: ticket.serviceId,
    resourceId: ticket.resourceId,
    resourceName: ticket.resource?.name,
    servingTicketId: ticket.id,
    ...etaFields,
    providerId: providerEntry?.providerId ?? null,
    providerName: providerEntry?.providerName ?? null,
    timestamp: Date.now()
  });

  return successResponse({
    ticketId: updated.id,
    ticketNumber: updated.ticketNumber,
    status: updated.status,
    doneAt: updated.doneAt?.toISOString() ?? null
  });
});
