// 預約建立／取消的共用 helper
// 規範：advisory lock 在事務內取；重檢容量後 createMany；錯誤一律 return（不 throw）
import type { Prisma, PrismaClient } from '@prisma/client';
import type { H3Event } from 'h3';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { prisma } from './prisma';
import { hhmmToMinutes } from './availability';
import {
  badRequestError,
  conflictError,
  notFoundError,
  type ApiResponse,
  type I18nMessage
} from './response';

dayjs.extend(utc);
dayjs.extend(timezone);

// ====== 三語訊息 ======

export const MSG_SLOT_TAKEN: I18nMessage = {
  zh_tw: '該時段已被預約',
  en: 'This time slot has been taken',
  ja: 'この時間帯は予約済みです'
};

export const MSG_PAST_SLOT: I18nMessage = {
  zh_tw: '已過期的時段不可預約',
  en: 'Cannot book past time slot',
  ja: '過去の時間帯は予約できません'
};

export const MSG_RESOURCE_REQUIRED: I18nMessage = {
  zh_tw: 'RESOURCE 模式服務必須指定資源',
  en: 'Resource is required for RESOURCE mode',
  ja: 'RESOURCEモードではリソースが必要です'
};

export const MSG_RESOURCE_NOT_ALLOWED: I18nMessage = {
  zh_tw: '此服務模式不接受指定資源',
  en: 'Resource is not allowed for this service mode',
  ja: 'このサービスモードではリソースは指定できません'
};

export const MSG_QUEUE_NOT_SUPPORTED: I18nMessage = {
  zh_tw: 'QUEUE 服務請使用號碼牌介面',
  en: 'Use queue ticket interface for QUEUE services',
  ja: 'QUEUEサービスは整理券インターフェースをご利用ください'
};

export const MSG_RESOURCE_NOT_LINKED: I18nMessage = {
  zh_tw: '此資源未綁定該服務',
  en: 'Resource is not linked to this service',
  ja: 'リソースがこのサービスにリンクされていません'
};

export const MSG_CANCEL_TOO_LATE: I18nMessage = {
  zh_tw: '已超過取消期限，請聯絡商家',
  en: 'Cancellation deadline passed, please contact merchant',
  ja: 'キャンセル期限を過ぎています。店舗にご連絡ください'
};

export const MSG_APPOINTMENT_NOT_FOUND: I18nMessage = {
  zh_tw: '查無此預約',
  en: 'Appointment not found',
  ja: '予約が見つかりません'
};

export const MSG_APPOINTMENT_ALREADY_CANCELED: I18nMessage = {
  zh_tw: '此預約已取消',
  en: 'Appointment already canceled',
  ja: '予約はすでにキャンセル済みです'
};

export const MSG_APPOINTMENT_NOT_CONFIRMED: I18nMessage = {
  zh_tw: '只有已確認的預約可標記完成或未到',
  en: 'Only confirmed appointments can be marked completed or no-show',
  ja: '確認済みの予約のみ完了または不在を記録できます'
};

export const MSG_APPOINTMENT_NOT_YET_STARTED: I18nMessage = {
  zh_tw: '預約時間尚未開始，無法標記完成或未到',
  en: 'Appointment has not started yet, cannot mark completed or no-show',
  ja: '予約時間が開始されていないため、完了または不在を記録できません'
};

export const MSG_PROVIDER_REQUIRED: I18nMessage = {
  zh_tw: '請先選擇服務人員',
  en: 'Please select a provider',
  ja: 'スタッフを選択してください'
};

export const MSG_PROVIDER_NOT_FOR_SERVICE: I18nMessage = {
  zh_tw: '該服務人員不提供此服務',
  en: 'This provider does not offer this service',
  ja: 'このスタッフはこのサービスを提供していません'
};

export const MSG_PROVIDER_INACTIVE: I18nMessage = {
  zh_tw: '該服務人員已停用',
  en: 'This provider is inactive',
  ja: 'このスタッフは停止中です'
};

