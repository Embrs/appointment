 
// Seed for customer-booking-flow Playwright scenarios
// 用法：set -a && source .env.dev && set +a && npx tsx prisma/seed-customer-booking.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SLUG = 'demo-clinic';
const ADMIN_EMAIL = 'admin@demo.test';
const MERCHANT_EMAIL = 'owner@demo.test';
const PASSWORD = 'Password123';

const upsertHash = async () => bcrypt.hash(PASSWORD, 10);

async function main() {
  const passwordHash = await upsertHash();

  // 1. Admin（之前的 change 已建立，這裡 idempotent upsert）
  await prisma.adminUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Demo Admin'
    }
  });

  // 2. Merchant
  const merchant = await prisma.merchant.upsert({
    where: { slug: SLUG },
    update: {
      status: 'ACTIVE',
      cancelPolicy: { mode: 'free' }
    },
    create: {
      slug: SLUG,
      name: '示範診所',
      description: 'Playwright 測試用商家',
      status: 'ACTIVE',
      timezone: 'Asia/Taipei',
      cancelPolicy: { mode: 'free' }
    }
  });

  // 3. Owner
  await prisma.merchantUser.upsert({
    where: { merchantId_email: { merchantId: merchant.id, email: MERCHANT_EMAIL } },
    update: { passwordHash, isActive: true, role: 'OWNER' },
    create: {
      merchantId: merchant.id,
      email: MERCHANT_EMAIL,
      passwordHash,
      name: '示範老闆',
      role: 'OWNER'
    }
  });

  // 4. Services
  const extraction = await prisma.service.upsert({
    where: { id: `svc-${merchant.id}-extraction` },
    update: {},
    create: {
      id: `svc-${merchant.id}-extraction`,
      merchantId: merchant.id,
      name: '拔牙',
      description: '單顆拔牙服務',
      bookingMode: 'TIME_SLOT',
      durationMinutes: 60,
      slotIntervalMinutes: 60,
      capacityPerSlot: 1,
      displayOrder: 0
    }
  });

  await prisma.service.upsert({
    where: { id: `svc-${merchant.id}-checkup` },
    update: {},
    create: {
      id: `svc-${merchant.id}-checkup`,
      merchantId: merchant.id,
      name: '健康檢查',
      description: '一般健檢',
      bookingMode: 'TIME_CAPACITY',
      durationMinutes: 30,
      slotIntervalMinutes: 30,
      capacityPerSlot: 3,
      displayOrder: 1
    }
  });

  // 5. ScheduleRule：每週一至日 09:00 ~ 18:00
  for (let weekday = 0; weekday < 7; weekday++) {
    const exists = await prisma.scheduleRule.findFirst({
      where: {
        merchantId: merchant.id,
        scope: 'MERCHANT',
        resourceId: null,
        weekday
      }
    });
    if (!exists) {
      await prisma.scheduleRule.create({
        data: {
          merchantId: merchant.id,
          scope: 'MERCHANT',
          weekday,
          startTime: '09:00',
          endTime: '18:00',
          isActive: true
        }
      });
    }
  }

  console.log('Seed completed');
  console.log({
    slug: SLUG,
    adminEmail: ADMIN_EMAIL,
    merchantEmail: MERCHANT_EMAIL,
    password: PASSWORD,
    extractionServiceId: extraction.id
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
