// 多診間獨立號池：internalCreateTicket 帶不同 resourceId 的型別與行為契約
// 範圍：型別契約 + 廣播 payload 形狀 + 驗證 helper（沿用 queue-internal-create-ticket.test.ts 風格）
// 兩 resource 同 service 同日各自從 1 號起、不互鎖等 DB 行為由 PostgreSQL 唯一鍵 + FOR UPDATE row-level lock 保證，端對端透過 Playwright 驗證
import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  internalCreateTicket,
  validateResourceIdForQueueService,
  type InternalCreateTicketInput,
  type InternalCreateTicketResult,
  type QueueBroadcastPayload,
  type ResourceValidationResult,
  type QueueResource,
  MSG_QUEUE_RESOURCE_REQUIRED,
  MSG_QUEUE_RESOURCE_INVALID
} from '@@/utils/queue';

describe('internalCreateTicket 多 resource 型別契約', () => {
  it('InternalCreateTicketInput.resourceId 必填、值可為 string | null', () => {
    expectTypeOf<InternalCreateTicketInput['resourceId']>().toEqualTypeOf<string | null>();
  });

  it('帶 resourceId=null（單號池）合法', () => {
    const single: InternalCreateTicketInput = {
      merchantId: 'm1',
      serviceId: 's1',
      resourceId: null,
      ticketDate: new Date('2026-05-21'),
      customer: { lastName: '王', title: 'MR', phone: '0912345678' },
      createdByMerchant: false
    };
    expect(single.resourceId).toBeNull();
  });

  it('帶 resourceId=<id>（綁定 resource）合法', () => {
    const multi: InternalCreateTicketInput = {
      merchantId: 'm1',
      serviceId: 's1',
      resourceId: 'res-A',
      ticketDate: new Date('2026-05-21'),
      customer: { lastName: '陳', title: 'MRS', phone: null },
      createdByMerchant: true
    };
    expect(multi.resourceId).toBe('res-A');
  });

  it('成功 result.ticket 帶 resourceId（與 input 對齊）', () => {
    const okWithResource: InternalCreateTicketResult = {
      ok: true,
      ticket: {
        id: 't1',
        ticketNumber: 1,
        ticketDate: new Date('2026-05-21'),
        status: 'WAITING',
        claimToken: 'ABCD2345',
        resourceId: 'res-A'
      },
      currentServing: 0
    };
    const okSinglePool: InternalCreateTicketResult = {
      ok: true,
      ticket: {
        id: 't2',
        ticketNumber: 1,
        ticketDate: new Date('2026-05-21'),
        status: 'WAITING',
        claimToken: 'EFGH6789',
        resourceId: null
      },
      currentServing: 0
    };
    if (okWithResource.ok) expect(okWithResource.ticket.resourceId).toBe('res-A');
    if (okSinglePool.ok) expect(okSinglePool.ticket.resourceId).toBeNull();
  });

  it('export 仍是函式（單一拿號入口）', () => {
    expect(typeof internalCreateTicket).toBe('function');
  });
});

describe('QueueBroadcastPayload resourceId/resourceName 欄位', () => {
  it('帶 resourceId 與 resourceName 為可選欄位（向後相容）', () => {
    const withResource: QueueBroadcastPayload = {
      type: 'TICKET_TAKEN',
      serviceId: 's1',
      resourceId: 'res-A',
      resourceName: 'A 診間',
      ticketNumber: 1,
      timestamp: 1_700_000_000_000
    };
    const singlePool: QueueBroadcastPayload = {
      type: 'CALL_NEXT',
      serviceId: 's1',
      resourceId: null,
      current: 3,
      timestamp: 1_700_000_000_000
    };
    const legacyShape: QueueBroadcastPayload = {
      type: 'TICKET_DONE',
      serviceId: 's1',
      timestamp: 1_700_000_000_000
    };
    expect(withResource.resourceName).toBe('A 診間');
    expect(singlePool.resourceId).toBeNull();
    expect(legacyShape.resourceId).toBeUndefined();
  });
});

describe('validateResourceIdForQueueService 介面契約', () => {
  it('回傳型別為 { ok: true, resource: QueueResource | null } 或 { ok: false, code: REQUIRED | INVALID }', () => {
    expect(typeof validateResourceIdForQueueService).toBe('function');
    const okBound: ResourceValidationResult = {
      ok: true,
      resource: {
        id: 'res-A',
        name: 'A 診間',
        displayOrder: 0,
        isActive: true
      } satisfies QueueResource
    };
    const okSingle: ResourceValidationResult = { ok: true, resource: null };
    const errReq: ResourceValidationResult = { ok: false, code: 'REQUIRED' };
    const errInv: ResourceValidationResult = { ok: false, code: 'INVALID' };
    expect(okBound.ok).toBe(true);
    expect(okSingle.ok).toBe(true);
    if (!errReq.ok) expect(errReq.code).toBe('REQUIRED');
    if (!errInv.ok) expect(errInv.code).toBe('INVALID');
  });
});

describe('resourceId 驗證錯誤三語訊息齊備', () => {
  it.each([
    ['MSG_QUEUE_RESOURCE_REQUIRED', MSG_QUEUE_RESOURCE_REQUIRED],
    ['MSG_QUEUE_RESOURCE_INVALID', MSG_QUEUE_RESOURCE_INVALID]
  ])('%s 三語齊備', (_name, msg) => {
    expect(msg.zh_tw).toBeTruthy();
    expect(msg.en).toBeTruthy();
    expect(msg.ja).toBeTruthy();
  });
});