export const MSG_PROVIDER_TAKEN: I18nMessage = {
  zh_tw: '該服務人員此時段已被預約',
  en: 'This provider is already booked at this time',
  ja: 'このスタッフはこの時間帯すでに予約済みです'
};

export const MSG_BOOKING_LIMIT_EXCEEDED: I18nMessage = {
  zh_tw: '您在本商家的預約已達上限，請取消舊預約後再試',
  en: 'You have reached the booking limit at this merchant, please cancel an existing booking and try again',
  ja: 'この店舗での予約数が上限に達しました。既存の予約をキャンセルしてから再度お試しください'
};

// ====== 狀態流轉守衛（純函式，供 endpoint + 測試共用） ======

export interface TransitionableAppointment {
  merchantId: string;
  status: string;
  startAt: Date;
}

export type TransitionCheckResult =
  | { ok: true }
  | { ok: false; kind: 'not_found' }
  | { ok: false; kind: 'bad_request'; message: I18nMessage };

/**
 * 檢查商家是否可對該預約執行「標記完成」或「標記未到」。
 * - 預約不存在 / 不屬於該商家 → not_found（呼叫端回 404，避免洩漏存在性）
 * - status 非 CONFIRMED → bad_request: MSG_APPOINTMENT_NOT_CONFIRMED
 * - startAt 未過 → bad_request: MSG_APPOINTMENT_NOT_YET_STARTED
 */
export const checkAppointmentTransitionable = (
  appointment: TransitionableAppointment | null,
  merchantId: string,
  now: Date = new Date()
): TransitionCheckResult => {
  if (!appointment || appointment.merchantId !== merchantId) {
    return { ok: false, kind: 'not_found' };
  }
  if (appointment.startAt.getTime() > now.getTime()) {
    return { ok: false, kind: 'bad_request', message: MSG_APPOINTMENT_NOT_YET_STARTED };
  }
  if (appointment.status !== 'CONFIRMED') {
    return { ok: false, kind: 'bad_request', message: MSG_APPOINTMENT_NOT_CONFIRMED };
  }
  return { ok: true };
};

// ====== 三元組正規化 ======

export const normalizePhone = (phone: string): string =>
  phone.replace(/[\s-]/g, '');

export const isValidPhone = (phone: string): boolean =>
  /^[0-9+]{6,20}$/.test(normalizePhone(phone));

// ====== 取消政策 ======

export interface CancelPolicy {
  mode: 'free' | 'cutoff';
  hoursBeforeCannotCancel?: number;
}

export const parseCancelPolicy = (raw: unknown): CancelPolicy => {
  const p = (raw ?? {}) as { mode?: unknown; hoursBeforeCannotCancel?: unknown };
  const mode = p.mode === 'cutoff' ? 'cutoff' : 'free';
  if (mode === 'cutoff' && typeof p.hoursBeforeCannotCancel === 'number') {
    return { mode, hoursBeforeCannotCancel: p.hoursBeforeCannotCancel };
  }
  return { mode };
};

/** 回傳 null 表示通過；否則回業務錯誤訊息（給呼叫端包成 ApiResponse） */
export const checkCancelCutoff = (
  policy: CancelPolicy,
  startAt: Date,
  now: Date = new Date()
): I18nMessage | null => {
  if (policy.mode !== 'cutoff') return null;
  const hours = policy.hoursBeforeCannotCancel ?? 0;
  if (hours <= 0) return null;
  const diffMs = startAt.getTime() - now.getTime();
  if (diffMs < hours * 3600 * 1000) return MSG_CANCEL_TOO_LATE;
  return null;
};

// ====== 顧客預約上限 ======

/** 構造「同一手機在本商家未來 CONFIRMED 預約」的 where 條件（供 Prisma count 與測試共用） */
export const buildBookingLimitWhere = (
  merchantId: string,
  phone: string,
  now: Date = new Date()
) => ({
  merchantId,
  customerPhone: normalizePhone(phone),
  status: 'CONFIRMED' as const,
  startAt: { gte: now }
});

