import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const today = new Date('2026-05-21T00:00:00.000Z');
const ts = await p.queueTicket.findMany({
  where: { merchant: { slug: 'demo-clinic' }, ticketDate: today },
  orderBy: { ticketNumber: 'asc' },
  select: { id: true, ticketNumber: true, status: true, customerLastName: true, customerPhone: true, takenAt: true }
});
console.log(JSON.stringify(ts, null, 2));
await p.$disconnect();
