// 商家報到台改派診間（WAITING → 另一 active resource，保留原 ticketNumber）
// 廣播 TICKET_SKIPPED（舊 resource，UI 移除）+ TICKET_TAKEN（新 resource，UI 插入）
import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import {
  badRequestError,
  conflictError,
  notFoundError,
  successResponse
} from '@@/utils/response';
import {
  MSG_QUEUE_INVALID_STATE,
  MSG_QUEUE_NUMBER_TAKEN,
  MSG_QUEUE_RESOURCE_INVALID,
  MSG_QUEUE_TICKET_NOT_FOUND,
  broadcastQueue,
  buildBroadcastEtaFields,
  getResourceProviderEntry,
  getResourcesForQueueService,
  getTicketDate,
  resolveProviderByResourceMap
} from '@@/utils/queue';

const BodySchema = z.object({
  resourceId: z.string().min(1)
});

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;
  const merchantId = auth.merchantId!;

  const id = getRouterParam(event, 'id') ?? '';
  if (!id) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);
  const targetResourceId = parsed.data.resourceId;

  // 1. 取票（ownership + status + 今日）
  const ticket = await prisma.queueTicket.findFirst({
    where: { id, merchantId },
    select: {
      id: true,
      status: true,
      serviceId: true,
      resourceId: true,
      ticketNumber: true,
      ticketDate: true,
      service: { select: { avgServiceMinutes: true, durationMinutes: true } },
      resource: { select: { id: true, name: true } }
    }
  });
  if (!ticket) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);
  if (ticket.status !== 'WAITING') return conflictError(event, MSG_QUEUE_INVALID_STATE);

  // 校驗 ticketDate=今日（商家時區）
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { timezone: true }
  });
  const tz = merchant?.timezone ?? 'Asia/Taipei';
  const todayInTz = getTicketDate(tz);
  if (ticket.ticketDate.getTime() !== todayInTz.getTime()) {
    return conflictError(event, MSG_QUEUE_INVALID_STATE);
  }

  // 2. no-op 短路：改派為當前 resource
  if (targetResourceId === ticket.resourceId) {
    return successResponse({ ok: true, noChange: true });
  }

  // 3. 驗目標 resource 屬該 ticket service 已綁的 active resource
  const bound = await getResourcesForQueueService(ticket.serviceId);
  const targetResource = bound.find((r) => r.id === targetResourceId);
  if (!targetResource) return badRequestError(event, MSG_QUEUE_RESOURCE_INVALID);

  // 4. UPDATE QueueTicket SET resourceId=新值；P2002 → 409 撞號
  try {
    await prisma.queueTicket.update({
      where: { id: ticket.id },
      data: { resourceId: targetResourceId }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return conflictError(event, MSG_QUEUE_NUMBER_TAKEN);
    }
    throw err;
  }

  // 5. 廣播 TICKET_SKIPPED（舊 resource）+ TICKET_TAKEN（新 resource）
  // 兩個 broadcast 各自查 counter 取 lastTicketNumber 估 ETA
  const [oldCounter, newCounter] = await Promise.all([
    prisma.queueCounter.findUnique({
      where: {
        merchantId_serviceId_resourceId_counterDate: {
          merchantId,
          serviceId: ticket.serviceId,
          resourceId: ticket.resourceId,
          counterDate: ticket.ticketDate
        }
      },
      select: { lastCalledNumber: true, lastTicketNumber: true }
    }),
    prisma.queueCounter.findUnique({
      where: {
        merchantId_serviceId_resourceId_counterDate: {
          merchantId,
          serviceId: ticket.serviceId,
          resourceId: targetResourceId,
          counterDate: ticket.ticketDate
        }
      },
      select: { lastCalledNumber: true, lastTicketNumber: true }
    })
  ]);

  const providerMap = await resolveProviderByResourceMap(merchantId);
  const oldProviderEntry = getResourceProviderEntry(providerMap, ticket.resourceId);
  const newProviderEntry = getResourceProviderEntry(providerMap, targetResourceId);

  const oldEta = buildBroadcastEtaFields(
    oldCounter ? { lastCalledNumber: oldCounter.lastCalledNumber } : null,
    oldCounter?.lastTicketNumber ?? 0,
    {
      avgServiceMinutes: ticket.service.avgServiceMinutes,
      durationMinutes: ticket.service.durationMinutes
    }
  );
  const newEta = buildBroadcastEtaFields(
    newCounter ? { lastCalledNumber: newCounter.lastCalledNumber } : null,
    newCounter?.lastTicketNumber ?? 0,
    {
      avgServiceMinutes: ticket.service.avgServiceMinutes,
      durationMinutes: ticket.service.durationMinutes
    }
  );

  broadcastQueue(merchantId, {
    type: 'TICKET_SKIPPED',
    serviceId: ticket.serviceId,
    resourceId: ticket.resourceId,
    resourceName: ticket.resource?.name,
    servingTicketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ...oldEta,
    providerId: oldProviderEntry?.providerId ?? null,
    providerName: oldProviderEntry?.providerName ?? null,
    timestamp: Date.now()
  });
  broadcastQueue(merchantId, {
    type: 'TICKET_TAKEN',
    serviceId: ticket.serviceId,
    resourceId: targetResourceId,
    resourceName: targetResource.name,
    servingTicketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ...newEta,
    providerId: newProviderEntry?.providerId ?? null,
    providerName: newProviderEntry?.providerName ?? null,
    timestamp: Date.now()
  });

  return successResponse({
    ok: true,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    fromResourceId: ticket.resourceId,
    toResourceId: targetResourceId,
    toResourceName: targetResource.name
  });
});
