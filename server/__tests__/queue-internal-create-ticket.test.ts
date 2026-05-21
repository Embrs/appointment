// internalCreateTicket 共用拿號核心：型別契約 + 模組級存在性測試
// 範圍：型別與 module 介面（如 queue-find.test.ts 風格）
// Counter `FOR UPDATE` 並發序列化由 Postgres 保證，端對端 Playwright 驗證
import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  internalCreateTicket,
  type InternalCreateTicketInput,
  type InternalCreateTicketResult
} from '@@/utils/queue';

describe('internalCreateTicket export', () => {
  it('是 server/utils/queue.ts 唯一對外的拿號入口', () => {
    expect(typeof internalCreateTicket).toBe('function');
  });
});

describe('InternalCreateTicketInput 型別契約', () => {
  it('phone 必須為 string | null（公開端傳 string、商家代建可傳 null）', () => {
    const publicCase: InternalCreateTicketInput = {
      merchantId: 'm1',
      serviceId: 's1',
      ticketDate: new Date('2026-05-21'),
      customer: { lastName: '王', title: 'MR', phone: '0912345678' },
      createdByMerchant: false,
      maxTickets: 0
    };
    const walkInNoPhone: InternalCreateTicketInput = {
      merchantId: 'm1',
      serviceId: 's1',
      ticketDate: new Date('2026-05-21'),
      customer: { lastName: '陳', title: 'MRS', phone: null },
      createdByMerchant: true
    };
    expect(publicCase.customer.phone).toBe('0912345678');
    expect(walkInNoPhone.customer.phone).toBeNull();
    expectTypeOf<InternalCreateTicketInput['customer']['phone']>().toEqualTypeOf<string | null>();
  });

  it('createdByMerchant 區分票券來源', () => {
    expectTypeOf<InternalCreateTicketInput['createdByMerchant']>().toEqualTypeOf<boolean>();
  });
});

describe('InternalCreateTicketResult 型別契約', () => {
  it('成功分支含 ticket + currentServing', () => {
    const ok: InternalCreateTicketResult = {
      ok: true,
      ticket: {
        id: 't1',
        ticketNumber: 6,
        ticketDate: new Date('2026-05-21'),
        status: 'WAITING'
      },
      currentServing: 5
    };
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.ticket.ticketNumber).toBe(6);
  });

  it('失敗分支限定 reason ∈ FULL | ALREADY_TAKEN', () => {
    const full: InternalCreateTicketResult = { ok: false, reason: 'FULL' };
    const dup: InternalCreateTicketResult = {
      ok: false,
      reason: 'ALREADY_TAKEN',
      existingTicketId: 't1'
    };
    expect(full.ok).toBe(false);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.reason).toBe('ALREADY_TAKEN');
  });
});
