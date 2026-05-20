// 顧客預約上限：純函式單元測試
// checkBookingLimit（活動筆數與上限比較）、buildBookingLimitWhere（Prisma 查詢條件結構）
// 跨商家獨立 / 過去 CONFIRMED 排除 / 非 CONFIRMED 排除 / byMerchant 略過
import { describe, it, expect } from 'vitest';
import {
  buildBookingLimitWhere,
  checkBookingLimit,
  normalizePhone
} from '@@/utils/booking';

const NOW = new Date('2026-05-18T10:00:00.000Z');
const M1 = 'merchant-1';
const M2 = 'merchant-2';
const PHONE = '0912345678';

describe('checkBookingLimit', () => {
  it('activeCount < maxLimit → 允許', () => {
    expect(checkBookingLimit({ activeCount: 3, maxLimit: 5 }).allowed).toBe(true);
  });

  it('activeCount === maxLimit → 拒絕（>= 達上限）', () => {
    expect(checkBookingLimit({ activeCount: 5, maxLimit: 5 }).allowed).toBe(false);
  });

  it('activeCount > maxLimit → 拒絕', () => {
    expect(checkBookingLimit({ activeCount: 6, maxLimit: 5 }).allowed).toBe(false);
  });

  it('byMerchant=true → 永遠允許（即便已達上限）', () => {
    expect(checkBookingLimit({ activeCount: 99, maxLimit: 5, byMerchant: true }).allowed).toBe(true);
  });

  it('byMerchant=false → 與不傳一致', () => {
    expect(checkBookingLimit({ activeCount: 5, maxLimit: 5, byMerchant: false }).allowed).toBe(false);
    expect(checkBookingLimit({ activeCount: 4, maxLimit: 5, byMerchant: false }).allowed).toBe(true);
  });

  it('maxLimit=1（嚴格模式）邊界', () => {
    expect(checkBookingLimit({ activeCount: 0, maxLimit: 1 }).allowed).toBe(true);
    expect(checkBookingLimit({ activeCount: 1, maxLimit: 1 }).allowed).toBe(false);
  });
});

describe('buildBookingLimitWhere', () => {
  it('回傳含 merchantId / status=CONFIRMED / startAt.gte=now', () => {
    const where = buildBookingLimitWhere(M1, PHONE, NOW);
    expect(where.merchantId).toBe(M1);
    expect(where.status).toBe('CONFIRMED');
    expect(where.startAt.gte).toBe(NOW);
  });

  it('phone 自動 normalize（去除空白與連字號）', () => {
    const where1 = buildBookingLimitWhere(M1, '0912-345-678', NOW);
    const where2 = buildBookingLimitWhere(M1, '0912 345 678', NOW);
    const where3 = buildBookingLimitWhere(M1, '0912345678', NOW);
    expect(where1.customerPhone).toBe('0912345678');
    expect(where2.customerPhone).toBe('0912345678');
    expect(where3.customerPhone).toBe('0912345678');
    expect(where1.customerPhone).toBe(where2.customerPhone);
    expect(where2.customerPhone).toBe(where3.customerPhone);
  });

  it('跨商家獨立：merchantId 不同的 where 條件互不相干', () => {
    const w1 = buildBookingLimitWhere(M1, PHONE, NOW);
    const w2 = buildBookingLimitWhere(M2, PHONE, NOW);
    expect(w1.merchantId).not.toBe(w2.merchantId);
  });

  it('startAt.gte 預設 = new Date()（不傳 now 時）', () => {
    const before = Date.now();
    const where = buildBookingLimitWhere(M1, PHONE);
    const after = Date.now();
    expect(where.startAt.gte.getTime()).toBeGreaterThanOrEqual(before);
    expect(where.startAt.gte.getTime()).toBeLessThanOrEqual(after);
  });

  it('status 鎖死為 CONFIRMED（不含 CANCELED / COMPLETED / NO_SHOW）', () => {
    const where = buildBookingLimitWhere(M1, PHONE, NOW);
    // 結構上只有 CONFIRMED；Prisma count 在 DB 層才會排除其他狀態
    expect(where.status).toBe('CONFIRMED');
  });
});

describe('normalizePhone 與上限互動', () => {
  it('輸入不同格式但正規化後相同 → where 條件等價', () => {
    const formats = ['0912-345-678', '0912 345 678', '0912345678', ' 0912-345 678 '];
    const normalized = formats.map(normalizePhone);
    expect(new Set(normalized).size).toBe(1);
  });
});
