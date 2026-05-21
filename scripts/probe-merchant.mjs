import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const ms = await p.merchant.findMany({
  where: { deletedAt: null, status: 'ACTIVE' },
  select: {
    id: true,
    slug: true,
    name: true,
    timezone: true,
    users: { select: { email: true, role: true }, take: 3 },
    services: {
      where: { bookingMode: 'QUEUE', deletedAt: null },
      select: { id: true, name: true, avgServiceMinutes: true, durationMinutes: true, isActive: true }
    }
  },
  take: 10
});
console.log(JSON.stringify(ms, null, 2));
await p.$disconnect();