export interface CheckBookingLimitInput {
  activeCount: number;
  maxLimit: number;
  byMerchant?: boolean;
}

/** 純函式：商家代客一律通過；否則 activeCount < maxLimit 才通過 */
export const checkBookingLimit = (
  input: CheckBookingLimitInput
): { allowed: boolean } => {
  if (input.byMerchant) return { allowed: true };
  return { allowed: input.activeCount < input.maxLimit };
};

// ====== Advisory lock key ======

export const buildLockKey = (merchantId: string, resourceId: string | null, startAtIso: string): string =>
  `appt:${merchantId}:${resourceId ?? 'null'}:${startAtIso}`;

/** RESOURCE_OPTIONAL 未帶 resourceId 時，以 (merchantId, serviceId, startAt) 為鎖；
 *  序列化「同 service 同時段、不指定資源」的並發請求 */
export const buildAutoAssignLockKey = (
  merchantId: string,
  serviceId: string,
  startAtIso: string
): string => `appt-auto:${merchantId}:${serviceId}:${startAtIso}`;

/** 事務內取 advisory lock（自動隨事務釋放） */
export const acquireAdvisoryLock = async (
  tx: Prisma.TransactionClient,
  key: string
): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
};

// ====== RESOURCE_OPTIONAL auto-assign helpers ======

/** 取得指定時刻在商家時區下的 (HH:mm 分鐘數)、weekday、date 字串 */
const splitInstantInTz = (
  instant: Date,
  tz: string
): { date: string; weekday: number; minutes: number } => {
  const d = dayjs.tz(instant, tz);
  return {
    date: d.format('YYYY-MM-DD'),
    weekday: d.day(),
    minutes: d.hour() * 60 + d.minute()
  };
};

/**
 * 檢查指定資源在 [startAt, endAt) 是否在班：
 *  1. 整店休假 → false
 *  2. 有 ScheduleOverride（scope=RESOURCE, resourceId, date）→ override 取代當週規則；
 *     isClosed 或時段不涵蓋 [startMin, endMin] → false
 *  3. 否則查 ScheduleRule（scope=RESOURCE, resourceId, weekday）任一規則涵蓋 → true
 */
export const isResourceOnDutyAt = async (
  tx: Prisma.TransactionClient,
  params: {
    merchantId: string;
    resourceId: string;
    startAt: Date;
    endAt: Date;
    tz: string;
  }
): Promise<boolean> => {
  const { date, weekday, minutes: startMin } = splitInstantInTz(params.startAt, params.tz);
  const endSplit = splitInstantInTz(params.endAt, params.tz);
  // 跨日預約不支援（資源排班檔以單日為粒度，剛好結束在隔日 00:00 算 24:00）
  let endMin: number;
  if (endSplit.date === date) {
    endMin = endSplit.minutes;
  } else if (endSplit.minutes === 0) {
    endMin = 24 * 60;
  } else {
    return false;
  }
  const overrideDate = dayjs.tz(`${date}T00:00:00`, params.tz).utc().toDate();

  const holiday = await tx.merchantHoliday.findFirst({
    where: { merchantId: params.merchantId, date: overrideDate },
    select: { id: true }
  });
  if (holiday) return false;

  const override = await tx.scheduleOverride.findFirst({
    where: {
      merchantId: params.merchantId,
      scope: 'RESOURCE',
      resourceId: params.resourceId,
      date: overrideDate
    },
    select: { isClosed: true, startTime: true, endTime: true }
  });
  if (override) {
    if (override.isClosed) return false;
    if (!override.startTime || !override.endTime) return false;
    const oStart = hhmmToMinutes(override.startTime);
    const oEnd = hhmmToMinutes(override.endTime);
    return Number.isFinite(oStart) && Number.isFinite(oEnd) && oStart <= startMin && oEnd >= endMin;
  }

  const rules = await tx.scheduleRule.findMany({
    where: {
      merchantId: params.merchantId,
      scope: 'RESOURCE',
      resourceId: params.resourceId,
      weekday,
      isActive: true
    },
    select: { startTime: true, endTime: true }
  });
  for (const r of rules) {
    const rStart = hhmmToMinutes(r.startTime);
    const rEnd = hhmmToMinutes(r.endTime);
    if (Number.isFinite(rStart) && Number.isFinite(rEnd) && rStart <= startMin && rEnd >= endMin) {
      return true;
    }
  }
  return false;
};

