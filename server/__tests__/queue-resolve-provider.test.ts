// selectProviderEntriesFromSchedule 純函式單元測試
// Override 優先 Rule、多匹配回 null、時段邊界外不命中
import { describe, it, expect } from 'vitest';
import {
  selectProviderEntriesFromSchedule,
  type ProviderScheduleEntry
} from '@@/utils/queue';

const RESOURCE_NULL_KEY = '__null__';

describe('selectProviderEntriesFromSchedule — 基本命中', () => {
  it('Rule 在 09:00-12:00、time=10:30 → 命中', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'p1', startTime: '09:00', endTime: '12:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides: [], rules });
    expect(out.get('A')).toBe('p1');
  });

  it('time=12:00 整點不命中（startTime <= time < endTime）', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'p1', startTime: '09:00', endTime: '12:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '12:00', overrides: [], rules });
    expect(out.has('A')).toBe(false);
  });

  it('time=09:00 整點命中（含 start 邊界）', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'p1', startTime: '09:00', endTime: '12:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '09:00', overrides: [], rules });
    expect(out.get('A')).toBe('p1');
  });

  it('start/end 為 null 視為不命中', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'p1', startTime: null, endTime: '12:00' },
      { resourceId: 'B', providerId: 'p2', startTime: '09:00', endTime: null }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:00', overrides: [], rules });
    expect(out.has('A')).toBe(false);
    expect(out.has('B')).toBe(false);
  });
});

describe('selectProviderEntriesFromSchedule — Override 優先', () => {
  it('Rule 排王醫師、Override 排李醫師 → 採李醫師', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'wang', startTime: '09:00', endTime: '12:00' }
    ];
    const overrides: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'lee', startTime: '10:00', endTime: '12:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides, rules });
    expect(out.get('A')).toBe('lee');
  });

  it('Override 時段不命中時 Rule 仍生效', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'wang', startTime: '09:00', endTime: '12:00' }
    ];
    const overrides: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'lee', startTime: '13:00', endTime: '17:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides, rules });
    expect(out.get('A')).toBe('wang');
  });

  it('Override 命中後即使 Rule 是同一 Provider 也不重複累積', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'wang', startTime: '09:00', endTime: '12:00' }
    ];
    const overrides: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'wang', startTime: '10:00', endTime: '12:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides, rules });
    expect(out.get('A')).toBe('wang'); // 單一命中，非 null
  });
});

describe('selectProviderEntriesFromSchedule — 多匹配回 null', () => {
  it('同 resource 兩 Rule 命中不同 Provider → null', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'wang', startTime: '09:00', endTime: '12:00' },
      { resourceId: 'A', providerId: 'lee', startTime: '10:00', endTime: '11:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides: [], rules });
    expect(out.get('A')).toBeNull();
  });

  it('同 resource 兩 Override 命中不同 Provider → null', () => {
    const overrides: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'wang', startTime: '09:00', endTime: '12:00' },
      { resourceId: 'A', providerId: 'lee', startTime: '10:00', endTime: '11:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides, rules: [] });
    expect(out.get('A')).toBeNull();
  });
});

describe('selectProviderEntriesFromSchedule — 多 resource 各自獨立', () => {
  it('A 命中王、B 命中李、C 多匹配 → 三筆各自結果', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'wang', startTime: '09:00', endTime: '12:00' },
      { resourceId: 'B', providerId: 'lee', startTime: '09:00', endTime: '12:00' },
      { resourceId: 'C', providerId: 'chen', startTime: '09:00', endTime: '12:00' },
      { resourceId: 'C', providerId: 'zhao', startTime: '10:00', endTime: '11:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides: [], rules });
    expect(out.get('A')).toBe('wang');
    expect(out.get('B')).toBe('lee');
    expect(out.get('C')).toBeNull();
  });
});

describe('selectProviderEntriesFromSchedule — null resourceId（未綁診間）', () => {
  it('Rule 排 Provider 未綁診間（resourceId=null）→ 對應 __null__ key', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: null, providerId: 'wang', startTime: '09:00', endTime: '12:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides: [], rules });
    expect(out.get(RESOURCE_NULL_KEY)).toBe('wang');
  });

  it('null resourceId 多 Provider 命中 → __null__ key 對應 null', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: null, providerId: 'wang', startTime: '09:00', endTime: '12:00' },
      { resourceId: null, providerId: 'lee', startTime: '10:00', endTime: '11:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides: [], rules });
    expect(out.get(RESOURCE_NULL_KEY)).toBeNull();
  });
});

describe('selectProviderEntriesFromSchedule — 空輸入', () => {
  it('沒有 Override 也沒有 Rule → 空 Map', () => {
    const out = selectProviderEntriesFromSchedule({ time: '10:30', overrides: [], rules: [] });
    expect(out.size).toBe(0);
  });

  it('全部時段外 → 空 Map', () => {
    const rules: ProviderScheduleEntry[] = [
      { resourceId: 'A', providerId: 'wang', startTime: '09:00', endTime: '12:00' }
    ];
    const out = selectProviderEntriesFromSchedule({ time: '14:00', overrides: [], rules });
    expect(out.size).toBe(0);
  });
});
