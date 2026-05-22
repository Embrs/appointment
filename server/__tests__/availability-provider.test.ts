// Provider 排班分支：純函式覆蓋
// computeAvailability 的 Provider 分支將 PROVIDER scope 的 rules / override / 衝堂資料
// 餵給共用的 buildSlots 純函式。本測試覆蓋「Provider 衝堂 occupiedMap」與「Provider 特定日請假」
// 兩個關鍵情境；分支 dispatch 與 DB 整合層由 Playwright（section 14）覆蓋。
import { describe, it, expect } from 'vitest';
import { buildSlots, composeUtc, type BuildSlotsInput, type Slot } from '@@/utils/availability';

const TZ = 'Asia/Taipei';

const providerService = {
  bookingMode: 'TIME_SLOT' as const,
  durationMinutes: 60,
  slotIntervalMinutes: 60,
  capacityPerSlot: 1
};

const baseInput = (over: Partial<BuildSlotsInput> = {}): BuildSlotsInput => ({
  service: providerService,
  rules: [],
  override: null,
  isHoliday: false,
  occupiedMap: new Map(),
  timezone: TZ,
  date: '2026-05-18',
  ...over
});

describe('Provider 排班 happy path', () => {
  it('週一 09:00–12:00 切出 3 個 slot', () => {
    const slots = buildSlots(
      baseInput({
        rules: [{ startTime: '09:00', endTime: '12:00', isActive: true }]
      })
    );
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.remaining)).toEqual([1, 1, 1]);
    expect(slots.every((s) => s.reason === undefined)).toBe(true);
  });
});

describe('Provider 同時段衝堂 → reason=taken', () => {
  it('Provider 在 09:00 有 1 筆 CONFIRMED Appointment，09:00 slot reason=taken', () => {
    const taken = composeUtc('2026-05-18', 9 * 60, TZ).toISOString();
    const occupiedMap = new Map<string, number>([[taken, 1]]);
    const slots = buildSlots(
      baseInput({
        rules: [{ startTime: '09:00', endTime: '12:00', isActive: true }],
        occupiedMap
      })
    );
    expect(slots[0]).toMatchObject({ remaining: 0, reason: 'taken' });
    expect(slots[1].remaining).toBe(1);
    expect(slots[1].reason).toBeUndefined();
    expect(slots[2].remaining).toBe(1);
    expect(slots[2].reason).toBeUndefined();
  });
});

describe('Provider 特定日請假（override.isClosed=true）', () => {
  it('整天無 slot', () => {
    const slots = buildSlots(
      baseInput({
        rules: [{ startTime: '09:00', endTime: '12:00', isActive: true }],
        override: { isClosed: true, startTime: null, endTime: null }
      })
    );
    expect(slots).toEqual([] as Slot[]);
  });
});

describe('Provider 特定日換時段（override 取代）', () => {
  it('原 09–12 規則被 13–15 override 取代', () => {
    const slots = buildSlots(
      baseInput({
        rules: [{ startTime: '09:00', endTime: '12:00', isActive: true }],
        override: { isClosed: false, startTime: '13:00', endTime: '15:00' }
      })
    );
    expect(slots).toHaveLength(2); // 13:00, 14:00
    expect(slots[0].startAt).toBe(composeUtc('2026-05-18', 13 * 60, TZ).toISOString());
    expect(slots[1].startAt).toBe(composeUtc('2026-05-18', 14 * 60, TZ).toISOString());
  });
});

describe('整店休假凌駕 Provider 排班', () => {
  it('isHoliday=true 即使 Provider 排班存在仍回空', () => {
    const slots = buildSlots(
      baseInput({
        rules: [{ startTime: '09:00', endTime: '12:00', isActive: true }],
        isHoliday: true
      })
    );
    expect(slots).toEqual([] as Slot[]);
  });
});