/**
 * 純函式：依「未來預約數升序、id 升序」挑選 auto-assign 資源。
 * 入參為已過濾完（在班且未被佔）的 (rid, count) 陣列。
 */
export const pickByLoadBalance = (
  candidates: Array<{ rid: string; count: number }>
): string | null => {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort(
    (a, b) => a.count - b.count || a.rid.localeCompare(b.rid)
  );
  return sorted[0].rid;
};

/**
 * RESOURCE_OPTIONAL 自動分配資源。必須在 advisory lock 內呼叫。
 * 策略：
 *   1. 從候選資源中濾掉「不在班」與「該 startAt 已被佔」者
 *   2. 對剩餘候選查未來 30 天 CONFIRMED 預約數
 *   3. 依「預約數升序 + id 升序」取第一個（透過 pickByLoadBalance）
 * 無候選回 null（呼叫端應回 MSG_SLOT_TAKEN）
 */
export const pickAutoAssignResource = async (
  tx: Prisma.TransactionClient,
  params: {
    merchantId: string;
    serviceId: string;
    startAt: Date;
    endAt: Date;
    tz: string;
    candidateResourceIds: string[];
  }
): Promise<string | null> => {
  const eligible: string[] = [];
  for (const rid of params.candidateResourceIds) {
    const onDuty = await isResourceOnDutyAt(tx, {
      merchantId: params.merchantId,
      resourceId: rid,
      startAt: params.startAt,
      endAt: params.endAt,
      tz: params.tz
    });
    if (!onDuty) continue;
    const occupied = await tx.appointment.count({
      where: {
        merchantId: params.merchantId,
        serviceId: params.serviceId,
        resourceId: rid,
        startAt: params.startAt,
        status: 'CONFIRMED'
      }
    });
    if (occupied > 0) continue;
    eligible.push(rid);
  }
  if (eligible.length === 0) return null;

  const now = new Date();
  const future30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const counts = await Promise.all(
    eligible.map((rid) =>
      tx.appointment.count({
        where: {
          merchantId: params.merchantId,
          resourceId: rid,
          status: 'CONFIRMED',
          startAt: { gte: now, lt: future30 }
        }
      })
    )
  );
  const withCounts = eligible.map((rid, i) => ({ rid, count: counts[i] }));
  return pickByLoadBalance(withCounts);
};

// ====== createAppointment：核心建預約 ======

export interface CreateAppointmentInput {
  event?: H3Event;
  merchantId: string;
  serviceId: string;
  resourceId?: string;
  /** 啟用 Provider 制商家：可指定服務人員；商家未啟用時忽略 */
  providerId?: string;
  /** ISO UTC */
  startAtIso: string;
  customer: {
    lastName: string;
    title: 'MR' | 'MRS' | 'MISS' | 'MX';
    phone: string;
  };
  note?: string;
  /** 是否略過 cancelPolicy 檢查（商家代客預約為 true） */
  byMerchant?: boolean;
}

export interface CreateAppointmentSuccess {
  ok: true;
  appointment: {
    id: string;
    startAt: Date;
    endAt: Date;
  };
}

export interface CreateAppointmentFailure {
  ok: false;
  response: ApiResponse<Record<string, never>>;
}

