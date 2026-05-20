// queue-window.put.ts 的純函式部分單元測試
// 覆蓋 Zod Body 驗證：weekday/HH:mm/maxTickets/isActive；空陣列代表全清除
// 跨商家越權 / 非 QUEUE 服務 / deleteMany+createMany 順序屬於 DB 行為，留待 Playwright 整合驗證
import { describe, it, expect } from 'vitest';
import {
  QueueWindowItemSchema,
  QueueWindowPutBodySchema
} from '@@/utils/queue-window-schema';

describe('QueueWindowItemSchema', () => {
  it('正常格式通過', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 1,
      startTime: '09:00',
      endTime: '18:00',
      maxTickets: 20,
      isActive: true
    });
    expect(r.success).toBe(true);
  });

  it('weekday=0 通過（週日邊界）', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 0,
      startTime: '00:00',
      endTime: '23:59',
      maxTickets: 0,
      isActive: false
    });
    expect(r.success).toBe(true);
  });

  it('weekday=6 通過（週六邊界）', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 6,
      startTime: '09:00',
      endTime: '18:00',
      maxTickets: 50,
      isActive: true
    });
    expect(r.success).toBe(true);
  });

  it('weekday=7 失敗', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 7,
      startTime: '09:00',
      endTime: '18:00',
      maxTickets: 20,
      isActive: true
    });
    expect(r.success).toBe(false);
  });

  it('weekday=-1 失敗', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: -1,
      startTime: '09:00',
      endTime: '18:00',
      maxTickets: 20,
      isActive: true
    });
    expect(r.success).toBe(false);
  });

  it('startTime=24:00 失敗（HH:mm 上限 23:59）', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 1,
      startTime: '24:00',
      endTime: '18:00',
      maxTickets: 20,
      isActive: true
    });
    expect(r.success).toBe(false);
  });

  it('startTime=9:00 失敗（必須兩位數）', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 1,
      startTime: '9:00',
      endTime: '18:00',
      maxTickets: 20,
      isActive: true
    });
    expect(r.success).toBe(false);
  });

  it('maxTickets=-1 失敗', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 1,
      startTime: '09:00',
      endTime: '18:00',
      maxTickets: -1,
      isActive: true
    });
    expect(r.success).toBe(false);
  });

  it('maxTickets 非整數失敗', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 1,
      startTime: '09:00',
      endTime: '18:00',
      maxTickets: 1.5,
      isActive: true
    });
    expect(r.success).toBe(false);
  });

  it('isActive 非 boolean 失敗', () => {
    const r = QueueWindowItemSchema.safeParse({
      weekday: 1,
      startTime: '09:00',
      endTime: '18:00',
      maxTickets: 20,
      isActive: 'true'
    });
    expect(r.success).toBe(false);
  });
});

describe('QueueWindowPutBodySchema', () => {
  it('空 windows 陣列通過（代表全清除）', () => {
    const r = QueueWindowPutBodySchema.safeParse({
      serviceId: 'svc-1',
      windows: []
    });
    expect(r.success).toBe(true);
  });

  it('多筆 window 通過', () => {
    const r = QueueWindowPutBodySchema.safeParse({
      serviceId: 'svc-1',
      windows: [
        { weekday: 1, startTime: '09:00', endTime: '12:00', maxTickets: 10, isActive: true },
        { weekday: 1, startTime: '14:00', endTime: '18:00', maxTickets: 10, isActive: true },
        { weekday: 2, startTime: '09:00', endTime: '18:00', maxTickets: 20, isActive: true }
      ]
    });
    expect(r.success).toBe(true);
  });

  it('serviceId 為空字串失敗', () => {
    const r = QueueWindowPutBodySchema.safeParse({
      serviceId: '',
      windows: []
    });
    expect(r.success).toBe(false);
  });

  it('serviceId 缺失失敗', () => {
    const r = QueueWindowPutBodySchema.safeParse({ windows: [] });
    expect(r.success).toBe(false);
  });

  it('windows 缺失失敗', () => {
    const r = QueueWindowPutBodySchema.safeParse({ serviceId: 'svc-1' });
    expect(r.success).toBe(false);
  });

  it('windows 內部單筆不合法則整體失敗', () => {
    const r = QueueWindowPutBodySchema.safeParse({
      serviceId: 'svc-1',
      windows: [
        { weekday: 1, startTime: '09:00', endTime: '18:00', maxTickets: 10, isActive: true },
        { weekday: 8, startTime: '09:00', endTime: '18:00', maxTickets: 10, isActive: true }
      ]
    });
    expect(r.success).toBe(false);
  });

  it('多餘欄位失敗（strict）', () => {
    const r = QueueWindowPutBodySchema.safeParse({
      serviceId: 'svc-1',
      windows: [],
      extra: 'x'
    });
    expect(r.success).toBe(false);
  });
});
