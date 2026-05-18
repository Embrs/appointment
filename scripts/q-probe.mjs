import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const merchants = await p.merchant.findMany({
  where: { deletedAt: null },
  select: { id: true, slug: true, name: true, status: true },
  orderBy: { createdAt: 'desc' },
  take: 5
});
console.log('MERCHANTS=' + JSON.stringify(merchants));

const queueServices = await p.service.findMany({
  where: { bookingMode: 'QUEUE', deletedAt: null },
  select: { id: true, merchantId: true, name: true, isActive: true },
  take: 10
});
console.log('QUEUE_SERVICES=' + JSON.stringify(queueServices));

const windows = await p.queueWindow.findMany({
  select: { id: true, merchantId: true, serviceId: true, weekday: true, startTime: true, endTime: true, isActive: true, maxTickets: true },
  take: 10
});
console.log('WINDOWS=' + JSON.stringify(windows));

const users = await p.merchantUser.findMany({
  select: { id: true, merchantId: true, email: true, role: true, isActive: true },
  take: 10
});
console.log('USERS=' + JSON.stringify(users));

await p.$disconnect();