export const createAppointment = async (
  input: CreateAppointmentInput
): Promise<CreateAppointmentSuccess | CreateAppointmentFailure> => {
  const { event, merchantId, serviceId, resourceId, providerId, startAtIso, customer, note, byMerchant } = input;

  // 1. 驗 startAt 是否未過期
  const startAt = new Date(startAtIso);
  if (Number.isNaN(startAt.getTime())) {
    return { ok: false, response: badRequestError(event) };
  }
  if (startAt.getTime() <= Date.now()) {
    return { ok: false, response: badRequestError(event, MSG_PAST_SLOT) };
  }

  // 2. 取服務 + 驗 bookingMode 一致性
  const service = await prisma.service.findFirst({
    where: { id: serviceId, merchantId, isActive: true, deletedAt: null },
    select: {
      id: true,
      bookingMode: true,
      durationMinutes: true,
      capacityPerSlot: true,
      requiresProvider: true,
      resources: {
        select: {
          resourceId: true,
          resource: { select: { isActive: true, deletedAt: true } }
        }
      },
      providers: { select: { providerId: true } },
      merchant: { select: { timezone: true, providerModeEnabled: true } }
    }
  });
  if (!service) return { ok: false, response: notFoundError(event) };

  const isResourceMode =
    service.bookingMode === 'RESOURCE' || service.bookingMode === 'RESOURCE_OPTIONAL';

  if (service.bookingMode === 'QUEUE') {
    return { ok: false, response: badRequestError(event, MSG_QUEUE_NOT_SUPPORTED) };
  }
  if (service.bookingMode === 'RESOURCE' && !resourceId) {
    return { ok: false, response: badRequestError(event, MSG_RESOURCE_REQUIRED) };
  }
  if (!isResourceMode && resourceId) {
    return { ok: false, response: badRequestError(event, MSG_RESOURCE_NOT_ALLOWED) };
  }
  if (isResourceMode && resourceId) {
    const linked = service.resources.find((r) => r.resourceId === resourceId);
    if (!linked) return { ok: false, response: badRequestError(event, MSG_RESOURCE_NOT_LINKED) };
    // RESOURCE_OPTIONAL 額外要求資源 active（保護顧客指定到停用資源）
    if (service.bookingMode === 'RESOURCE_OPTIONAL') {
      if (!linked.resource.isActive || linked.resource.deletedAt !== null) {
        return { ok: false, response: badRequestError(event, MSG_RESOURCE_NOT_LINKED) };
      }
    }
  }

  // 2.5 Provider 驗證：商家未啟用 Provider 制時忽略 providerId（不寫入）；啟用時依 requiresProvider 與 providerId 驗證
  const providerModeActive = service.merchant.providerModeEnabled;
  let effectiveProviderId: string | null = null;
  if (providerModeActive) {
    if (service.requiresProvider && !providerId) {
      return { ok: false, response: badRequestError(event, MSG_PROVIDER_REQUIRED) };
    }
    if (providerId) {
      const provider = await prisma.provider.findFirst({
        where: { id: providerId, merchantId, deletedAt: null },
        select: { id: true, isActive: true }
      });
      if (!provider) return { ok: false, response: badRequestError(event, MSG_PROVIDER_NOT_FOR_SERVICE) };
      if (!provider.isActive) return { ok: false, response: badRequestError(event, MSG_PROVIDER_INACTIVE) };
      const linkedToService = service.providers.some((p) => p.providerId === providerId);
      if (!linkedToService) {
        return { ok: false, response: badRequestError(event, MSG_PROVIDER_NOT_FOR_SERVICE) };
      }
      effectiveProviderId = providerId;
    }
  }
  // 若商家未啟用 Provider 制，effectiveProviderId 保持 null（顧客即使誤帶也忽略）

  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);
  const capacity = service.bookingMode === 'TIME_CAPACITY' ? service.capacityPerSlot : 1;
  const normalizedPhone = normalizePhone(customer.phone);
  const isAutoAssign = service.bookingMode === 'RESOURCE_OPTIONAL' && !resourceId;
  const lockKey = isAutoAssign
    ? buildAutoAssignLockKey(merchantId, serviceId, startAt.toISOString())
    : buildLockKey(merchantId, resourceId ?? null, startAt.toISOString());
  const tz = service.merchant.timezone;
  const candidateResourceIds = service.resources
    .filter((r) => r.resource.isActive && r.resource.deletedAt === null)
    .map((r) => r.resourceId);

  // Appointment.mode 對應
  const appointmentMode: 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'RESOURCE_OPTIONAL' =
    service.bookingMode === 'TIME_SLOT'
      ? 'TIME_SLOT'
      : service.bookingMode === 'TIME_CAPACITY'
        ? 'TIME_CAPACITY'
        : service.bookingMode === 'RESOURCE_OPTIONAL'
          ? 'RESOURCE_OPTIONAL'
          : 'RESOURCE';

  try {
    const created = await prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(tx, lockKey);

      // 先檢查顧客上限（商家代客預約略過）
      if (!byMerchant) {
        const merchantRow = await tx.merchant.findUnique({
          where: { id: merchantId },
          select: { maxActiveAppointmentsPerCustomer: true }
        });
        const maxLimit = merchantRow?.maxActiveAppointmentsPerCustomer ?? 5;
        const activeCount = await tx.appointment.count({
          where: buildBookingLimitWhere(merchantId, customer.phone)
        });
        const { allowed } = checkBookingLimit({ activeCount, maxLimit, byMerchant });
        if (!allowed) {
          return { limitExceeded: true as const };
        }
      }

      // RESOURCE_OPTIONAL auto-assign：在鎖內挑資源
      let assignedResourceId: string | null = resourceId ?? null;
      if (isAutoAssign) {
        if (candidateResourceIds.length === 0) {
          return { taken: true as const };
        }
        assignedResourceId = await pickAutoAssignResource(tx, {
          merchantId,
          serviceId,
          startAt,
          endAt,
          tz,
          candidateResourceIds
        });
        if (!assignedResourceId) {
          return { taken: true as const };
        }
      }

      // 重檢已佔用人數
      const occupied = await tx.appointment.count({
        where: {
          merchantId,
          serviceId,
          ...(assignedResourceId ? { resourceId: assignedResourceId } : { resourceId: null }),
          startAt,
          status: 'CONFIRMED'
        }
      });
      if (occupied >= capacity) {
        return { taken: true as const };
      }

      // Provider 衝堂檢查：同 Provider 同 startAt 已有 CONFIRMED → 後者拒
      if (effectiveProviderId) {
        const providerOccupied = await tx.appointment.count({
          where: {
            merchantId,
            providerId: effectiveProviderId,
            startAt,
            status: 'CONFIRMED'
          }
        });
        if (providerOccupied > 0) {
          return { providerTaken: true as const };
        }
      }

      const appt = await tx.appointment.create({
        data: {
          merchantId,
          serviceId,
          resourceId: assignedResourceId,
          providerId: effectiveProviderId,
          mode: appointmentMode,
          status: 'CONFIRMED',
          startAt,
          endAt,
          customerLastName: customer.lastName,
          customerTitle: customer.title,
          customerPhone: normalizedPhone,
          note: note ?? null
        },
        select: { id: true, startAt: true, endAt: true }
      });
      return { ok: true as const, appt };
    });

    if ('limitExceeded' in created) {
      return { ok: false, response: conflictError(event, MSG_BOOKING_LIMIT_EXCEEDED) };
    }
    if ('providerTaken' in created) {
      return { ok: false, response: conflictError(event, MSG_PROVIDER_TAKEN) };
    }
    if ('taken' in created) {
      return { ok: false, response: conflictError(event, MSG_SLOT_TAKEN) };
    }
    return { ok: true, appointment: created.appt };
  } catch {
    return { ok: false, response: conflictError(event, MSG_SLOT_TAKEN) };
  }
};

