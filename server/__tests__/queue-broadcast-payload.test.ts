// QueueBroadcastPayload 型別契約：擴充 providerId / providerName 兩個附加欄位
// 行為驗證（providerModeEnabled=false 時兩欄位為 null）由 resolveProviderByResourceMap 短路保證
// 並由 queue-resolve-provider.test.ts 的純函式測試覆蓋；本檔僅守住 broadcast payload 介面
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { QueueBroadcastPayload } from '@@/utils/queue';

describe('QueueBroadcastPayload providerId / providerName', () => {
  it('啟用 Provider 制商家可在 payload 帶兩個欄位', () => {
    const payload: QueueBroadcastPayload = {
      type: 'CALL_NEXT',
      serviceId: 's1',
      resourceId: 'A',
      current: 5,
      servingTicketId: 't1',
      providerId: 'wangDoc',
      providerName: '王醫師',
      timestamp: Date.now()
    };
    expect(payload.providerId).toBe('wangDoc');
    expect(payload.providerName).toBe('王醫師');
  });

  it('未啟用 Provider 制商家兩欄位可為 null（與 helper 短路保持一致）', () => {
    const payload: QueueBroadcastPayload = {
      type: 'CALL_NEXT',
      serviceId: 's1',
      resourceId: 'A',
      current: 5,
      providerId: null,
      providerName: null,
      timestamp: Date.now()
    };
    expect(payload.providerId).toBeNull();
    expect(payload.providerName).toBeNull();
  });

  it('兩欄位皆可省略（舊版前端忽略即可）', () => {
    const payload: QueueBroadcastPayload = {
      type: 'TICKET_TAKEN',
      serviceId: 's1',
      resourceId: 'A',
      ticketNumber: 12,
      timestamp: Date.now()
    };
    expect(payload.providerId).toBeUndefined();
    expect(payload.providerName).toBeUndefined();
  });

  it('型別契約：providerId / providerName 皆為 optional 且允許 null', () => {
    expectTypeOf<QueueBroadcastPayload['providerId']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<QueueBroadcastPayload['providerName']>().toEqualTypeOf<string | null | undefined>();
  });

  it('既有欄位不受影響（type / serviceId / resourceId / timestamp 等）', () => {
    expectTypeOf<QueueBroadcastPayload['type']>().toEqualTypeOf<
      'CALL_NEXT' | 'TICKET_DONE' | 'TICKET_SKIPPED' | 'TICKET_TAKEN'
    >();
    expectTypeOf<QueueBroadcastPayload['serviceId']>().toEqualTypeOf<string>();
    expectTypeOf<QueueBroadcastPayload['timestamp']>().toEqualTypeOf<number>();
  });
});
