// merchant/[id].put.ts UpdateSchema 單元測試
// 覆蓋 nullable 字串欄位的空字串視為 null、非法格式仍拒絕、合法字串原樣通過
import { describe, it, expect } from 'vitest';
import { UpdateSchema } from '@@/routes/nuxt-api/merchant/[id].put';

describe('UpdateSchema — nullable 字串欄位空字串視為 null', () => {
  it('六個 nullable 欄位皆送 "" 時 parse 通過、值為 null', () => {
    const r = UpdateSchema.safeParse({
      description: '',
      logoUrl: '',
      coverUrl: '',
      contactPhone: '',
      contactEmail: '',
      address: ''
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.description).toBeNull();
    expect(r.data.logoUrl).toBeNull();
    expect(r.data.coverUrl).toBeNull();
    expect(r.data.contactPhone).toBeNull();
    expect(r.data.contactEmail).toBeNull();
    expect(r.data.address).toBeNull();
  });

  it('純空白字串也視為 null', () => {
    const r = UpdateSchema.safeParse({
      contactEmail: '   ',
      description: '\t\n'
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.contactEmail).toBeNull();
    expect(r.data.description).toBeNull();
  });

  it('未帶 key 與帶 null 都通過、解析後分別為 undefined 與 null', () => {
    const r1 = UpdateSchema.safeParse({});
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.contactEmail).toBeUndefined();

    const r2 = UpdateSchema.safeParse({ contactEmail: null });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.contactEmail).toBeNull();
  });

  it('啟用 Provider Mode 與空字串欄位混合送出仍 parse 通過', () => {
    const r = UpdateSchema.safeParse({
      providerModeEnabled: true,
      providerLabel: { zh: '醫師' },
      contactEmail: '',
      contactPhone: '',
      logoUrl: '',
      coverUrl: '',
      address: '',
      description: ''
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.providerModeEnabled).toBe(true);
    expect(r.data.providerLabel).toEqual({ zh: '醫師' });
    expect(r.data.contactEmail).toBeNull();
  });
});

describe('UpdateSchema — 非空字串仍走原驗證', () => {
  it('合法 email 通過', () => {
    const r = UpdateSchema.safeParse({ contactEmail: 'admin@demo.com' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.contactEmail).toBe('admin@demo.com');
  });

  it('非法 email 拒絕', () => {
    const r = UpdateSchema.safeParse({ contactEmail: 'not-an-email' });
    expect(r.success).toBe(false);
  });

  it('description 超過 max(1000) 拒絕', () => {
    const r = UpdateSchema.safeParse({ description: 'x'.repeat(1001) });
    expect(r.success).toBe(false);
  });

  it('description 剛好 1000 通過', () => {
    const r = UpdateSchema.safeParse({ description: 'x'.repeat(1000) });
    expect(r.success).toBe(true);
  });

  it('contactPhone 非空字串通過、會被 trim', () => {
    const r = UpdateSchema.safeParse({ contactPhone: '  0912345678  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.contactPhone).toBe('0912345678');
  });
});

describe('UpdateSchema — 其他既有規則回歸', () => {
  it('slug 符合 pattern 通過', () => {
    const r = UpdateSchema.safeParse({ slug: 'demo-clinic' });
    expect(r.success).toBe(true);
  });

  it('slug 包含大寫拒絕', () => {
    const r = UpdateSchema.safeParse({ slug: 'Demo-Clinic' });
    expect(r.success).toBe(false);
  });

  it('cancelPolicy mode=cutoff 缺 hours 拒絕', () => {
    const r = UpdateSchema.safeParse({ cancelPolicy: { mode: 'cutoff' } });
    expect(r.success).toBe(false);
  });

  it('cancelPolicy mode=free 通過', () => {
    const r = UpdateSchema.safeParse({ cancelPolicy: { mode: 'free' } });
    expect(r.success).toBe(true);
  });

  it('maxActiveAppointmentsPerCustomer 範圍 1-99 通過、0 與 100 拒絕', () => {
    expect(UpdateSchema.safeParse({ maxActiveAppointmentsPerCustomer: 5 }).success).toBe(true);
    expect(UpdateSchema.safeParse({ maxActiveAppointmentsPerCustomer: 0 }).success).toBe(false);
    expect(UpdateSchema.safeParse({ maxActiveAppointmentsPerCustomer: 100 }).success).toBe(false);
    expect(UpdateSchema.safeParse({ maxActiveAppointmentsPerCustomer: 3.5 }).success).toBe(false);
  });
});