// ====== rescheduleAppointment：商家修改既有預約時間 / 資源 ======

export interface RescheduleAppointmentInput {
  event?: H3Event;
  merchantId: string;
  appointmentId: string;
  /** ISO UTC */
  startAtIso: string;
  /** RESOURCE: 必選；RESOURCE_OPTIONAL: 可帶 null；TIME_SLOT/TIME_CAPACITY: 不可帶 */
  resourceId?: string | null;
  /** 過號補登：true 時跳過「未過時段」與「資源排班」檢查；仍會檢查雙開衝突 */
  force?: boolean;
}

export interface RescheduleAppointmentSuccess {
  ok: true;
  appointment: {
    id: string;
    startAt: Date;
    endAt: Date;
    resourceId: string | null;
    status: 'CONFIRMED';
  };
}

export interface RescheduleAppointmentFailure {
  ok: false;
  response: ApiResponse<Record<string, never>>;
}

export const MSG_RESCHEDULE_NOT_ON_DUTY: I18nMessage = {
  zh_tw: '該資源於選定時段未排班',
  en: 'Resource is not on duty at the selected time',
  ja: 'リソースは選択時間帯に勤務外です'
};

export interface RescheduleResourceContext {
  bookingMode: 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'RESOURCE_OPTIONAL' | 'QUEUE';
  currentResourceId: string | null;
  /** body.resourceId：undefined = 沿用原資源；null = 取消指定（僅 RESOURCE_OPTIONAL 合法） */
  requestedResourceId: string | null | undefined;
  serviceResources: Array<{
    resourceId: string;
    resource: { isActive: boolean; deletedAt: Date | null };
  }>;
}

