// 號碼牌 ETA 純函式單元測試
// 涵蓋 getTicketsAhead、estimateWaitMinutes、computeTicketEtaMinutes、computeNextWaitMinutes
import { describe, it, expect } from 'vitest';
import {
  estimateWaitMinutes,
  getTicketsAhead,
  computeTicketEtaMinutes,
  computeNextWaitMinutes,
  getEffectiveAvgServiceMinutes,
  buildBroadcastEtaFields
} from '@@/utils/queue';

describe('getTicketsAhead', () => {
  it('票面前 0 人（票號 = lastCalledNumber + 1）→ 0', () => {
    expect(getTicketsAhead({ ticketNumber: 6, status: 'WAITING' }, { lastCalledNumber: 5 })).toBe(0);
  });

  it('票面前 N 人（票號 8、叫到 5）→ 2（不含自己、不含正在被服務的 5 號）', () => {
    expect(getTicketsAhead({ ticketNumber: 8, status: 'WAITING' }, { lastCalledNumber: 5 })).toBe(2);
  });

  it('票面前 1 人（票號 7、叫到 5）→ 1', () => {
    expect(getTicketsAhead({ ticketNumber: 7, status: 'WAITING' }, { lastCalledNumber: 5 })).toBe(1);
  });

  it('CALLED 票一律回 0', () => {
    expect(getTicketsAhead({ ticketNumber: 5, status: 'CALLED' }, { lastCalledNumber: 5 })).toBe(0);
    expect(getTicketsAhead({ ticketNumber: 8, status: 'CALLED' }, { lastCalledNumber: 5 })).toBe(0);
  });

  it('DONE / SKIPPED 票一律回 0', () => {
    expect(getTicketsAhead({ ticketNumber: 3, status: 'DONE' }, { lastCalledNumber: 5 })).toBe(0);
    expect(getTicketsAhead({ ticketNumber: 3, status: 'SKIPPED' }, { lastCalledNumber: 5 })).toBe(0);
  });

  it('尚未開始叫號（lastCalledNumber=0、票號 3）→ 2', () => {
    expect(getTicketsAhead({ ticketNumber: 3, status: 'WAITING' }, { lastCalledNumber: 0 })).toBe(2);
  });

  it('票號小於 lastCalledNumber（被跳過/重複領號）不出現負值', () => {
    expect(getTicketsAhead({ ticketNumber: 3, status: 'WAITING' }, { lastCalledNumber: 5 })).toBe(0);
  });
});

describe('estimateWaitMinutes', () => {
  it('0 人等待 → 0', () => {
    expect(estimateWaitMinutes(0, 15)).toBe(0);
  });

  it('1 人等待 × 15 → 15', () => {
    expect(estimateWaitMinutes(1, 15)).toBe(15);
  });

  it('3 人等待 × 15 → 45', () => {
    expect(estimateWaitMinutes(3, 15)).toBe(45);
  });

  it('avgServiceMinutes=0 一律回 0（不傳遞 NaN/負值）', () => {
    expect(estimateWaitMinutes(5, 0)).toBe(0);
  });

  it('avgServiceMinutes 負數一律回 0', () => {
    expect(estimateWaitMinutes(5, -10)).toBe(0);
  });

  it('waitingAhead 負數一律回 0', () => {
    expect(estimateWaitMinutes(-2, 15)).toBe(0);
  });

  it('小數結果四捨五入為整數', () => {
    expect(estimateWaitMinutes(3, 2.4)).toBe(7); // 7.2 → 7
    expect(estimateWaitMinutes(3, 2.5)).toBe(8); // 7.5 → 8
  });

  it('NaN / Infinity 一律回 0', () => {
    expect(estimateWaitMinutes(NaN, 15)).toBe(0);
    expect(estimateWaitMinutes(5, NaN)).toBe(0);
    expect(estimateWaitMinutes(Infinity, 15)).toBe(0);
  });
});

