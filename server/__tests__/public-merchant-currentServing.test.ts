// projectQueueServingPublic 純函式單元測試
// 對應 /public/m/[slug] endpoint 中的 currentServing/waitingCount/ticketsTaken 組裝邏輯
import { describe, it, expect } from 'vitest';
import { projectQueueServingPublic } from '@@/utils/queue';

describe('projectQueueServingPublic', () => {
  it('含 counter（已發 10、叫到 5）→ currentServing=5、waiting=5、taken=10', () => {
    const r = projectQueueServingPublic({ lastCalledNumber: 5, lastTicketNumber: 10 });
    expect(r.currentServing).toBe(5);
    expect(r.ticketsTaken).toBe(10);
    expect(r.waitingCount).toBe(5);
  });

  it('counter=null（當日尚無人領號）→ 三項全 0', () => {
    const r = projectQueueServingPublic(null);
    expect(r.currentServing).toBe(0);
    expect(r.ticketsTaken).toBe(0);
    expect(r.waitingCount).toBe(0);
  });

  it('counter=undefined → 三項全 0', () => {
    const r = projectQueueServingPublic(undefined);
    expect(r.currentServing).toBe(0);
    expect(r.ticketsTaken).toBe(0);
    expect(r.waitingCount).toBe(0);
  });

  it('已發未叫（taken=3、called=0）→ currentServing=0、waiting=3', () => {
    const r = projectQueueServingPublic({ lastCalledNumber: 0, lastTicketNumber: 3 });
    expect(r.currentServing).toBe(0);
    expect(r.ticketsTaken).toBe(3);
    expect(r.waitingCount).toBe(3);
  });

  it('叫號等於發號（taken=5、called=5）→ waiting=0', () => {
    const r = projectQueueServingPublic({ lastCalledNumber: 5, lastTicketNumber: 5 });
    expect(r.waitingCount).toBe(0);
  });

  it('資料異常 called > taken → waiting 至少 0 不為負', () => {
    const r = projectQueueServingPublic({ lastCalledNumber: 10, lastTicketNumber: 5 });
    expect(r.waitingCount).toBe(0);
  });
});
