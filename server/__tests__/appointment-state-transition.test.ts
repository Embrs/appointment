// checkAppointmentTransitionable 純函式單元測試
// 覆蓋四種情境：CONFIRMED+過去 / CONFIRMED+未來 / 已 CANCELED / 跨 merchantId
import { describe, it, expect } from 'vitest';
import {
  checkAppointmentTransitionable,
  MSG_APPOINTMENT_NOT_CONFIRMED,
  MSG_APPOINTMENT_NOT_YET_STARTED
} from '@@/utils/booking';

const NOW = new Date('2026-05-18T10:00:00.000Z');
const PAST = new Date('2026-05-18T09:00:00.000Z');
const FUTURE = new Date('2026-05-18T11:00:00.000Z');
const M1 = 'merchant-1';
const M2 = 'merchant-2';

describe('checkAppointmentTransitionable', () => {
  it('CONFIRMED + 過去時間 + 同商家 → ok', () => {
    const result = checkAppointmentTransitionable(
      { merchantId: M1, status: 'CONFIRMED', startAt: PAST },
      M1,
      NOW
    );
    expect(result.ok).toBe(true);
  });

  it('CONFIRMED + 未來時間 → bad_request MSG_APPOINTMENT_NOT_YET_STARTED', () => {
    const result = checkAppointmentTransitionable(
      { merchantId: M1, status: 'CONFIRMED', startAt: FUTURE },
      M1,
      NOW
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('bad_request');
      if (result.kind === 'bad_request') {
        expect(result.message).toBe(MSG_APPOINTMENT_NOT_YET_STARTED);
      }
    }
  });

  it('CANCELED + 過去時間 → bad_request MSG_APPOINTMENT_NOT_CONFIRMED', () => {
    const result = checkAppointmentTransitionable(
      { merchantId: M1, status: 'CANCELED', startAt: PAST },
      M1,
      NOW
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('bad_request');
      if (result.kind === 'bad_request') {
        expect(result.message).toBe(MSG_APPOINTMENT_NOT_CONFIRMED);
      }
    }
  });

  it('COMPLETED 預約 → bad_request MSG_APPOINTMENT_NOT_CONFIRMED', () => {
    const result = checkAppointmentTransitionable(
      { merchantId: M1, status: 'COMPLETED', startAt: PAST },
      M1,
      NOW
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === 'bad_request') {
      expect(result.message).toBe(MSG_APPOINTMENT_NOT_CONFIRMED);
    }
  });

  it('NO_SHOW 預約 → bad_request MSG_APPOINTMENT_NOT_CONFIRMED', () => {
    const result = checkAppointmentTransitionable(
      { merchantId: M1, status: 'NO_SHOW', startAt: PAST },
      M1,
      NOW
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === 'bad_request') {
      expect(result.message).toBe(MSG_APPOINTMENT_NOT_CONFIRMED);
    }
  });

  it('跨 merchantId → not_found（不洩漏存在性）', () => {
    const result = checkAppointmentTransitionable(
      { merchantId: M1, status: 'CONFIRMED', startAt: PAST },
      M2,
      NOW
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('not_found');
    }
  });

  it('appointment 為 null（查無資料）→ not_found', () => {
    const result = checkAppointmentTransitionable(null, M1, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('not_found');
    }
  });

  it('時間優先序：跨商家比狀態 / 時間先檢查', () => {
    // 跨商家 + 未來時間 + 非 CONFIRMED → 仍回 not_found（避免存在性洩漏）
    const result = checkAppointmentTransitionable(
      { merchantId: M1, status: 'CANCELED', startAt: FUTURE },
      M2,
      NOW
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('not_found');
    }
  });

  it('邊界：startAt 等於 now → 視為已到（可標記）', () => {
    const result = checkAppointmentTransitionable(
      { merchantId: M1, status: 'CONFIRMED', startAt: NOW },
      M1,
      NOW
    );
    expect(result.ok).toBe(true);
  });
});