describe('getEffectiveAvgServiceMinutes', () => {
  it('avgServiceMinutes 為 null 時 fallback 到 durationMinutes', () => {
    expect(getEffectiveAvgServiceMinutes({ avgServiceMinutes: null, durationMinutes: 30 })).toBe(30);
  });

  it('avgServiceMinutes 已設定時使用該值', () => {
    expect(getEffectiveAvgServiceMinutes({ avgServiceMinutes: 15, durationMinutes: 30 })).toBe(15);
  });

  it('avgServiceMinutes=0 視為已設定（回 0；ETA 計算端會視為無效再 clamp）', () => {
    expect(getEffectiveAvgServiceMinutes({ avgServiceMinutes: 0, durationMinutes: 30 })).toBe(0);
  });
});

describe('computeTicketEtaMinutes', () => {
  const service = { avgServiceMinutes: 10, durationMinutes: 30 };

  it('正常 WAITING 票（票號 8、叫到 5、avg=10）→ 20', () => {
    expect(
      computeTicketEtaMinutes({ ticketNumber: 8, status: 'WAITING' }, { lastCalledNumber: 5 }, service)
    ).toBe(20);
  });

  it('counter=null → null（無法估算）', () => {
    expect(
      computeTicketEtaMinutes({ ticketNumber: 8, status: 'WAITING' }, null, service)
    ).toBeNull();
  });

  it('CALLED 票 → 0', () => {
    expect(
      computeTicketEtaMinutes({ ticketNumber: 5, status: 'CALLED' }, { lastCalledNumber: 5 }, service)
    ).toBe(0);
  });

  it('DONE/SKIPPED 票 → 0', () => {
    expect(
      computeTicketEtaMinutes({ ticketNumber: 3, status: 'DONE' }, { lastCalledNumber: 5 }, service)
    ).toBe(0);
  });

  it('service.avgServiceMinutes=null 時 fallback 到 durationMinutes', () => {
    const svc = { avgServiceMinutes: null, durationMinutes: 20 };
    expect(
      computeTicketEtaMinutes({ ticketNumber: 8, status: 'WAITING' }, { lastCalledNumber: 5 }, svc)
    ).toBe(40); // 前面 2 人 × 20 分鐘
  });
});

describe('computeNextWaitMinutes', () => {
  const service = { avgServiceMinutes: 10, durationMinutes: 30 };

  it('counter=null → null', () => {
    expect(computeNextWaitMinutes(null, 0, service)).toBeNull();
  });

  it('waitingCount=0（無人等候）→ 0', () => {
    expect(computeNextWaitMinutes({ lastCalledNumber: 5 }, 5, service)).toBe(0);
  });

  it('waitingCount=5、avg=10 → (5-1) × 10 = 40（下一位前面剩 4 人）', () => {
    expect(computeNextWaitMinutes({ lastCalledNumber: 5 }, 10, service)).toBe(40);
  });

  it('waitingCount=1（只剩下一位）→ 0', () => {
    expect(computeNextWaitMinutes({ lastCalledNumber: 5 }, 6, service)).toBe(0);
  });
});

describe('buildBroadcastEtaFields', () => {
  const service = { avgServiceMinutes: 10, durationMinutes: 30 };

  it('叫號廣播（叫到 5、剩 4 張 WAITING）→ avg=10、next=30', () => {
    expect(buildBroadcastEtaFields({ lastCalledNumber: 5 }, 9, service)).toEqual({
      avgServiceMinutes: 10,
      nextWaitMinutes: 30 // (9-5)=4 waiting → next 前面 3 人 × 10
    });
  });

  it('counter=null → next=null、avg 仍回 effective 值', () => {
    expect(buildBroadcastEtaFields(null, 0, service)).toEqual({
      avgServiceMinutes: 10,
      nextWaitMinutes: null
    });
  });

  it('service.avgServiceMinutes=null 時 fallback 到 durationMinutes', () => {
    const svc = { avgServiceMinutes: null, durationMinutes: 30 };
    expect(buildBroadcastEtaFields({ lastCalledNumber: 5 }, 9, svc)).toEqual({
      avgServiceMinutes: 30,
      nextWaitMinutes: 90 // (9-5)=4 waiting → next 前面 3 人 × 30
    });
  });
});
