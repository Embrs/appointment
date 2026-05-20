// RESOURCE_OPTIONAL auto-assign 純函式測試
// 只測 pickByLoadBalance 排序邏輯；對 DB 的依賴在 booking.ts 整合測試覆蓋
import { describe, it, expect } from 'vitest';
import { pickByLoadBalance, buildAutoAssignLockKey, buildLockKey } from '@@/utils/booking';

describe('pickByLoadBalance', () => {
  it('空候選回 null', () => {
    expect(pickByLoadBalance([])).toBeNull();
  });

  it('單一候選直接回該 id', () => {
    expect(pickByLoadBalance([{ rid: 'r1', count: 5 }])).toBe('r1');
  });

  it('選 count 最小者', () => {
    expect(
      pickByLoadBalance([
        { rid: 'r1', count: 5 },
        { rid: 'r2', count: 2 },
        { rid: 'r3', count: 8 }
      ])
    ).toBe('r2');
  });

  it('count 相同時 tie-break 取 id 升序最小', () => {
    expect(
      pickByLoadBalance([
        { rid: 'r3', count: 0 },
        { rid: 'r1', count: 0 },
        { rid: 'r2', count: 0 }
      ])
    ).toBe('r1');
  });

  it('count 相同時 cuid 排序確定（lexicographic）', () => {
    expect(
      pickByLoadBalance([
        { rid: 'cuid_abc', count: 1 },
        { rid: 'cuid_aab', count: 1 }
      ])
    ).toBe('cuid_aab');
  });

  it('不會改動原陣列', () => {
    const input = [
      { rid: 'r3', count: 5 },
      { rid: 'r1', count: 2 }
    ];
    pickByLoadBalance(input);
    expect(input[0]).toEqual({ rid: 'r3', count: 5 });
    expect(input[1]).toEqual({ rid: 'r1', count: 2 });
  });
});

describe('Advisory lock keys', () => {
  it('buildLockKey 帶 resourceId', () => {
    const k = buildLockKey('m1', 'r1', '2026-05-22T01:00:00.000Z');
    expect(k).toBe('appt:m1:r1:2026-05-22T01:00:00.000Z');
  });

  it('buildLockKey 不帶 resourceId 用 "null" placeholder', () => {
    const k = buildLockKey('m1', null, '2026-05-22T01:00:00.000Z');
    expect(k).toBe('appt:m1:null:2026-05-22T01:00:00.000Z');
  });

  it('buildAutoAssignLockKey 用 serviceId 與 buildLockKey 不衝突', () => {
    const auto = buildAutoAssignLockKey('m1', 's1', '2026-05-22T01:00:00.000Z');
    const single = buildLockKey('m1', 's1', '2026-05-22T01:00:00.000Z');
    expect(auto).toBe('appt-auto:m1:s1:2026-05-22T01:00:00.000Z');
    // 前綴不同，hash 後在 advisory_lock 也不會碰撞
    expect(auto).not.toBe(single);
  });
});
