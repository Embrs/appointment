// 商家叫下一號（事務內 FOR UPDATE 鎖 QueueCounter 防兩員工同按）
import { defineEventHandler, readBody } from 'h3';
import { z } from 'zod';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { badRequestError, conflictError, notFoundError, successResponse } from '@@/utils/response';
import type { I18nMessage } from '@@/utils/response';
import {
  MSG_QUEUE_NO_WAITING,
  MSG_NOT_QUEUE_SERVICE,
  broadcastQueue,
  buildBroadcastEtaFields,
  getTicketDate
} from '@@/utils/queue';

const MSG_QUEUE_CONCURRENT: I18nMessage = {
  zh_tw: '其他員工剛叫了同一號，請重試',
  en: 'Another staff just called the next ticket. Please retry.',
  ja: '他のスタッフが直前に呼び出しました。もう一度お試しください。'
};

const BodySchema = z.object({
  serviceId: z.string().min(1)
});

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;
  const merchantId = auth.merchantId!;

  const parsed = BodySchema.safeParse(await readBody(event));
  if (!parsed.success) return badRequestError(event);

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, merchantId, deletedAt: null },
    select: { id: true, bookingMode: true, avgServiceMinutes: true, durationMinutes: true }
  });
  if (!service) return notFoundError(event);
  if (service.bookingMode !== 'QUEUE') return badRequestError(event, MSG_NOT_QUEUE_SERVICE);

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { timezone: true }
  });
  const tz = merchant?.timezone ?? 'Asia/Taipei';
  const ticketDate = getTicketDate(tz);

  // 事務 + FOR UPDATE
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    // 確保 counter 存在
    await tx.queueCounter.upsert({
      where: {
        merchantId_serviceId_counterDate: {
          merchantId,
          serviceId: service.id,
          counterDate: ticketDate
        }
      },
      update: {},
      create: {
        merchantId,
        serviceId: service.id,
        counterDate: ticketDate,
        lastTicketNumber: 0,
        lastCalledNumber: 0
      }
    });
    // 鎖 counter
    const locked = await tx.$queryRaw<Array<{ id: string; lastCalledNumber: number; lastTicketNumber: number }>>`
      SELECT id, "lastCalledNumber", "lastTicketNumber" FROM "QueueCounter"
      WHERE "merchantId" = ${merchantId}
        AND "serviceId" = ${service.id}
        AND "counterDate" = ${ticketDate}
      FOR UPDATE
    `;
    const counter = locked[0];
    if (!counter) return { ok: false as const };

    // 找最小 WAITING 票
    const next = await tx.queueTicket.findFirst({
      where: {
        merchantId,
        serviceId: service.id,
        ticketDate,
        status: 'WAITING'
      },
      orderBy: { ticketNumber: 'asc' },
      select: { id: true, ticketNumber: true }
    });
    if (!next) return { ok: false as const };

    const now = new Date();
    await tx.queueTicket.update({
      where: { id: next.id },
      data: { status: 'CALLED', calledAt: now }
    });
    await tx.queueCounter.update({
      where: { id: counter.id },
      data: { lastCalledNumber: next.ticketNumber }
    });
    return {
      ok: true as const,
      ticketId: next.id,
      ticketNumber: next.ticketNumber,
      lastTicketNumber: counter.lastTicketNumber
    };
    }, { isolationLevel: 'Serializable', timeout: 15000, maxWait: 10000 });
  } catch (err: unknown) {
    // PostgreSQL 40001 serialization_failure：兩員工並發叫號
    const msg = (err as { message?: string } | null)?.message ?? '';
    if (msg.includes('40001') || /could not serialize/i.test(msg)) {
      return conflictError(event, MSG_QUEUE_CONCURRENT);
    }
    return badRequestError(event);
  }

  if (!result.ok) return badRequestError(event, MSG_QUEUE_NO_WAITING);

  const etaFields = buildBroadcastEtaFields(
    { lastCalledNumber: result.ticketNumber },
    result.lastTicketNumber,
    { avgServiceMinutes: service.avgServiceMinutes, durationMinutes: service.durationMinutes }
  );
  broadcastQueue(merchantId, {
    type: 'CALL_NEXT',
    serviceId: service.id,
    current: result.ticketNumber,
    servingTicketId: result.ticketId,
    ...etaFields,
    timestamp: Date.now()
  });

  return successResponse({
    ticketId: result.ticketId,
    ticketNumber: result.ticketNumber,
    serviceId: service.id
  });
});
