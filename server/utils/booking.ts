// 預約建立／取消的共用 helper
// 規範：advisory lock 在事務內取；重檢容量後 createMany；錯誤一律 return（不 throw）
import type { Prisma, PrismaClient } from '@prisma/client';
import type { H3Event } from 'h3';
import { prisma } from './prisma';
import {
  badRequestError,
  conflictError,
  notFoundError,
  type ApiResponse,
  type I18nMessage
} from './response';

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

// ====== Advisory lock key ======

export const buildLockKey = (merchantId: string, resourceId: string | null, startAtIso: string): string =>
  `appt:${merchantId}:${resourceId ?? 'null'}:${startAtIso}`;

/** 事務內取 advisory lock（自動隨事務釋放） */
export const acquireAdvisoryLock = async (
  tx: Prisma.TransactionClient,
  key: string
): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
};

// ====== createAppointment：核心建預約 ======

export interface CreateAppointmentInput {
  event?: H3Event;
  merchantId: string;
  serviceId: string;
  resourceId?: string;
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
  const { event, merchantId, serviceId, resourceId, startAtIso, customer, note } = input;

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
      resources: { select: { resourceId: true } }
    }
  });
  if (!service) return { ok: false, response: notFoundError(event) };

  if (service.bookingMode === 'QUEUE') {
    return { ok: false, response: badRequestError(event, MSG_QUEUE_NOT_SUPPORTED) };
  }
  if (service.bookingMode === 'RESOURCE') {
    if (!resourceId) return { ok: false, response: badRequestError(event, MSG_RESOURCE_REQUIRED) };
    const linked = service.resources.some((r) => r.resourceId === resourceId);
    if (!linked) return { ok: false, response: badRequestError(event, MSG_RESOURCE_NOT_LINKED) };
  } else if (resourceId) {
    return { ok: false, response: badRequestError(event, MSG_RESOURCE_NOT_ALLOWED) };
  }

  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);
  const capacity = service.bookingMode === 'TIME_CAPACITY' ? service.capacityPerSlot : 1;
  const lockKey = buildLockKey(merchantId, resourceId ?? null, startAt.toISOString());

  try {
    const created = await prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(tx, lockKey);

      // 重檢已佔用人數
      const occupied = await tx.appointment.count({
        where: {
          merchantId,
          serviceId,
          ...(resourceId ? { resourceId } : { resourceId: null }),
          startAt,
          status: 'CONFIRMED'
        }
      });
      if (occupied >= capacity) {
        return { taken: true as const };
      }

      const appt = await tx.appointment.create({
        data: {
          merchantId,
          serviceId,
          resourceId: resourceId ?? null,
          mode: service.bookingMode === 'TIME_SLOT'
            ? 'TIME_SLOT'
            : service.bookingMode === 'TIME_CAPACITY'
              ? 'TIME_CAPACITY'
              : 'RESOURCE',
          status: 'CONFIRMED',
          startAt,
          endAt,
          customerLastName: customer.lastName,
          customerTitle: customer.title,
          customerPhone: normalizePhone(customer.phone),
          note: note ?? null
        },
        select: { id: true, startAt: true, endAt: true }
      });
      return { taken: false as const, appt };
    });

    if (created.taken) {
      return { ok: false, response: conflictError(event, MSG_SLOT_TAKEN) };
    }
    return { ok: true, appointment: created.appt };
  } catch {
    return { ok: false, response: conflictError(event, MSG_SLOT_TAKEN) };
  }
};
