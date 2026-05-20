// FindQueueTicket endpoint：純邏輯單元測試
// 範圍：FindBodySchema 驗證、MSG 常數齊備、模糊判斷分支
// 端到端（含 prisma + rateLimit）由 Playwright 顧客流程驗證
import { describe, it, expect } from 'vitest';
import {
  MSG_QUEUE_FIND_AMBIGUOUS,
  MSG_QUEUE_FIND_INVALID,
  MSG_QUEUE_FIND_NOT_FOUND
} from '@@/utils/queue';
import { FindBodySchema } from '@@/routes/nuxt-api/public/queue/find.post';

describe('FindBodySchema', () => {
  it('合法輸入通過', () => {
    const r = FindBodySchema.safeParse({ slug: 'demo', serviceId: 'svc-1', phoneLast4: '1234' });
    expect(r.success).toBe(true);
  });

  it('phoneLast4 非 4 碼數字 → 失敗', () => {
    expect(FindBodySchema.safeParse({ slug: 'demo', serviceId: 'svc', phoneLast4: '12' }).success).toBe(false);
    expect(FindBodySchema.safeParse({ slug: 'demo', serviceId: 'svc', phoneLast4: '12345' }).success).toBe(false);
    expect(FindBodySchema.safeParse({ slug: 'demo', serviceId: 'svc', phoneLast4: 'abcd' }).success).toBe(false);
    expect(FindBodySchema.safeParse({ slug: 'demo', serviceId: 'svc', phoneLast4: '12a4' }).success).toBe(false);
  });

  it('slug 空字串 / 超長 → 失敗', () => {
    expect(FindBodySchema.safeParse({ slug: '', serviceId: 'svc', phoneLast4: '1234' }).success).toBe(false);
    expect(FindBodySchema.safeParse({ slug: 'a'.repeat(65), serviceId: 'svc', phoneLast4: '1234' }).success).toBe(false);
  });

  it('serviceId 空字串 → 失敗', () => {
    expect(FindBodySchema.safeParse({ slug: 'demo', serviceId: '', phoneLast4: '1234' }).success).toBe(false);
  });

  it('缺欄位 → 失敗', () => {
    expect(FindBodySchema.safeParse({ slug: 'demo', phoneLast4: '1234' }).success).toBe(false);
    expect(FindBodySchema.safeParse({ serviceId: 'svc', phoneLast4: '1234' }).success).toBe(false);
    expect(FindBodySchema.safeParse({ slug: 'demo', serviceId: 'svc' }).success).toBe(false);
  });

  it('多餘欄位被 zod 預設策略容忍', () => {
    const r = FindBodySchema.safeParse({ slug: 'demo', serviceId: 'svc', phoneLast4: '1234', extra: 'x' });
    expect(r.success).toBe(true);
  });
});

describe('MSG_QUEUE_FIND_*', () => {
  it('三語齊備', () => {
    for (const msg of [MSG_QUEUE_FIND_AMBIGUOUS, MSG_QUEUE_FIND_INVALID, MSG_QUEUE_FIND_NOT_FOUND]) {
      expect(msg.zh_tw).toBeTruthy();
      expect(msg.en).toBeTruthy();
      expect(msg.ja).toBeTruthy();
    }
  });

  it('三組訊息彼此不同', () => {
    expect(MSG_QUEUE_FIND_AMBIGUOUS.zh_tw).not.toBe(MSG_QUEUE_FIND_INVALID.zh_tw);
    expect(MSG_QUEUE_FIND_AMBIGUOUS.zh_tw).not.toBe(MSG_QUEUE_FIND_NOT_FOUND.zh_tw);
    expect(MSG_QUEUE_FIND_INVALID.zh_tw).not.toBe(MSG_QUEUE_FIND_NOT_FOUND.zh_tw);
  });
});
