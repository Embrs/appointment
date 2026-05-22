// 公開查單張號碼牌（WS 兜底輪詢用）
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
  resolveProviderByResourceMap,
  getResourceProviderEntry
} from '@@/utils/queue';

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
      resourceId: true,
      ticketDate: true,
      ticketNumber: true,
      status: true,
      takenAt: true,
      calledAt: true,
      doneAt: true,
      service: { select: { name: true, avgServiceMinutes: true, durationMinutes: true } },
      merchant: { select: { timezone: true, name: true, providerLabel: true } },
      resource: { select: { name: true } }
    }
  });
  if (!ticket) return notFoundError(event, MSG_QUEUE_TICKET_NOT_FOUND);

  // counter 按 (serviceId, resourceId) 分群（資源獨立號池）
  const counter = await prisma.queueCounter.findUnique({
    where: {
      merchantId_serviceId_resourceId_counterDate: {
        merchantId: ticket.merchantId,
        serviceId: ticket.serviceId,
        resourceId: ticket.resourceId,
        counterDate: ticket.ticketDate
      }
    },
    select: { lastTicketNumber: true, lastCalledNumber: true }
  });

  // 前面還有多少 WAITING 的票（同 resource 內、號碼小於自己且狀態 WAITING）
  const waitingAhead = await prisma.queueTicket.count({
    where: {
      merchantId: ticket.merchantId,
      serviceId: ticket.serviceId,
      resourceId: ticket.resourceId,
      ticketDate: ticket.ticketDate,
      status: 'WAITING',
      ticketNumber: { lt: ticket.ticketNumber }
    }
  });

  // Provider 顯示（schedule 反查；未啟用 Provider 制商家短路回空 Map）
  const providerMap = await resolveProviderByResourceMap(ticket.merchantId);
  const providerEntry = getResourceProviderEntry(providerMap, ticket.resourceId);

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
      resourceId: ticket.resourceId,
      resourceName: ticket.resource?.name ?? null,
      ticketNumber: ticket.ticketNumber,
      ticketDate: ticket.ticketDate.toISOString().slice(0, 10),
      status: ticket.status,
      takenAt: ticket.takenAt.toISOString(),
      calledAt: ticket.calledAt ? ticket.calledAt.toISOString() : null,
      doneAt: ticket.doneAt ? ticket.doneAt.toISOString() : null,
      serviceName: ticket.service.name,
      providerId: providerEntry?.providerId ?? null,
      providerName: providerEntry?.providerName ?? null
    },
    merchant: {
      id: ticket.merchantId,
      name: ticket.merchant.name,
      timezone: ticket.merchant.timezone,
      providerLabel: ticket.merchant.providerLabel
    },
    currentServing: counter?.lastCalledNumber ?? 0,
    lastTicketNumber: counter?.lastTicketNumber ?? 0,
    waitingAhead,
    estimatedWaitMinutes,
    avgServiceMinutes: effectiveAvg
  });
});
