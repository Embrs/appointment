// POST /nuxt-api/queue/[id]/assign-resource 端點：模組與型別契約測試
// 行為驗證（DB 改派、廣播、撞號 409）需要真實 DB，由 Playwright（§12 範圍）覆蓋
// 此處用 vitest 守住型別契約與訊息常數
import { describe, it, expect, expectTypeOf } from 'vitest';
import handler from '@@/routes/nuxt-api/queue/[id]/assign-resource.post';
import {
  MSG_QUEUE_INVALID_STATE,
  MSG_QUEUE_NUMBER_TAKEN,
  MSG_QUEUE_RESOURCE_INVALID
} from '@@/utils/queue';

describe('assign-resource endpoint export', () => {
  it('export 是 h3 event handler 函式', () => {
    expect(typeof handler).toBe('function');
  });
});

describe('改派相關 i18n 訊息常數', () => {
  it('MSG_QUEUE_INVALID_STATE 三語齊全', () => {
    expect(MSG_QUEUE_INVALID_STATE.zh_tw).toContain('無法');
    expect(MSG_QUEUE_INVALID_STATE.en.length).toBeGreaterThan(0);
    expect(MSG_QUEUE_INVALID_STATE.ja.length).toBeGreaterThan(0);
  });

  it('MSG_QUEUE_NUMBER_TAKEN 三語齊全', () => {
    expect(MSG_QUEUE_NUMBER_TAKEN.zh_tw).toContain('號碼');
    expect(MSG_QUEUE_NUMBER_TAKEN.en.length).toBeGreaterThan(0);
    expect(MSG_QUEUE_NUMBER_TAKEN.ja.length).toBeGreaterThan(0);
  });

  it('MSG_QUEUE_RESOURCE_INVALID 已存在（沿用本 change 既有定義）', () => {
    expect(MSG_QUEUE_RESOURCE_INVALID.zh_tw.length).toBeGreaterThan(0);
  });
});

describe('AssignResourceQueue 前端 API 型別契約', () => {
  it('Params / Res 結構', () => {
    expectTypeOf<AssignResourceQueueParams>().toEqualTypeOf<{
      id: string;
      resourceId: string;
    }>();
    expectTypeOf<AssignResourceQueueRes>().toMatchTypeOf<{
      ok: boolean;
      noChange?: boolean;
      ticketId?: string;
      ticketNumber?: number;
      fromResourceId?: string | null;
      toResourceId?: string;
      toResourceName?: string;
    }>();
  });
});
