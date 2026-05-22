// 守衛純函式單元測試：evaluateMerchantSession / evaluateAdminSession
// 覆蓋 spec auth-flow「JWT 守衛資料庫存在性驗證」Requirement 的核心判斷邏輯；
// requireMerchant / requireAdmin 的 IO（prisma.findUnique、unauthorizedError）由
// Playwright 實機驗收覆蓋，純函式這層保證決策正確。
import { describe, it, expect, vi } from 'vitest';
// auth.ts top-level 會 import './prisma'，建構 PrismaClient 雖是 lazy 但仍需有效；
// 測試僅關心純函式行為，所以 stub 掉 prisma module 避免測試環境連線資料庫
// vi.mock 由 vitest hoist 到 import 之前生效；ESLint import/first 看不出 hoist，因此於下方 import 行 disable
vi.mock('@@/utils/prisma', () => ({ prisma: {} }));
// eslint-disable-next-line import/first
import {
  evaluateMerchantSession,
  evaluateAdminSession,
  type AuthPayload
} from '@@/utils/auth';

const M1 = 'merchant-1';
const M2 = 'merchant-2';
const U1 = 'user-1';
const A1 = 'admin-1';

const merchantPayload: AuthPayload = { type: 'merchant', sub: U1, merchantId: M1, role: 'OWNER' };
const adminPayload: AuthPayload = { type: 'admin', sub: A1 };

const validMerchantUser = {
  isActive: true,
  deletedAt: null,
  merchantId: M1,
  merchant: { status: 'ACTIVE', deletedAt: null }
};

const validAdmin = { isActive: true, deletedAt: null };

describe('evaluateMerchantSession', () => {
  it('payload 有效 + user 存在/啟用 + Merchant ACTIVE → ok', () => {
    const r = evaluateMerchantSession(merchantPayload, validMerchantUser);
    expect(r.ok).toBe(true);
  });

  it('無 payload（無 token）→ no-token，不使用會話失效訊息', () => {
    const r = evaluateMerchantSession(null, null);
    expect(r).toEqual({ ok: false, reason: 'no-token', useExpiredMsg: false });
  });

  it('payload type 非 merchant → no-token', () => {
    const r = evaluateMerchantSession({ ...adminPayload }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-token');
  });

  it('payload 缺 merchantId → no-token', () => {
    const r = evaluateMerchantSession({ type: 'merchant', sub: U1 }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-token');
  });

  it('options.role=OWNER 但 payload.role=STAFF → wrong-role，不使用會話失效訊息', () => {
    const r = evaluateMerchantSession(
      { ...merchantPayload, role: 'STAFF' },
      validMerchantUser,
      { role: 'OWNER' }
    );
    expect(r).toEqual({ ok: false, reason: 'wrong-role', useExpiredMsg: false });
  });

  it('user 不存在（reseed 後 sub 已不在 DB）→ no-user，使用會話失效訊息', () => {
    const r = evaluateMerchantSession(merchantPayload, null);
    expect(r).toEqual({ ok: false, reason: 'no-user', useExpiredMsg: true });
  });

  it('user 軟刪除（deletedAt 非 null）→ no-user', () => {
    const r = evaluateMerchantSession(merchantPayload, {
      ...validMerchantUser,
      deletedAt: new Date()
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('no-user');
      expect(r.useExpiredMsg).toBe(true);
    }
  });

  it('user isActive=false → no-user', () => {
    const r = evaluateMerchantSession(merchantPayload, { ...validMerchantUser, isActive: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-user');
  });

  it('user.merchantId 不等於 payload.merchantId → no-user', () => {
    const r = evaluateMerchantSession(merchantPayload, { ...validMerchantUser, merchantId: M2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-user');
  });

  it('Merchant 不存在（user.merchant=null）→ merchant-deleted', () => {
    const r = evaluateMerchantSession(merchantPayload, { ...validMerchantUser, merchant: null });
    expect(r).toEqual({ ok: false, reason: 'merchant-deleted', useExpiredMsg: true });
  });

  it('Merchant 軟刪除 → merchant-deleted', () => {
    const r = evaluateMerchantSession(merchantPayload, {
      ...validMerchantUser,
      merchant: { status: 'ACTIVE', deletedAt: new Date() }
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('merchant-deleted');
  });

  it('Merchant SUSPENDED → merchant-not-active', () => {
    const r = evaluateMerchantSession(merchantPayload, {
      ...validMerchantUser,
      merchant: { status: 'SUSPENDED', deletedAt: null }
    });
    expect(r).toEqual({ ok: false, reason: 'merchant-not-active', useExpiredMsg: true });
  });

  it('Merchant PENDING → merchant-not-active', () => {
    const r = evaluateMerchantSession(merchantPayload, {
      ...validMerchantUser,
      merchant: { status: 'PENDING', deletedAt: null }
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('merchant-not-active');
  });

  it('Merchant REJECTED → merchant-not-active', () => {
    const r = evaluateMerchantSession(merchantPayload, {
      ...validMerchantUser,
      merchant: { status: 'REJECTED', deletedAt: null }
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('merchant-not-active');
  });
});

describe('evaluateAdminSession', () => {
  it('payload 有效 + admin 存在/啟用 → ok', () => {
    const r = evaluateAdminSession(adminPayload, validAdmin);
    expect(r.ok).toBe(true);
  });

  it('無 payload → no-token', () => {
    const r = evaluateAdminSession(null, null);
    expect(r).toEqual({ ok: false, reason: 'no-token', useExpiredMsg: false });
  });

  it('payload type 非 admin → no-token', () => {
    const r = evaluateAdminSession(merchantPayload, validAdmin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-token');
  });

  it('admin 不存在（reseed 後 sub 已不在 DB）→ no-user，使用會話失效訊息', () => {
    const r = evaluateAdminSession(adminPayload, null);
    expect(r).toEqual({ ok: false, reason: 'no-user', useExpiredMsg: true });
  });

  it('admin 軟刪除 → no-user', () => {
    const r = evaluateAdminSession(adminPayload, { isActive: true, deletedAt: new Date() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-user');
  });

  it('admin isActive=false → no-user', () => {
    const r = evaluateAdminSession(adminPayload, { isActive: false, deletedAt: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-user');
  });
});
