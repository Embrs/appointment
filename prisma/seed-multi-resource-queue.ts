// 階段 2 Playwright 驗收用 seed：建立 QUEUE service「看診」綁定 A/B 兩 Resource，並開今日 QueueWindow
// 用法：set -a && source .env.dev && set +a && npx tsx prisma/seed-multi-resource-queue.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'demo-clinic';

async function main() {
  const merchant = await prisma.merchant.findUnique({ where: { slug: SLUG } });
  if (!merchant) throw new Error(`merchant slug=${SLUG} not found; run seed-customer-booking first`);
  const merchantId = merchant.id;

  // 兩個 Resource
  const resourceA = await prisma.resource.upsert({
    where: { id: `res-${merchantId}-room-a` },
    update: { name: 'A 診間', displayOrder: 1, isActive: true },
    create: {
      id: `res-${merchantId}-room-a`,
      merchantId,
      name: 'A 診間',
      displayOrder: 1,
      isActive: true
    }
  });
  const resourceB = await prisma.resource.upsert({
    where: { id: `res-${merchantId}-room-b` },
    update: { name: 'B 診間', displayOrder: 2, isActive: true },
    create: {
      id: `res-${merchantId}-room-b`,
      merchantId,
      name: 'B 診間',
      displayOrder: 2,
      isActive: true
    }
  });

  // 一個 QUEUE service「看診」綁定 A/B
  const consultId = `svc-${merchantId}-consult-queue`;
  const consult = await prisma.service.upsert({
    where: { id: consultId },
    update: {
      name: '看診',
      bookingMode: 'QUEUE',
      avgServiceMinutes: 15,
      isActive: true,
      displayOrder: 10,
      deletedAt: null
    },
    create: {
      id: consultId,
      merchantId,
      name: '看診',
      bookingMode: 'QUEUE',
      durationMinutes: 15,
      slotIntervalMinutes: 15,
      avgServiceMinutes: 15,
      isActive: true,
      displayOrder: 10
    }
  });

  // 綁定關係
  await prisma.serviceResource.deleteMany({ where: { serviceId: consult.id } });
  await prisma.serviceResource.createMany({
    data: [
      { serviceId: consult.id, resourceId: resourceA.id },
      { serviceId: consult.id, resourceId: resourceB.id }
    ],
    skipDuplicates: true
  });

  // 另一個 QUEUE service「諮詢」（不綁 resource，迴歸驗證用）
  const consultNoResId = `svc-${merchantId}-consult-no-resource`;
  await prisma.service.upsert({
    where: { id: consultNoResId },
    update: {
      name: '諮詢',
      bookingMode: 'QUEUE',
      avgServiceMinutes: 10,
      isActive: true,
      displayOrder: 11,
      deletedAt: null
    },
    create: {
      id: consultNoResId,
      merchantId,
      name: '諮詢',
      bookingMode: 'QUEUE',
      durationMinutes: 10,
      slotIntervalMinutes: 10,
      avgServiceMinutes: 10,
      isActive: true,
      displayOrder: 11
    }
  });

  // 今日 QueueWindow（讓兩 service 都可領號）
  // 涵蓋全天 08:00 ~ 23:59
  for (const svcId of [consult.id, consultNoResId]) {
    await prisma.queueWindow.deleteMany({ where: { serviceId: svcId } });
    const windows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      merchantId,
      serviceId: svcId,
      weekday,
      startTime: '08:00',
      endTime: '23:59',
      maxTickets: 100
    }));
    await prisma.queueWindow.createMany({ data: windows, skipDuplicates: true });
  }

  console.log('Multi-resource queue seed done:', {
    merchantId,
    slug: SLUG,
    resourceA: { id: resourceA.id, name: resourceA.name },
    resourceB: { id: resourceB.id, name: resourceB.name },
    consultServiceId: consult.id,
    consultNoResId
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
