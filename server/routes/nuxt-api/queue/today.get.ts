// 商家當日號碼牌總覽（依服務群組）
import { defineEventHandler } from 'h3';
import { prisma } from '@@/utils/prisma';
import { requireMerchant } from '@@/utils/auth';
import { successResponse } from '@@/utils/response';
import { getTicketDate } from '@@/utils/queue';

export default defineEventHandler(async (event) => {
  const auth = requireMerchant(event);
  if ('status' in auth) return auth;
  const merchantId = auth.merchantId!;

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { timezone: true }
  });
  const tz = merchant?.timezone ?? 'Asia/Taipei';
  const ticketDate = getTicketDate(tz);

  const services = await prisma.service.findMany({
    where: { merchantId, bookingMode: 'QUEUE', deletedAt: null },
    orderBy: { displayOrder: 'asc' },
    select: { id: true, name: true, isActive: true }
  });

  const counters = await prisma.queueCounter.findMany({
    where: { merchantId, counterDate: ticketDate },
    select: { serviceId: true, lastTicketNumber: true, lastCalledNumber: true }
  });
  const counterMap = new Map(counters.map((c) => [c.serviceId, c]));

  const tickets = await prisma.queueTicket.findMany({
    where: { merchantId, ticketDate },
    orderBy: { ticketNumber: 'asc' },
    select: {
      id: true,
      serviceId: true,
      ticketNumber: true,
      status: true,
      customerLastName: true,
      customerTitle: true,
      customerPhone: true,
      takenAt: true,
      calledAt: true,
      doneAt: true
    }
  });

  const grouped = services.map((s) => {
    const counter = counterMap.get(s.id);
    const list = tickets.filter((t) => t.serviceId === s.id).map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.status,
      customerLastName: t.customerLastName,
      customerTitle: t.customerTitle,
      customerPhone: t.customerPhone,
      takenAt: t.takenAt.toISOString(),
      calledAt: t.calledAt ? t.calledAt.toISOString() : null,
      doneAt: t.doneAt ? t.doneAt.toISOString() : null
    }));
    return {
      serviceId: s.id,
      serviceName: s.name,
      isActive: s.isActive,
      lastTicketNumber: counter?.lastTicketNumber ?? 0,
      lastCalledNumber: counter?.lastCalledNumber ?? 0,
      tickets: list
    };
  });

  return successResponse({
    ticketDate: ticketDate.toISOString().slice(0, 10),
    timezone: tz,
    services: grouped
  });
});
