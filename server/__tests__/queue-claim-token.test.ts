// claim token + /public/queue/claim/[token] 端點：純邏輯單元測試
// 範圍：generateClaimToken alphabet/長度、InternalCreateTicketResult 型別契約、模組存在性
// 端到端（含 prisma + rateLimit + IP 桶）由 Playwright 顧客流程驗證
import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  generateClaimToken,
  internalCreateTicket,
  type InternalCreateTicketResult
} from '@@/utils/queue';

describe('generateClaimToken', () => {
  it('回傳 8 碼字串', () => {
    const t = generateClaimToken();
    expect(typeof t).toBe('string');
    expect(t.length).toBe(8);
  });

  it('alphabet 排除易混淆字元 0/O/o/1/I/l', () => {
    // 蒙地卡羅：跑 200 次蒐集字元集，確保不含禁止字元
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      for (const ch of generateClaimToken()) seen.add(ch);
    }
    for (const banned of ['0', 'O', 'o', '1', 'I', 'l']) {
      expect(seen.has(banned)).toBe(false);
    }
  });

  it('字元集僅落在預期 alphabet', () => {
    const allowed = new Set('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz');
    for (let i = 0; i < 50; i += 1) {
      for (const ch of generateClaimToken()) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it('連續呼叫產生不同 token（碰撞期望值極低）', () => {
    const a = generateClaimToken();
    const b = generateClaimToken();
    const c = generateClaimToken();
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe('InternalCreateTicketResult 含 claimToken', () => {
  it('成功分支 ticket 含 claimToken: string', () => {
    const ok: InternalCreateTicketResult = {
      ok: true,
      ticket: {
        id: 't1',
        ticketNumber: 6,
        ticketDate: new Date('2026-05-21'),
        status: 'WAITING',
        claimToken: 'K7m4Tp9Q'
      },
      currentServing: 5
    };
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.ticket.claimToken).toBe('K7m4Tp9Q');
      expectTypeOf<typeof ok.ticket.claimToken>().toEqualTypeOf<string>();
    }
  });

  it('失敗分支不帶 claimToken', () => {
    const full: InternalCreateTicketResult = { ok: false, reason: 'FULL' };
    expect('ticket' in full).toBe(false);
  });
});

describe('internalCreateTicket export 不變', () => {
  it('仍是 server/utils/queue.ts 唯一對外的拿號入口', () => {
    expect(typeof internalCreateTicket).toBe('function');
  });
});
