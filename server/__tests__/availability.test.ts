// 純函式 buildSlots 與 helper 單元測試
// 不依賴 Prisma / H3，只測算法本體
import { describe, it, expect } from 'vitest';
import {
  buildSlots,
  composeUtc,
  getWeekdayInTz,
  hhmmToMinutes,
  type BuildSlotsInput,
  type BuildSlotsService
} from '@@/utils/availability';

const TZ = 'Asia/Taipei';

const baseService: BuildSlotsService = {
  bookingMode: 'TIME_SLOT',
  durationMinutes: 60,
  slotIntervalMinutes: 60,
  capacityPerSlot: 1
};

const baseInput = (over: Partial<BuildSlotsInput> = {}): BuildSlotsInput => ({
  service: baseService,
  rules: [],
  override: null,
  isHoliday: false,
  occupiedMap: new Map(),
  timezone: TZ,
  date: '2026-05-18', // 週一
  ...over
});

describe('hhmmToMinutes', () => {
  it('正常 HH:mm 轉分鐘', () => {
    expect(hhmmToMinutes('00:00')).toBe(0);
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(hhmmToMinutes('23:59')).toBe(23 * 60 + 59);
    expect(hhmmToMinutes('24:00')).toBe(24 * 60);
  });

  it('非法格式回 NaN', () => {
    expect(Number.isNaN(hhmmToMinutes('9:30'))).toBe(true);
    expect(Number.isNaN(hhmmToMinutes('25:00'))).toBe(true);
    expect(Number.isNaN(hhmmToMinutes('abc'))).toBe(true);
  });
});

