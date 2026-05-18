// 為 Change 7 號碼牌驗證準備測試資料：
// - 把 demo-clinic-kbpw 商家的 OWNER 密碼重設為 Password123（測試環境）
// - 為其 QUEUE 服務 補 7 天 24h 全開的 QueueWindow（如已存在則更新）
// - 清空當日舊號碼牌（避免重複領號錯誤）
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const p = new PrismaClient();
const slug = 'demo-clinic-kbpw';
const password = 'Password123';

const merchant = await p.merchant.findUnique({ where: { slug } });
if (!merchant) throw new Error('merchant not found');

// 1. 重設 OWNER 密碼
const owner = await p.merchantUser.findFirst({ where: { merchantId: merchant.id, role: 'OWNER' } });
if (owner) {
  await p.merchantUser.update({
    where: { id: owner.id },
    data: { passwordHash: await bcrypt.hash(password, 10), isActive: true }
  });
  console.log('OWNER_RESET ok:', owner.email);
}

// 2. 取 QUEUE 服務
const services = await p.service.findMany({
  where: { merchantId: merchant.id, bookingMode: 'QUEUE', deletedAt: null }
});
console.log('QUEUE_SERVICES count:', services.length);

// 3. 為每個 QUEUE 服務建 7 天的 00:00-23:59 QueueWindow
for (const s of services) {
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const existing = await p.queueWindow.findFirst({
      where: { merchantId: merchant.id, serviceId: s.id, weekday }
    });
    const data = {
      merchantId: merchant.id,
      serviceId: s.id,
      weekday,
      startTime: '00:00',
      endTime: '23:59',
      maxTickets: 0,
      isActive: true
    };
    if (existing) {
      await p.queueWindow.update({ where: { id: existing.id }, data });
    } else {
      await p.queueWindow.create({ data });
    }
  }
  console.log('WINDOWS_SET for service', s.id);

  // 4. 清空今日（merchant timezone）的舊 ticket & counter
  const tz = merchant.timezone || 'Asia/Taipei';
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const ticketDate = new Date(`${dateStr}T00:00:00.000Z`);

  await p.queueTicket.deleteMany({
    where: { merchantId: merchant.id, serviceId: s.id, ticketDate }
  });
  await p.queueCounter.deleteMany({
    where: { merchantId: merchant.id, serviceId: s.id, counterDate: ticketDate }
  });
  console.log('TICKETS_CLEARED for service', s.id, 'date', dateStr);
}

console.log('DONE: slug=' + slug + ' email=' + (owner?.email ?? 'n/a') + ' password=' + password);
await p.$disconnect();
