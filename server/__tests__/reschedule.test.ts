// resolveRescheduleResource 純函式單元測試
// 涵蓋 4 種 bookingMode 與 requestedResourceId 三種輸入（undefined / null / id）的交叉組合
// DB 依賴的整合行為（衝突排除自身、force 過去時段、雙開保護、advisory lock 串行）
// 由 Playwright 整合測試覆蓋（見 openspec 變更 tasks 11.6–11.9）
import { describe, it, expect } from 'vitest';
import {
  resolveRescheduleResource,
  MSG_QUEUE_NOT_SUPPORTED,
  MSG_RESOURCE_NOT_ALLOWED,
  MSG_RESOURCE_REQUIRED,
  MSG_RESOURCE_NOT_LINKED,
  MSG_RESCHEDULE_NOT_ON_DUTY
} from '@@/utils/booking';

const activeResource = { isActive: true, deletedAt: null };
const inactiveResource = { isActive: false, deletedAt: null };
const deletedResource = { isActive: true, deletedAt: new Date('2026-01-01T00:00:00Z') };

const serviceResources = [
  { resourceId: 'r1', resource: activeResource },
  { resourceId: 'r2', resource: activeResource },
  { resourceId: 'r3-inactive', resource: inactiveResource },
  { resourceId: 'r4-deleted', resource: deletedResource }
];

describe('resolveRescheduleResource', () => {
  describe('TIME_SLOT', () => {
    it('未帶 resourceId 通過 → targetResourceId=null', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'TIME_SLOT',
        currentResourceId: null,
        requestedResourceId: undefined,
        serviceResources
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.targetResourceId).toBeNull();
    });

    it('帶 null 通過 → null', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'TIME_SLOT',
        currentResourceId: null,
        requestedResourceId: null,
        serviceResources
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.targetResourceId).toBeNull();
    });

    it('帶 resourceId 拒絕 → MSG_RESOURCE_NOT_ALLOWED', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'TIME_SLOT',
        currentResourceId: null,
        requestedResourceId: 'r1',
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_RESOURCE_NOT_ALLOWED);
    });
  });

  describe('TIME_CAPACITY', () => {
    it('帶 resourceId 拒絕', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'TIME_CAPACITY',
        currentResourceId: null,
        requestedResourceId: 'r1',
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_RESOURCE_NOT_ALLOWED);
    });
  });

  describe('RESOURCE', () => {
    it('沿用原 resourceId（undefined）', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE',
        currentResourceId: 'r1',
        requestedResourceId: undefined,
        serviceResources
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.targetResourceId).toBe('r1');
    });

    it('換為合法資源（r2）', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE',
        currentResourceId: 'r1',
        requestedResourceId: 'r2',
        serviceResources
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.targetResourceId).toBe('r2');
    });

    it('未綁定該服務的資源 → MSG_RESOURCE_NOT_LINKED', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE',
        currentResourceId: 'r1',
        requestedResourceId: 'r-not-linked',
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_RESOURCE_NOT_LINKED);
    });

    it('傳 null 拒絕（RESOURCE 必須有資源）', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE',
        currentResourceId: 'r1',
        requestedResourceId: null,
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_RESOURCE_REQUIRED);
    });

    it('當前無資源且未送出（不應發生但 defensive） → MSG_RESOURCE_REQUIRED', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE',
        currentResourceId: null,
        requestedResourceId: undefined,
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_RESOURCE_REQUIRED);
    });

    it('指定停用資源 → MSG_RESOURCE_NOT_LINKED', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE',
        currentResourceId: 'r1',
        requestedResourceId: 'r3-inactive',
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_RESOURCE_NOT_LINKED);
    });

    it('指定軟刪除資源 → MSG_RESOURCE_NOT_LINKED', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE',
        currentResourceId: 'r1',
        requestedResourceId: 'r4-deleted',
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_RESOURCE_NOT_LINKED);
    });
  });

  describe('RESOURCE_OPTIONAL', () => {
    it('未帶（undefined）沿用原資源', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE_OPTIONAL',
        currentResourceId: 'r1',
        requestedResourceId: undefined,
        serviceResources
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.targetResourceId).toBe('r1');
    });

    it('帶 null 改為「不指定」', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE_OPTIONAL',
        currentResourceId: 'r1',
        requestedResourceId: null,
        serviceResources
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.targetResourceId).toBeNull();
    });

    it('帶合法 id', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE_OPTIONAL',
        currentResourceId: null,
        requestedResourceId: 'r2',
        serviceResources
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.targetResourceId).toBe('r2');
    });

    it('帶停用資源拒絕', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'RESOURCE_OPTIONAL',
        currentResourceId: null,
        requestedResourceId: 'r3-inactive',
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_RESOURCE_NOT_LINKED);
    });
  });

  describe('QUEUE', () => {
    it('一律拒絕（QUEUE 不進 Appointment 表）', () => {
      const r = resolveRescheduleResource({
        bookingMode: 'QUEUE',
        currentResourceId: null,
        requestedResourceId: undefined,
        serviceResources
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(MSG_QUEUE_NOT_SUPPORTED);
    });
  });
});

describe('MSG_RESCHEDULE_NOT_ON_DUTY 三語完整', () => {
  it('三語都不為空', () => {
    expect(MSG_RESCHEDULE_NOT_ON_DUTY.zh_tw).toBeTruthy();
    expect(MSG_RESCHEDULE_NOT_ON_DUTY.en).toBeTruthy();
    expect(MSG_RESCHEDULE_NOT_ON_DUTY.ja).toBeTruthy();
  });
});