describe('composeUtc', () => {
  it('Asia/Taipei 09:00 對應 UTC 01:00', () => {
    const d = composeUtc('2026-05-18', 9 * 60, TZ);
    expect(d.toISOString()).toBe('2026-05-18T01:00:00.000Z');
  });

  it('Asia/Tokyo 09:00 對應 UTC 00:00', () => {
    const d = composeUtc('2026-05-20', 9 * 60, 'Asia/Tokyo');
    expect(d.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  });
});

describe('getWeekdayInTz', () => {
  it('2026-05-18 (週一) 在 Asia/Taipei 為 1', () => {
    expect(getWeekdayInTz('2026-05-18', TZ)).toBe(1);
  });

  it('2026-05-17 (週日) 在 Asia/Taipei 為 0', () => {
    expect(getWeekdayInTz('2026-05-17', TZ)).toBe(0);
  });

  it('2026-05-23 (週六) 在 Asia/Taipei 為 6', () => {
    expect(getWeekdayInTz('2026-05-23', TZ)).toBe(6);
  });
});

describe('buildSlots — 一般工作日切 slot', () => {
  it('單一規則 09:00–17:00, duration=60, step=60 → 8 個 slot', () => {
    const slots = buildSlots(
      baseInput({
        service: { ...baseService, durationMinutes: 60, slotIntervalMinutes: 60 },
        rules: [{ startTime: '09:00', endTime: '17:00', isActive: true }]
      })
    );
    expect(slots).toHaveLength(8);
    expect(slots[0]).toEqual({
      startAt: '2026-05-18T01:00:00.000Z', // 09:00 TPE = 01:00 UTC
      endAt: '2026-05-18T02:00:00.000Z',
      capacity: 1,
      remaining: 1
    });
    expect(slots[7].startAt).toBe('2026-05-18T08:00:00.000Z'); // 16:00 TPE
    expect(slots[7].endAt).toBe('2026-05-18T09:00:00.000Z'); // 17:00 TPE
  });

  it('duration=60, step=30 → slot 起點 09:00/09:30/.../11:00 (11:30 + 60 > 12:00 捨棄)', () => {
    const slots = buildSlots(
      baseInput({
        service: { ...baseService, durationMinutes: 60, slotIntervalMinutes: 30 },
        rules: [{ startTime: '09:00', endTime: '12:00', isActive: true }]
      })
    );
    expect(slots).toHaveLength(5);
    expect(slots.map((s) => s.startAt)).toEqual([
      '2026-05-18T01:00:00.000Z', // 09:00
      '2026-05-18T01:30:00.000Z', // 09:30
      '2026-05-18T02:00:00.000Z', // 10:00
      '2026-05-18T02:30:00.000Z', // 10:30
      '2026-05-18T03:00:00.000Z' // 11:00
    ]);
  });

  it('isActive=false 規則被忽略', () => {
    const slots = buildSlots(
      baseInput({
        rules: [
          { startTime: '09:00', endTime: '12:00', isActive: false },
          { startTime: '14:00', endTime: '16:00', isActive: true }
        ]
      })
    );
    expect(slots).toHaveLength(2); // 只有 14:00 / 15:00
    expect(slots[0].startAt).toBe('2026-05-18T06:00:00.000Z'); // 14:00 TPE
  });
});

describe('buildSlots — 午休跨段', () => {
  it('兩條規則 09:00–12:00 + 14:00–18:00, duration=30, step=30', () => {
    const slots = buildSlots(
      baseInput({
        service: { ...baseService, durationMinutes: 30, slotIntervalMinutes: 30 },
        rules: [
          { startTime: '14:00', endTime: '18:00', isActive: true }, // 故意倒序，驗排序
          { startTime: '09:00', endTime: '12:00', isActive: true }
        ]
      })
    );
    // 09:00–12:00 → 6 個（09:00, 09:30, 10:00, 10:30, 11:00, 11:30）
    // 14:00–18:00 → 8 個（14:00..17:30）
    expect(slots).toHaveLength(14);
    // 12:00–14:00 之間無 slot
    const between = slots.filter((s) => {
      const t = new Date(s.startAt).getUTCHours();
      return t >= 4 && t < 6; // 12:00-14:00 TPE = 04:00-06:00 UTC
    });
    expect(between).toHaveLength(0);
    // 第一個是 09:00 TPE
    expect(slots[0].startAt).toBe('2026-05-18T01:00:00.000Z');
    // 第 7 個（index 6）是 14:00 TPE
    expect(slots[6].startAt).toBe('2026-05-18T06:00:00.000Z');
  });
});

describe('buildSlots — 整店休假日', () => {
  it('isHoliday=true → 空陣列', () => {
    const slots = buildSlots(
      baseInput({
        rules: [{ startTime: '09:00', endTime: '17:00', isActive: true }],
        isHoliday: true
      })
    );
    expect(slots).toEqual([]);
  });
});

describe('buildSlots — override 取代當週規則', () => {
  it('override 13:00–15:00 取代 09:00–17:00', () => {
    const slots = buildSlots(
      baseInput({
        service: { ...baseService, durationMinutes: 60, slotIntervalMinutes: 60 },
        rules: [{ startTime: '09:00', endTime: '17:00', isActive: true }],
        override: { isClosed: false, startTime: '13:00', endTime: '15:00' }
      })
    );
    expect(slots).toHaveLength(2);
    expect(slots[0].startAt).toBe('2026-05-18T05:00:00.000Z'); // 13:00 TPE
    expect(slots[1].startAt).toBe('2026-05-18T06:00:00.000Z'); // 14:00 TPE
  });

  it('override.isClosed=true → 空陣列', () => {
    const slots = buildSlots(
      baseInput({
        rules: [{ startTime: '09:00', endTime: '17:00', isActive: true }],
        override: { isClosed: true, startTime: null, endTime: null }
      })
    );
    expect(slots).toEqual([]);
  });
});

describe('buildSlots — 容量耗盡', () => {
  it('TIME_CAPACITY capacity=2, 已佔用 2 → remaining=0', () => {
    const occupiedMap = new Map<string, number>();
    occupiedMap.set('2026-05-18T01:00:00.000Z', 2);
    const slots = buildSlots(
      baseInput({
        service: {
          bookingMode: 'TIME_CAPACITY',
          durationMinutes: 60,
          slotIntervalMinutes: 60,
          capacityPerSlot: 2
        },
        rules: [{ startTime: '09:00', endTime: '12:00', isActive: true }],
        occupiedMap
      })
    );
    expect(slots).toHaveLength(3); // 09:00, 10:00, 11:00
    expect(slots[0]).toEqual({
      startAt: '2026-05-18T01:00:00.000Z',
      endAt: '2026-05-18T02:00:00.000Z',
      capacity: 2,
      remaining: 0
    });
    expect(slots[1].remaining).toBe(2); // 未佔用
    expect(slots[2].remaining).toBe(2);
  });

  it('TIME_SLOT 強制 capacity=1，即使 service.capacityPerSlot=5', () => {
    const slots = buildSlots(
      baseInput({
        service: {
          bookingMode: 'TIME_SLOT',
          durationMinutes: 60,
          slotIntervalMinutes: 60,
          capacityPerSlot: 5
        },
        rules: [{ startTime: '09:00', endTime: '10:00', isActive: true }]
      })
    );
    expect(slots[0].capacity).toBe(1);
  });

  it('佔用超過 capacity 時 remaining 不為負', () => {
    const occupiedMap = new Map<string, number>();
    occupiedMap.set('2026-05-18T01:00:00.000Z', 5);
    const slots = buildSlots(
      baseInput({
        service: { ...baseService, capacityPerSlot: 1 },
        rules: [{ startTime: '09:00', endTime: '10:00', isActive: true }],
        occupiedMap
      })
    );
    expect(slots[0].remaining).toBe(0);
  });
});

describe('buildSlots — 多資源 RESOURCE 模式', () => {
  it('RESOURCE 模式 capacity 固定 1，slot 由餵入規則決定（resource A 規則：09:00–11:00）', () => {
    // 此測模擬「外殼已根據 resourceId=A 篩出 A 的規則並查到 A 的當日預約」
    const occupiedMap = new Map<string, number>();
    occupiedMap.set('2026-05-18T01:00:00.000Z', 1); // 09:00 A 已被預約
    const slotsA = buildSlots(
      baseInput({
        service: {
          bookingMode: 'RESOURCE',
          durationMinutes: 60,
          slotIntervalMinutes: 60,
          capacityPerSlot: 1
        },
        rules: [{ startTime: '09:00', endTime: '11:00', isActive: true }],
        occupiedMap
      })
    );
    expect(slotsA).toHaveLength(2);
    expect(slotsA[0].remaining).toBe(0); // 09:00 已滿
    expect(slotsA[1].remaining).toBe(1); // 10:00 仍可

    // resource B 規則完全不同（13:00–15:00），不受 A 的預約影響
    const slotsB = buildSlots(
      baseInput({
        service: {
          bookingMode: 'RESOURCE',
          durationMinutes: 60,
          slotIntervalMinutes: 60,
          capacityPerSlot: 1
        },
        rules: [{ startTime: '13:00', endTime: '15:00', isActive: true }],
        occupiedMap: new Map() // B 自己當日無預約
      })
    );
    expect(slotsB).toHaveLength(2);
    expect(slotsB[0].startAt).toBe('2026-05-18T05:00:00.000Z'); // 13:00 TPE
    expect(slotsB.every((s) => s.remaining === 1)).toBe(true);
  });
});

describe('buildSlots — 邊界與防禦', () => {
  it('規則為空 → 空陣列', () => {
    const slots = buildSlots(baseInput({ rules: [] }));
    expect(slots).toEqual([]);
  });

  it('endTime <= startTime → 該規則跳過', () => {
    const slots = buildSlots(
      baseInput({
        rules: [
          { startTime: '12:00', endTime: '12:00', isActive: true },
          { startTime: '09:00', endTime: '10:00', isActive: true }
        ]
      })
    );
    expect(slots).toHaveLength(1);
  });

  it('duration=0 防禦回空陣列', () => {
    const slots = buildSlots(
      baseInput({
        service: { ...baseService, durationMinutes: 0 },
        rules: [{ startTime: '09:00', endTime: '17:00', isActive: true }]
      })
    );
    expect(slots).toEqual([]);
  });

  it('step=0 防禦回空陣列', () => {
    const slots = buildSlots(
      baseInput({
        service: { ...baseService, slotIntervalMinutes: 0 },
        rules: [{ startTime: '09:00', endTime: '17:00', isActive: true }]
      })
    );
    expect(slots).toEqual([]);
  });
});
