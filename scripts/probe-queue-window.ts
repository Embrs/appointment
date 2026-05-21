import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const w = await p.queueWindow.findMany({
  where: { merchant: { slug: 'demo-clinic' } },
  select: { id: true, serviceId: true, weekday: true, startTime: true, endTime: true, maxTickets: true, isActive: true }
});
const counters = await p.queueCounter.findMany({
  where: { merchant: { slug: 'demo-clinic' } },
  select: { id: true, serviceId: true, counterDate: true, lastTicketNumber: true, lastCalledNumber: true }
});
console.log('windows', JSON.stringify(w));
console.log('counters', JSON.stringify(counters));
await p.$disconnect();
