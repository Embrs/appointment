// 商家叫號（call-next）多 resource 行為：BodySchema 接受 resourceId、廣播 payload 帶分群欄位、ETA 按 resource 分群推進
// 範圍：型別與 broadcast payload 形狀（沿用 queue-internal-create-ticket.test.ts 風格）
// (s, A) 與 (s, B) FOR UPDATE rows 不互鎖 由 PostgreSQL 唯一鍵 + row-level lock 保證，端對端透過 Playwright 驗證
import { describe, it, expect } from 'vitest';
import {
  type QueueBroadcastPayload,
  buildBroadcastEtaFields
} from '@@/utils/queue';

describe('call-next 多 resource 廣播 payload', () => {
  it('CALL_NEXT 廣播帶 resourceId / resourceName / current / avgServiceMinutes / nextWaitMinutes', () => {
    const payload: QueueBroadcastPayload = {
      type: 'CALL_NEXT',
      serviceId: 's1',
      resourceId: 'res-A',
      resourceName: 'A 診間',
      current: 6,
      servingTicketId: 't-6',
      servingCustomerLastName: '王',
      servingCustomerTitle: 'MR',
      avgServiceMinutes: 10,
      nextWaitMinutes: 20,
      timestamp: 1_700_000_000_000
    };
    expect(payload.resourceId).toBe('res-A');
    expect(payload.resourceName).toBe('A 診間');
    expect(payload.current).toBe(6);
    expect(payload.nextWaitMinutes).toBe(20);
  });

  it('未綁 resource 的 service 廣播：resourceId=null、無 resourceName', () => {
    const payload: QueueBroadcastPayload = {
      type: 'CALL_NEXT',
      serviceId: 's2',
      resourceId: null,
      current: 1,
      servingTicketId: 't-1',
      avgServiceMinutes: 30,
      nextWaitMinutes: 0,
      timestamp: 1_700_000_000_000
    };
    expect(payload.resourceId).toBeNull();
    expect(payload.resourceName).toBeUndefined();
  });
});

describe('call-next ETA 按 resource 分群推進', () => {
  it('A 與 B 兩 resource 同 service avgServiceMinutes=10，叫號後各自 nextWaitMinutes 獨立', () => {
    const service = { avgServiceMinutes: 10, durationMinutes: 30 };
    // A 叫完 ticket 6 後：剩 WAITING 票 7、8、9（3 人），下一位前面 2 人 ⇒ 20 分鐘
    const aFields = buildBroadcastEtaFields(
      { lastCalledNumber: 6 },
      9,
      service
    );
    // B 叫完 ticket 1 後：剩 WAITING 票 2（1 人），下一位前面 0 人 ⇒ 0 分鐘
    const bFields = buildBroadcastEtaFields(
      { lastCalledNumber: 1 },
      2,
      service
    );
    expect(aFields.avgServiceMinutes).toBe(10);
    expect(aFields.nextWaitMinutes).toBe(20);
    expect(bFields.avgServiceMinutes).toBe(10);
    expect(bFields.nextWaitMinutes).toBe(0);
  });

  it('counter null（該 resource 當日尚無人叫號）→ nextWaitMinutes=null', () => {
    const fields = buildBroadcastEtaFields(
      null,
      0,
      { avgServiceMinutes: 15, durationMinutes: 30 }
    );
    expect(fields.nextWaitMinutes).toBeNull();
    expect(fields.avgServiceMinutes).toBe(15);
  });
});
