// 商家現場代客領號：BodySchema 驗證 + 共用 internalCreateTicket 型別契約
// 範圍：純邏輯單元測試（與 queue-find.test.ts 風格一致）
// Counter `FOR UPDATE` 序列化與唯一鍵防併發由 Postgres 保證，端對端透過 Playwright 驗證
import { describe, it, expect } from 'vitest';
import { BodySchema } from '@@/routes/nuxt-api/queue/create-for-customer.post';
import {
  MSG_NOT_QUEUE_SERVICE,
  MSG_QUEUE_ALREADY_TAKEN,
  MSG_QUEUE_FULL,
  MSG_QUEUE_WINDOW_CLOSED
} from '@@/utils/queue';

describe('create-for-customer BodySchema', () => {
  it('合法輸入（含 phone）通過', () => {
    const r = BodySchema.safeParse({
      serviceId: 'svc-1',
      customer: { lastName: '王', title: 'MR', phone: '0912345678' }
    });
    expect(r.success).toBe(true);
  });

  it('合法輸入（省略 phone）通過', () => {
    const r = BodySchema.safeParse({
      serviceId: 'svc-1',
      customer: { lastName: '陳', title: 'MRS' }
    });
    expect(r.success).toBe(true);
  });

  it('phone 過短拒絕', () => {
    const r = BodySchema.safeParse({
      serviceId: 'svc-1',
      customer: { lastName: '王', title: 'MR', phone: '0912' }
    });
    expect(r.success).toBe(false);
  });

  it('phone 過長拒絕', () => {
    const r = BodySchema.safeParse({
      serviceId: 'svc-1',
      customer: { lastName: '王', title: 'MR', phone: '0'.repeat(21) }
    });
    expect(r.success).toBe(false);
  });

  it('lastName 空字串拒絕', () => {
    const r = BodySchema.safeParse({
      serviceId: 'svc-1',
      customer: { lastName: '', title: 'MR' }
    });
    expect(r.success).toBe(false);
  });

  it('title 非合法 enum 拒絕', () => {
    const r = BodySchema.safeParse({
      serviceId: 'svc-1',
      customer: { lastName: '王', title: 'DR' as never }
    });
    expect(r.success).toBe(false);
  });

  it('缺 serviceId 拒絕', () => {
    const r = BodySchema.safeParse({
      customer: { lastName: '王', title: 'MR' }
    });
    expect(r.success).toBe(false);
  });

  it('多餘欄位被 zod 預設策略容忍', () => {
    const r = BodySchema.safeParse({
      serviceId: 'svc-1',
      customer: { lastName: '王', title: 'MR' },
      extra: 'x'
    });
    expect(r.success).toBe(true);
  });
});

describe('create-for-customer 所用三語訊息齊備', () => {
  it.each([
    ['MSG_NOT_QUEUE_SERVICE', MSG_NOT_QUEUE_SERVICE],
    ['MSG_QUEUE_ALREADY_TAKEN', MSG_QUEUE_ALREADY_TAKEN],
    ['MSG_QUEUE_FULL', MSG_QUEUE_FULL],
    ['MSG_QUEUE_WINDOW_CLOSED', MSG_QUEUE_WINDOW_CLOSED]
  ])('%s 三語齊備', (_name, msg) => {
    expect(msg.zh_tw).toBeTruthy();
    expect(msg.en).toBeTruthy();
    expect(msg.ja).toBeTruthy();
  });
});