export type RescheduleResourceResolution =
  | { ok: true; targetResourceId: string | null }
  | { ok: false; message: I18nMessage };

/** 純函式：依 bookingMode 解析最終 targetResourceId 並驗證模式 / 綁定 / 啟用狀態。
 *  抽離 rescheduleAppointment 內部以便單元測試。 */
export const resolveRescheduleResource = (
  ctx: RescheduleResourceContext
): RescheduleResourceResolution => {
  if (ctx.bookingMode === 'QUEUE') {
    return { ok: false, message: MSG_QUEUE_NOT_SUPPORTED };
  }
  if (ctx.bookingMode === 'TIME_SLOT' || ctx.bookingMode === 'TIME_CAPACITY') {
    if (ctx.requestedResourceId) {
      return { ok: false, message: MSG_RESOURCE_NOT_ALLOWED };
    }
    return { ok: true, targetResourceId: null };
  }
  if (ctx.bookingMode === 'RESOURCE') {
    const rid =
      ctx.requestedResourceId === undefined ? ctx.currentResourceId : ctx.requestedResourceId;
    if (!rid) return { ok: false, message: MSG_RESOURCE_REQUIRED };
    const linked = ctx.serviceResources.find((r) => r.resourceId === rid);
    if (!linked) return { ok: false, message: MSG_RESOURCE_NOT_LINKED };
    if (!linked.resource.isActive || linked.resource.deletedAt !== null) {
      return { ok: false, message: MSG_RESOURCE_NOT_LINKED };
    }
    return { ok: true, targetResourceId: rid };
  }
  // RESOURCE_OPTIONAL
  const rid =
    ctx.requestedResourceId === undefined ? ctx.currentResourceId : ctx.requestedResourceId;
  if (rid) {
    const linked = ctx.serviceResources.find((r) => r.resourceId === rid);
    if (!linked) return { ok: false, message: MSG_RESOURCE_NOT_LINKED };
    if (!linked.resource.isActive || linked.resource.deletedAt !== null) {
      return { ok: false, message: MSG_RESOURCE_NOT_LINKED };
    }
  }
  return { ok: true, targetResourceId: rid ?? null };
};

