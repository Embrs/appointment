import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const ms = await prisma.merchant.findMany({ select: { slug: true, name: true, status: true } });
console.log(JSON.stringify(ms, null, 2));
const svc = await prisma.service.findMany({ where: { bookingMode: 'QUEUE', isActive: true }, select: { id: true, name: true, merchant: { select: { slug: true, status: true } } } });
console.log('QUEUE services:', JSON.stringify(svc, null, 2));
await prisma.$disconnect();
