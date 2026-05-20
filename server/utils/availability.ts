// 可預約時段算法
// 規範：算法本體（buildSlots）為純函式，不依賴 Prisma / H3，可在 vitest 直接構造資料驗證
//       外殼 computeAvailability 負責查 DB、拼資料、呼叫純函式、回傳結果或 ApiResponse 錯誤
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { prisma } from './prisma';
import {
  badRequestError,
  notFoundError,
  successResponse,
  type ApiResponse,
  type I18nMessage
} from './response';
import type { H3Event } from 'h3';

dayjs.extend(utc);
dayjs.extend(timezone);

// ====== 對外型別 ======

/**
 * Slot 不可選原因。僅在 `remaining=0` 時設置；可選時為 undefined。
 * - `past`     已過時段（startAt < now）
 * - `taken`    TIME_SLOT/RESOURCE 模式 capacity=1 被佔
 * - `capacity` TIME_CAPACITY 模式 occupied >= capacityPerSlot
 * - `closed`   邊界保留值（整日 closed 仍回 []，不在此使用）
 * - `holiday`  邊界保留值（整日 holiday 仍回 []，不在此使用）
 * - `inactive` 邊界保留值（資源停用時整日不回 slot，不在此使用）
 */
export type SlotUnavailableReason =
  | 'past'
  | 'taken'
  | 'capacity'
  | 'closed'
  | 'holiday'
  | 'inactive';

export interface Slot {
  /** ISO UTC 時間字串 */
  startAt: string;
  endAt: string;
  capacity: number;
  remaining: number;
  /** 不可選原因；可選時為 undefined */
  reason?: SlotUnavailableReason;
}

export interface ComputeAvailabilityParams {
  slug: string;
  serviceId: string;
  resourceId?: string;
  /** YYYY-MM-DD（商家時區下的當日） */
  date: string;
}

export interface ComputeAvailabilityOk {
  ok: true;
  timezone: string;
  date: string;
  slots: Slot[];
}

export interface ComputeAvailabilityFail {
  ok: false;
  response: ApiResponse<Record<string, never>>;
}

// ====== 純函式輸入型別 ======

export interface BuildSlotsService {
  bookingMode: 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'QUEUE';
  durationMinutes: number;
  slotIntervalMinutes: number;
  capacityPerSlot: number;
}

export interface BuildSlotsRule {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isActive: boolean;
}

export interface BuildSlotsOverride {
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface BuildSlotsInput {
  service: BuildSlotsService;
  rules: BuildSlotsRule[];
  override: BuildSlotsOverride | null;
  isHoliday: boolean;
  /** key = slot.startAt.toISOString()，value = 已佔用人數 */
  occupiedMap: Map<string, number>;
  timezone: string;
  /** YYYY-MM-DD（商家時區） */
  date: string;
  /** 用於判定 `reason='past'` 的時間基準；外殼預設傳 new Date()，測試可注入 */
  now?: Date;
}

// ====== Helpers（可單測） ======

/** `HH:mm` → 分鐘數（0–1440）；格式錯回 NaN */
export const hhmmToMinutes = (hhmm: string): number => {
  const m = /^([0-2]\d):([0-5]\d)$/.exec(hhmm);
  if (!m) return Number.NaN;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 24 || (h === 24 && mm > 0)) return Number.NaN;
  return h * 60 + mm;
};

/** 在指定時區把 `date` 當天 `minutes` 分鐘的時刻轉成 UTC Date */
export const composeUtc = (date: string, minutes: number, tz: string): Date => {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const hhStr = hh.toString().padStart(2, '0');
  const mmStr = mm.toString().padStart(2, '0');
  return dayjs.tz(`${date}T${hhStr}:${mmStr}:00`, tz).toDate();
};

/** 在指定時區下取得 `date` 是星期幾（0=日 ... 6=六） */
export const getWeekdayInTz = (date: string, tz: string): number => {
  return dayjs.tz(`${date}T00:00:00`, tz).day();
};

/** 該日在 merchant 時區下的 UTC 起點與終點（半開區間 [start, end)） */
export const getDayRangeUtc = (date: string, tz: string): { start: Date; end: Date } => {
  const start = dayjs.tz(`${date}T00:00:00`, tz);
  return { start: start.toDate(), end: start.add(1, 'day').toDate() };
};

// ====== 純函式：buildSlots ======

