import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const s = await p.service.findFirst({
  where: { merchant: { slug: 'demo-clinic' }, bookingMode: 'QUEUE', deletedAt: null },
  select: { id: true, name: true, avgServiceMinutes: true, durationMinutes: true, merchantId: true }
});
console.log(JSON.stringify(s));
await p.$disconnect();
