// 公開拿號（無 token，rate limit + 交易內 SELECT FOR UPDATE 鎖 QueueCounter）
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
  getTicketDate,
  getTicketWeekday,
  getTicketTimeString,
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
    select: { id: true, bookingMode: true, name: true }
  });
  if (!service) return notFoundError(event);
  if (service.bookingMode !== 'QUEUE') return badRequestError(event, MSG_NOT_QUEUE_SERVICE);

  // 3. 驗領號時間窗
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

  // 4. 防重複領號（同 phone 同日同 service 已有 WAITING/CALLED）
  const existing = await prisma.queueTicket.findFirst({
    where: {
      merchantId: merchant.id,
      serviceId: service.id,
      ticketDate,
      customerPhone: phone,
      status: { in: ['WAITING', 'CALLED'] }
    },
    select: { id: true, ticketNumber: true }
  });
  if (existing) {
    return conflictError(event, MSG_QUEUE_ALREADY_TAKEN);
  }

  // 5. 上限檢查（事務外粗檢；事務內再次精檢）
  if (winCheck.window.maxTickets > 0) {
    const count = await prisma.queueTicket.count({
      where: { merchantId: merchant.id, serviceId: service.id, ticketDate }
    });
    if (count >= winCheck.window.maxTickets) {
      return conflictError(event, MSG_QUEUE_FULL);
    }
  }

  // 6. 交易 + FOR UPDATE
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 確保 counter 存在
      await tx.queueCounter.upsert({
        where: {
          merchantId_serviceId_counterDate: {
            merchantId: merchant.id,
            serviceId: service.id,
            counterDate: ticketDate
          }
        },
        update: {},
        create: {
          merchantId: merchant.id,
          serviceId: service.id,
          counterDate: ticketDate,
          lastTicketNumber: 0,
          lastCalledNumber: 0
        }
      });
      // 鎖 counter 該列
      const locked = await tx.$queryRaw<Array<{ id: string; lastTicketNumber: number; lastCalledNumber: number }>>`
        SELECT id, "lastTicketNumber", "lastCalledNumber"
        FROM "QueueCounter"
        WHERE "merchantId" = ${merchant.id}
          AND "serviceId" = ${service.id}
          AND "counterDate" = ${ticketDate}
        FOR UPDATE
      `;
      const counter = locked[0];
      if (!counter) throw new Error('counter not found after upsert');

      // 事務內再次精檢上限
      if (winCheck.window!.maxTickets > 0) {
        const inTxCount = await tx.queueTicket.count({
          where: { merchantId: merchant.id, serviceId: service.id, ticketDate }
        });
        if (inTxCount >= winCheck.window!.maxTickets) {
          return { full: true as const };
        }
      }

      const nextNumber = counter.lastTicketNumber + 1;
      await tx.queueCounter.update({
        where: { id: counter.id },
        data: { lastTicketNumber: nextNumber }
      });
      const ticket = await tx.queueTicket.create({
        data: {
          merchantId: merchant.id,
          serviceId: service.id,
          ticketDate,
          ticketNumber: nextNumber,
          status: 'WAITING',
          customerLastName: parsed.data.customer.lastName,
          customerTitle: parsed.data.customer.title,
          customerPhone: phone
        },
        select: { id: true, ticketNumber: true, ticketDate: true, status: true }
      });
      return {
        full: false as const,
        ticket,
        currentServing: counter.lastCalledNumber
      };
    }, { isolationLevel: 'Serializable', timeout: 15000, maxWait: 10000 });

    if (result.full) return conflictError(event, MSG_QUEUE_FULL);

    // 廣播 TICKET_TAKEN（讓商家面板即時更新）
    broadcastQueue(merchant.id, {
      type: 'TICKET_TAKEN',
      serviceId: service.id,
      ticketNumber: result.ticket.ticketNumber,
      servingTicketId: result.ticket.id,
      timestamp: Date.now()
    });

    return successResponse({
      ticketId: result.ticket.id,
      ticketNumber: result.ticket.ticketNumber,
      ticketDate: result.ticket.ticketDate.toISOString().slice(0, 10),
      status: result.ticket.status,
      currentServing: result.currentServing,
      serviceName: service.name,
      timezone: merchant.timezone
    });
  } catch {
    return badRequestError(event);
  }
});