export const buildSlots = (input: BuildSlotsInput): Slot[] => {
  const { service, rules, override, isHoliday, occupiedMap, timezone: tz, date, now } = input;

  // 整店休假 → 空
  if (isHoliday) return [];

  // override 取代當週規則
  let intervals: Array<{ start: string; end: string }>;
  if (override) {
    if (override.isClosed) return [];
    if (!override.startTime || !override.endTime) return [];
    intervals = [{ start: override.startTime, end: override.endTime }];
  } else {
    intervals = rules
      .filter((r) => r.isActive)
      .map((r) => ({ start: r.startTime, end: r.endTime }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  if (intervals.length === 0) return [];

  const step = service.slotIntervalMinutes;
  const duration = service.durationMinutes;
  if (!Number.isFinite(step) || step <= 0) return [];
  if (!Number.isFinite(duration) || duration <= 0) return [];

  const capacity = service.bookingMode === 'TIME_CAPACITY' ? service.capacityPerSlot : 1;
  const isCapacityMode = service.bookingMode === 'TIME_CAPACITY';
  const nowMs = now ? now.getTime() : Number.NEGATIVE_INFINITY;

  const slots: Slot[] = [];
  for (const interval of intervals) {
    const intervalStart = hhmmToMinutes(interval.start);
    const intervalEnd = hhmmToMinutes(interval.end);
    if (!Number.isFinite(intervalStart) || !Number.isFinite(intervalEnd)) continue;
    if (intervalEnd <= intervalStart) continue;
    for (let m = intervalStart; m + duration <= intervalEnd; m += step) {
      const startAt = composeUtc(date, m, tz);
      const endAt = composeUtc(date, m + duration, tz);
      const startIso = startAt.toISOString();
      const occupied = occupiedMap.get(startIso) ?? 0;
      const remaining = Math.max(0, capacity - occupied);

      let reason: SlotUnavailableReason | undefined;
      if (startAt.getTime() < nowMs) {
        reason = 'past';
      } else if (remaining <= 0) {
        reason = isCapacityMode ? 'capacity' : 'taken';
      }

      slots.push({
        startAt: startIso,
        endAt: endAt.toISOString(),
        capacity,
        // 已過時段視為不可選；其他模式下 remaining 計算結果即為實際剩餘
        remaining: reason === 'past' ? 0 : remaining,
        ...(reason ? { reason } : {})
      });
    }
  }
  return slots;
};

// ====== 三語訊息 ======

const MSG_QUEUE_NOT_SUPPORTED: I18nMessage = {
  zh_tw: 'QUEUE 服務請使用號碼牌介面',
  en: 'Use queue ticket interface for QUEUE services',
  ja: 'QUEUEサービスは整理券インターフェースをご利用ください'
};

const MSG_RESOURCE_REQUIRED: I18nMessage = {
  zh_tw: 'RESOURCE 模式服務必須指定 resourceId',
  en: 'resourceId is required for RESOURCE mode service',
  ja: 'RESOURCEモードのサービスにはresourceIdが必要です'
};

const MSG_RESOURCE_NOT_ALLOWED: I18nMessage = {
  zh_tw: '此服務模式不接受 resourceId',
  en: 'resourceId is not allowed for this service mode',
  ja: 'このサービスモードではresourceIdは指定できません'
};

const MSG_RESOURCE_NOT_LINKED: I18nMessage = {
  zh_tw: '此資源未綁定該服務',
  en: 'Resource is not linked to this service',
  ja: 'リソースがこのサービスにリンクされていません'
};

const MSG_DATE_INVALID: I18nMessage = {
  zh_tw: '日期格式錯誤（YYYY-MM-DD）',
  en: 'Invalid date format (YYYY-MM-DD)',
  ja: '日付形式が無効です（YYYY-MM-DD）'
};

// ====== 外殼：computeAvailability ======

export const computeAvailability = async (
  event: H3Event | undefined,
  params: ComputeAvailabilityParams
): Promise<ComputeAvailabilityOk | ComputeAvailabilityFail> => {
  // 驗 date 格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    return { ok: false, response: badRequestError(event, MSG_DATE_INVALID) };
  }
  if (!dayjs(params.date, 'YYYY-MM-DD', true).isValid()) {
    return { ok: false, response: badRequestError(event, MSG_DATE_INVALID) };
  }

  // 取商家
  const merchant = await prisma.merchant.findFirst({
    where: { slug: params.slug, status: 'ACTIVE', deletedAt: null },
    select: { id: true, timezone: true }
  });
  if (!merchant) return { ok: false, response: notFoundError(event) };

  // 取服務
  const service = await prisma.service.findFirst({
    where: {
      id: params.serviceId,
      merchantId: merchant.id,
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true,
      bookingMode: true,
      durationMinutes: true,
      slotIntervalMinutes: true,
      capacityPerSlot: true
    }
  });
  if (!service) return { ok: false, response: notFoundError(event) };

  // bookingMode 與 resourceId 一致性
  if (service.bookingMode === 'QUEUE') {
    return { ok: false, response: badRequestError(event, MSG_QUEUE_NOT_SUPPORTED) };
  }
  if (service.bookingMode === 'RESOURCE' && !params.resourceId) {
    return { ok: false, response: badRequestError(event, MSG_RESOURCE_REQUIRED) };
  }
  if (service.bookingMode !== 'RESOURCE' && params.resourceId) {
    return { ok: false, response: badRequestError(event, MSG_RESOURCE_NOT_ALLOWED) };
  }

  // RESOURCE：驗 ServiceResource 關聯 + Resource 啟用
  if (service.bookingMode === 'RESOURCE' && params.resourceId) {
    const link = await prisma.serviceResource.findUnique({
      where: { serviceId_resourceId: { serviceId: service.id, resourceId: params.resourceId } }
    });
    if (!link) return { ok: false, response: badRequestError(event, MSG_RESOURCE_NOT_LINKED) };
    const resource = await prisma.resource.findFirst({
      where: { id: params.resourceId, merchantId: merchant.id, isActive: true, deletedAt: null }
    });
    if (!resource) return { ok: false, response: badRequestError(event, MSG_RESOURCE_NOT_LINKED) };
  }

  const tz = merchant.timezone;
  const weekday = getWeekdayInTz(params.date, tz);
  const scope = service.bookingMode === 'RESOURCE' ? 'RESOURCE' : 'MERCHANT';

  // 查每週規則
  const rules = await prisma.scheduleRule.findMany({
    where: {
      merchantId: merchant.id,
      scope,
      resourceId: scope === 'RESOURCE' ? params.resourceId! : null,
      weekday,
      isActive: true
    },
    select: { startTime: true, endTime: true, isActive: true }
  });

  // 查當日 override
  const overrideDate = dayjs.tz(`${params.date}T00:00:00`, tz).utc().toDate();
  const overrideRow = await prisma.scheduleOverride.findFirst({
    where: {
      merchantId: merchant.id,
      scope,
      resourceId: scope === 'RESOURCE' ? params.resourceId! : null,
      date: overrideDate
    },
    select: { isClosed: true, startTime: true, endTime: true }
  });

  // 查整店休假
  const holidayRow = await prisma.merchantHoliday.findFirst({
    where: { merchantId: merchant.id, date: overrideDate }
  });

  // 查當日 CONFIRMED 預約
  const { start: dayStart, end: dayEnd } = getDayRangeUtc(params.date, tz);
  const appointments = await prisma.appointment.findMany({
    where: {
      merchantId: merchant.id,
      serviceId: service.id,
      ...(scope === 'RESOURCE' ? { resourceId: params.resourceId! } : {}),
      status: 'CONFIRMED',
      startAt: { gte: dayStart, lt: dayEnd }
    },
    select: { startAt: true }
  });
  const occupiedMap = new Map<string, number>();
  for (const a of appointments) {
    const key = a.startAt.toISOString();
    occupiedMap.set(key, (occupiedMap.get(key) ?? 0) + 1);
  }

  const slots = buildSlots({
    service: {
      bookingMode: service.bookingMode,
      durationMinutes: service.durationMinutes,
      slotIntervalMinutes: service.slotIntervalMinutes,
      capacityPerSlot: service.capacityPerSlot
    },
    rules: rules.map((r) => ({ startTime: r.startTime, endTime: r.endTime, isActive: r.isActive })),
    override: overrideRow
      ? { isClosed: overrideRow.isClosed, startTime: overrideRow.startTime, endTime: overrideRow.endTime }
      : null,
    isHoliday: holidayRow !== null,
    occupiedMap,
    timezone: tz,
    date: params.date,
    now: new Date()
  });

  return { ok: true, timezone: tz, date: params.date, slots };
};

// 提供 successResponse 包裝以便 handler 直接 return
export const availabilitySuccess = (data: ComputeAvailabilityOk) =>
  successResponse({ timezone: data.timezone, date: data.date, slots: data.slots });
