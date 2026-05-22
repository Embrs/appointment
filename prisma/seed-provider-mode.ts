// Case A 驗收用 seed：建立 Provider 制啟用的商家 demo-provider-clinic
// 用法：set -a && source .env.dev && set +a && npx tsx prisma/seed-provider-mode.ts
// 與 demo-clinic（Provider 制 OFF）形成 A/B 對照組，給 §12 Playwright 驗收用
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SLUG = 'demo-provider-clinic';
const MERCHANT_EMAIL = 'owner@provider.test';
const PASSWORD = 'Password123';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // 1. Merchant（providerModeEnabled=true + 三語自訂稱呼「醫師 / Doctor / 医師」）
  const merchant = await prisma.merchant.upsert({
    where: { slug: SLUG },
    update: {
      status: 'ACTIVE',
      providerModeEnabled: true,
      providerLabel: { zh: '醫師', en: 'Doctor', ja: '医師' },
      cancelPolicy: { mode: 'free' }
    },
    create: {
      slug: SLUG,
      name: 'Provider 制示範診所',
      description: 'Provider 制啟用測試商家（Case A）',
      status: 'ACTIVE',
      providerModeEnabled: true,
      providerLabel: { zh: '醫師', en: 'Doctor', ja: '医師' },
      timezone: 'Asia/Taipei',
      cancelPolicy: { mode: 'free' }
    }
  });
  const merchantId = merchant.id;

  // 2. MerchantUser OWNER 帳號
  await prisma.merchantUser.upsert({
    where: { merchantId_email: { merchantId, email: MERCHANT_EMAIL } },
    update: { passwordHash },
    create: {
      email: MERCHANT_EMAIL,
      passwordHash,
      name: 'Provider Demo Owner',
      role: 'OWNER',
      merchantId
    }
  });

  // 3. 兩個 Resource（C 診間 / D 診間，與 demo-clinic 的 A/B 區隔）
  const resourceC = await prisma.resource.upsert({
    where: { id: `res-${merchantId}-room-c` },
    update: { name: 'C 診間', displayOrder: 1, isActive: true },
    create: {
      id: `res-${merchantId}-room-c`,
      merchantId,
      name: 'C 診間',
      displayOrder: 1,
      isActive: true
    }
  });
  const resourceD = await prisma.resource.upsert({
    where: { id: `res-${merchantId}-room-d` },
    update: { name: 'D 診間', displayOrder: 2, isActive: true },
    create: {
      id: `res-${merchantId}-room-d`,
      merchantId,
      name: 'D 診間',
      displayOrder: 2,
      isActive: true
    }
  });

  // 4. 兩位 Provider（王醫師、李醫師）
  const providerWang = await prisma.provider.upsert({
    where: { id: `prov-${merchantId}-wang` },
    update: { name: '王', title: '主治醫師', isActive: true, deletedAt: null },
    create: {
      id: `prov-${merchantId}-wang`,
      merchantId,
      name: '王',
      title: '主治醫師',
      bio: '內科 20 年經驗',
      isActive: true,
      displayOrder: 1
    }
  });
  const providerLee = await prisma.provider.upsert({
    where: { id: `prov-${merchantId}-lee` },
    update: { name: '李', title: '主治醫師', isActive: true, deletedAt: null },
    create: {
      id: `prov-${merchantId}-lee`,
      merchantId,
      name: '李',
      title: '主治醫師',
      bio: '外科 15 年經驗',
      isActive: true,
      displayOrder: 2
    }
  });

  // 5. QUEUE service「看診」綁 C/D
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
      description: '今日看診（Provider 制）',
      bookingMode: 'QUEUE',
      durationMinutes: 15,
      slotIntervalMinutes: 15,
      capacityPerSlot: 1,
      priceCents: 0,
      avgServiceMinutes: 15,
      isActive: true,
      displayOrder: 10
    }
  });
  await prisma.serviceResource.deleteMany({ where: { serviceId: consultId } });
  await prisma.serviceResource.createMany({
    data: [
      { serviceId: consultId, resourceId: resourceC.id },
      { serviceId: consultId, resourceId: resourceD.id }
    ]
  });

  // 6. QueueWindow：全週開放 00:00-23:59（讓任何時間都能拿號）
  await prisma.queueWindow.deleteMany({ where: { merchantId, serviceId: consultId } });
  await prisma.queueWindow.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      merchantId,
      serviceId: consultId,
      weekday,
      startTime: '00:00',
      endTime: '23:59',
      maxTickets: 0,
      isActive: true
    }))
  });

  // 7. ScheduleRule：王醫師 → C 診間、李醫師 → D 診間（全週 00:00-23:59，確保任何測試時間都命中）
  await prisma.scheduleRule.deleteMany({
    where: { merchantId, scope: 'PROVIDER', providerId: { in: [providerWang.id, providerLee.id] } }
  });
  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    await prisma.scheduleRule.create({
      data: {
        merchantId,
        scope: 'PROVIDER',
        providerId: providerWang.id,
        resourceId: resourceC.id,
        weekday,
        startTime: '00:00',
        endTime: '23:59',
        isActive: true
      }
    });
    await prisma.scheduleRule.create({
      data: {
        merchantId,
        scope: 'PROVIDER',
        providerId: providerLee.id,
        resourceId: resourceD.id,
        weekday,
        startTime: '00:00',
        endTime: '23:59',
        isActive: true
      }
    });
  }

  // 8. ProviderService：兩位 Provider 都可服務「看診」
  await prisma.providerService.deleteMany({ where: { serviceId: consultId } });
  await prisma.providerService.createMany({
    data: [
      { providerId: providerWang.id, serviceId: consultId },
      { providerId: providerLee.id, serviceId: consultId }
    ]
  });

  console.log('Provider-mode seed done:', {
    merchantId,
    slug: SLUG,
    resourceC: { id: resourceC.id, name: 'C 診間' },
    resourceD: { id: resourceD.id, name: 'D 診間' },
    providerWang: { id: providerWang.id, name: '王' },
    providerLee: { id: providerLee.id, name: '李' },
    consultServiceId: consultId,
    merchantEmail: MERCHANT_EMAIL,
    password: PASSWORD
  });
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
