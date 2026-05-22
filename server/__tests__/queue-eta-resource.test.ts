// ETA 按 (resourceId) 分群驗證：純函式不感知 resourceId，但 caller 必須按 resource 各自查 counter
// 此測試驗「兩 resource 各自帶不同 counter 與不同 ticket 時，computeTicketEtaMinutes / computeNextWaitMinutes 結果獨立、不交叉污染」
import { describe, it, expect } from 'vitest';
import {
  computeTicketEtaMinutes,
  computeNextWaitMinutes,
  getEffectiveAvgServiceMinutes
} from '@@/utils/queue';

describe('computeTicketEtaMinutes 按 resource 分群獨立', () => {
  const service = { avgServiceMinutes: 10, durationMinutes: 30 };

  it('A 上 ticket 8 + A.counter(5)、avg=10 → 20 分（前面 2 人；不受 B counter 影響）', () => {
    const eta = computeTicketEtaMinutes(
      { ticketNumber: 8, status: 'WAITING' },
      { lastCalledNumber: 5 },
      service
    );
    expect(eta).toBe(20);
  });

  it('B 上 ticket 2 + B.counter(0)（尚未叫過）→ 10 分（前面 1 人）', () => {
    const eta = computeTicketEtaMinutes(
      { ticketNumber: 2, status: 'WAITING' },
      { lastCalledNumber: 0 },
      service
    );
    expect(eta).toBe(10);
  });

  it('若 caller 誤拿 A 的 counter 來算 B 的 ticket，結果會錯——本案需 caller 嚴格按 resource 分群', () => {
    // B.ticketNumber=2、A.counter.lastCalledNumber=5 ⇒ getTicketsAhead 會回 0（B 票號比 A counter 小視為已過）
    // 這個錯誤結果證明 caller 必須按 (resourceId) 查對應 counter
    const wrong = computeTicketEtaMinutes(
      { ticketNumber: 2, status: 'WAITING' },
      { lastCalledNumber: 5 },
      service
    );
    expect(wrong).toBe(0); // 與正確的 10 分不同
  });

  it('CALLED 票一律 0（不論 resource）', () => {
    expect(
      computeTicketEtaMinutes(
        { ticketNumber: 5, status: 'CALLED' },
        { lastCalledNumber: 5 },
        service
      )
    ).toBe(0);
  });

  it('counter=null（該 resource 當日尚無 counter）→ null', () => {
    expect(
      computeTicketEtaMinutes(
        { ticketNumber: 3, status: 'WAITING' },
        null,
        service
      )
    ).toBeNull();
  });
});

describe('computeNextWaitMinutes 按 resource 分群獨立', () => {
  const service = { avgServiceMinutes: 10, durationMinutes: 30 };

  it('A: ticketsTaken=10、lastCalledNumber=5 → waitingCount=5、下一位前面 4 人 → 40 分', () => {
    expect(
      computeNextWaitMinutes({ lastCalledNumber: 5 }, 10, service)
    ).toBe(40);
  });

  it('B: ticketsTaken=2、lastCalledNumber=1 → waitingCount=1、下一位前面 0 人 → 0 分', () => {
    expect(
      computeNextWaitMinutes({ lastCalledNumber: 1 }, 2, service)
    ).toBe(0);
  });

  it('Z: ticketsTaken=0（無人領號）→ 0', () => {
    expect(
      computeNextWaitMinutes({ lastCalledNumber: 0 }, 0, service)
    ).toBe(0);
  });

  it('未綁 resource 的 service：行為與單 resource 一致', () => {
    expect(
      computeNextWaitMinutes({ lastCalledNumber: 3 }, 6, service)
    ).toBe(20); // waitingCount=3、下一位前面 2 人 × 10 = 20
  });
});

describe('avgServiceMinutes effective fallback 對每個 resource 一致', () => {
  it('avgServiceMinutes=null → fallback to durationMinutes 對所有 resource 一致（service 級欄位）', () => {
    const service = { avgServiceMinutes: null, durationMinutes: 20 };
    expect(getEffectiveAvgServiceMinutes(service)).toBe(20);
    // A 與 B 兩 resource 上的 ETA 都該用 20
    expect(
      computeTicketEtaMinutes(
        { ticketNumber: 3, status: 'WAITING' },
        { lastCalledNumber: 1 },
        service
      )
    ).toBe(20);
    expect(
      computeTicketEtaMinutes(
        { ticketNumber: 5, status: 'WAITING' },
        { lastCalledNumber: 2 },
        service
      )
    ).toBe(40);
  });
});