export const rescheduleAppointment = async (
  input: RescheduleAppointmentInput
): Promise<RescheduleAppointmentSuccess | RescheduleAppointmentFailure> => {
  const { event, merchantId, appointmentId, startAtIso, force } = input;

  const startAt = new Date(startAtIso);
  if (Number.isNaN(startAt.getTime())) {
    return { ok: false, response: badRequestError(event) };
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, merchantId },
    select: {
      id: true,
      merchantId: true,
      serviceId: true,
      resourceId: true,
      status: true,
      service: {
        select: {
          id: true,
          bookingMode: true,
          durationMinutes: true,
          capacityPerSlot: true,
          resources: {
            select: {
              resourceId: true,
              resource: { select: { isActive: true, deletedAt: true } }
            }
          },
          merchant: { select: { timezone: true } }
        }
      }
    }
  });
  if (!appointment) {
    return { ok: false, response: notFoundError(event, MSG_APPOINTMENT_NOT_FOUND) };
  }
  if (appointment.status !== 'CONFIRMED') {
    return { ok: false, response: badRequestError(event, MSG_APPOINTMENT_NOT_CONFIRMED) };
  }

  const { service } = appointment;

  const resolved = resolveRescheduleResource({
    bookingMode: service.bookingMode,
    currentResourceId: appointment.resourceId,
    requestedResourceId: input.resourceId,
    serviceResources: service.resources
  });
  if (!resolved.ok) {
    return { ok: false, response: badRequestError(event, resolved.message) };
  }
  const targetResourceId = resolved.targetResourceId;
  const isResourceMode =
    service.bookingMode === 'RESOURCE' || service.bookingMode === 'RESOURCE_OPTIONAL';

  // 時間檢查（force 跳過）
  if (!force && startAt.getTime() <= Date.now()) {
    return { ok: false, response: badRequestError(event, MSG_PAST_SLOT) };
  }

  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);
  const capacity = service.bookingMode === 'TIME_CAPACITY' ? service.capacityPerSlot : 1;
  const tz = service.merchant.timezone;
  const lockKey = buildLockKey(merchantId, targetResourceId, startAt.toISOString());

  // Appointment.mode 對應
  const appointmentMode: 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'RESOURCE_OPTIONAL' =
    service.bookingMode === 'TIME_SLOT'
      ? 'TIME_SLOT'
      : service.bookingMode === 'TIME_CAPACITY'
        ? 'TIME_CAPACITY'
        : service.bookingMode === 'RESOURCE_OPTIONAL'
          ? 'RESOURCE_OPTIONAL'
          : 'RESOURCE';

  try {
    const result = await prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(tx, lockKey);

      // 排班檢查（force 跳過）：僅 RESOURCE / RESOURCE_OPTIONAL 帶資源時檢查
      if (!force && isResourceMode && targetResourceId) {
        const onDuty = await isResourceOnDutyAt(tx, {
          merchantId,
          resourceId: targetResourceId,
          startAt,
          endAt,
          tz
        });
        if (!onDuty) {
          return { offDuty: true as const };
        }
      }

      // 衝突檢查（force 不跳過）：排除自身
      const occupied = await tx.appointment.count({
        where: {
          id: { not: appointmentId },
          merchantId,
          serviceId: service.id,
          ...(targetResourceId ? { resourceId: targetResourceId } : { resourceId: null }),
          startAt,
          status: 'CONFIRMED'
        }
      });
      if (occupied >= capacity) {
        return { taken: true as const };
      }

      const updated = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          mode: appointmentMode,
          startAt,
          endAt,
          resourceId: targetResourceId
        },
        select: { id: true, startAt: true, endAt: true, resourceId: true, status: true }
      });
      return { ok: true as const, appt: updated };
    });

    if ('offDuty' in result) {
      return { ok: false, response: badRequestError(event, MSG_RESCHEDULE_NOT_ON_DUTY) };
    }
    if ('taken' in result) {
      return { ok: false, response: conflictError(event, MSG_SLOT_TAKEN) };
    }
    return {
      ok: true,
      appointment: {
        id: result.appt.id,
        startAt: result.appt.startAt,
        endAt: result.appt.endAt,
        resourceId: result.appt.resourceId,
        status: 'CONFIRMED'
      }
    };
  } catch {
    return { ok: false, response: conflictError(event, MSG_SLOT_TAKEN) };
  }
};
