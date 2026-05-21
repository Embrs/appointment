// 號碼牌共用 helper：三語訊息、WebSocket peer Map、ticketDate timezone 工具、QueueWindow 校驗
// 規範：錯誤一律 return（不 throw）；廣播 payload 統一格式
import type { I18nMessage } from './response';
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import {
  estimateWaitMinutes,
  getTicketsAhead,
  type QueueCounterEtaInput,
  type QueueTicketEtaInput,
  type QueueTicketStatusForEta
} from '~shared/queue-eta';

export { estimateWaitMinutes, getTicketsAhead };
export type { QueueCounterEtaInput, QueueTicketEtaInput, QueueTicketStatusForEta };

// ====== 三語訊息 ======

export const MSG_NOT_QUEUE_SERVICE: I18nMessage = {
  zh_tw: '此服務非號碼牌模式',
  en: 'Service is not in queue mode',
  ja: 'このサービスは整理券モードではありません'
};

export const MSG_QUEUE_WINDOW_CLOSED: I18nMessage = {
  zh_tw: '目前不在領號時間',
  en: 'Queue is not open right now',
  ja: '現在は受付時間外です'
};

export const MSG_QUEUE_FULL: I18nMessage = {
  zh_tw: '今日號碼牌已發完',
  en: 'All tickets issued for today',
  ja: '本日の整理券は配布終了しました'
};

export const MSG_QUEUE_ALREADY_TAKEN: I18nMessage = {
  zh_tw: '您今日已領過號碼牌',
  en: 'You already have a ticket today',
  ja: '本日すでに整理券をお持ちです'
};

export const MSG_QUEUE_TICKET_NOT_FOUND: I18nMessage = {
  zh_tw: '查無此號碼牌',
  en: 'Ticket not found',
  ja: '整理券が見つかりません'
};

export const MSG_QUEUE_NO_WAITING: I18nMessage = {
  zh_tw: '目前沒有等待中的號碼',
  en: 'No waiting tickets',
  ja: 'お待ちの整理券はありません'
};

export const MSG_QUEUE_INVALID_TRANSITION: I18nMessage = {
  zh_tw: '號碼牌狀態無法變更',
  en: 'Invalid ticket state transition',
  ja: '整理券の状態変更ができません'
};

export const MSG_QUEUE_FIND_AMBIGUOUS: I18nMessage = {
  zh_tw: '查詢結果不只一筆，請至櫃台出示手機號碼協助核對',
  en: 'More than one match. Please visit the counter with your phone for verification.',
  ja: '複数件見つかりました。携帯電話をご持参のうえカウンターまでお越しください。'
};

export const MSG_QUEUE_FIND_NOT_FOUND: I18nMessage = {
  zh_tw: '查無今日的號碼牌',
  en: 'No ticket found today',
  ja: '本日の整理券は見つかりません'
};

export const MSG_QUEUE_FIND_INVALID: I18nMessage = {
  zh_tw: '請輸入正確的 4 位數字',
  en: 'Please enter a 4-digit number',
  ja: '4 桁の数字を入力してください'
};

// ====== WebSocket peer 管理 ======

/** peerMap：merchantId → Set<Peer> */
const peerMap: Map<string, Set<any>> = new Map();

export const addPeer = (merchantId: string, peer: any): void => {
  let set = peerMap.get(merchantId);
  if (!set) {
    set = new Set();
    peerMap.set(merchantId, set);
  }
  set.add(peer);
};

export const removePeer = (merchantId: string, peer: any): void => {
  const set = peerMap.get(merchantId);
  if (!set) return;
  set.delete(peer);
  if (set.size === 0) peerMap.delete(merchantId);
};

export const getPeerCount = (merchantId: string): number => {
  return peerMap.get(merchantId)?.size ?? 0;
};

/** 廣播 payload：transformer 自行序列化 JSON */
export interface QueueBroadcastPayload {
  type: 'CALL_NEXT' | 'TICKET_DONE' | 'TICKET_SKIPPED' | 'TICKET_TAKEN';
  serviceId: string;
  /** CALL_NEXT 時的服務中號碼 */
  current?: number;
  /** 對應 ticket id */
  servingTicketId?: string;
  /** TICKET_TAKEN 時新發票號 */
  ticketNumber?: number;
  /** 該服務 effective 平均服務時長（avgServiceMinutes ?? durationMinutes），給訂閱端對任意票即時計算 ETA */
  avgServiceMinutes?: number;
  /** 該事件後「下一位 WAITING 票」的預估等待分鐘；null 表無法估算 */
  nextWaitMinutes?: number | null;
  timestamp: number;
}

/** 廣播給該商家所有訂閱中的 peer */
export const broadcastQueue = (merchantId: string, payload: QueueBroadcastPayload): number => {
  const set = peerMap.get(merchantId);
  if (!set || set.size === 0) return 0;
  const json = JSON.stringify(payload);
  let sent = 0;
  for (const peer of set) {
    try {
      peer.send(json);
      sent += 1;
    } catch {
      // 忽略單個 peer 失敗，繼續其他 peer
    }
  }
  return sent;
};

// ====== ticketDate helper（merchant timezone） ======

/** 取得 merchant timezone 下的今日日期字串（YYYY-MM-DD） */
export const getTicketDateString = (timezone: string, now: Date = new Date()): string => {
  // 用 Intl.DateTimeFormat 取得指定時區的 YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
};

/** 取得 merchant timezone 下的當日 Date 物件（UTC 0 點，給 PG @db.Date 用） */
export const getTicketDate = (timezone: string, now: Date = new Date()): Date => {
  const dateStr = getTicketDateString(timezone, now);
  return new Date(`${dateStr}T00:00:00.000Z`);
};

/** 取得 merchant timezone 下的當前 weekday（0=日 .. 6=六） */
export const getTicketWeekday = (timezone: string, now: Date = new Date()): number => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short'
  });
  const short = fmt.format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? 0;
};

/** 取得 merchant timezone 下的當前 HH:mm 字串 */
export const getTicketTimeString = (timezone: string, now: Date = new Date()): string => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return fmt.format(now); // 'HH:mm'
};

// ====== QueueWindow 校驗 ======

export interface QueueWindowRow {
  weekday: number;
  startTime: string; // 'HH:mm'
  endTime: string;   // 'HH:mm'
  maxTickets: number;
  isActive: boolean;
}

// ====== 公開 currentServing / waitingCount 組裝 ======

export interface QueueCounterSnapshot {
  lastCalledNumber: number;
  lastTicketNumber: number;
}

export interface QueueServingPublic {
  currentServing: number;
  ticketsTaken: number;
  waitingCount: number;
}

/**
 * 將當日 counter 投影為公開可見的「目前叫到 / 已發出 / 等待人數」三欄位
 * 無 counter（當日尚未開機）一律回 0
 */
export const projectQueueServingPublic = (
  counter: QueueCounterSnapshot | null | undefined
): QueueServingPublic => {
  const currentServing = counter?.lastCalledNumber ?? 0;
  const ticketsTaken = counter?.lastTicketNumber ?? 0;
  const waitingCount = Math.max(0, ticketsTaken - currentServing);
  return { currentServing, ticketsTaken, waitingCount };
};

// ====== ETA helper（API + WS payload 共用） ======

export interface QueueEtaServiceInput {
  avgServiceMinutes: number | null;
  durationMinutes: number;
}

/**
 * 取得 service 的 effective 平均服務時長（fallback 至 durationMinutes）。
 * 不直接讀 DB；呼叫端從 prisma 查到 service 後傳入兩欄位即可。
 */
export const getEffectiveAvgServiceMinutes = (
  service: QueueEtaServiceInput
): number => {
  return service.avgServiceMinutes ?? service.durationMinutes;
};

/**
 * 為單張票計算預估等待分鐘。
 * - counter 為 null：回 null（無法估算）
 * - ticket 非 WAITING：回 0（純函式語意）
 * - 其餘：依純函式線性估算
 */
export const computeTicketEtaMinutes = (
  ticket: QueueTicketEtaInput,
  counter: QueueCounterEtaInput | null,
  service: QueueEtaServiceInput
): number | null => {
  if (counter === null) return null;
  const ahead = getTicketsAhead(ticket, counter);
  return estimateWaitMinutes(ahead, getEffectiveAvgServiceMinutes(service));
};

/**
 * 為「下一位 WAITING 票」計算預估等待分鐘（給 /public/m/[slug] 卡片用）。
 * - counter 為 null：回 null
 * - waitingCount=0（無人等候）：回 0
 * - 其餘：以 waitingCount-1 估算（下一位前面剩下幾人）
 */
export const computeNextWaitMinutes = (
  counter: QueueCounterEtaInput | null,
  ticketsTaken: number,
  service: QueueEtaServiceInput
): number | null => {
  if (counter === null) return null;
  const waitingCount = Math.max(0, ticketsTaken - counter.lastCalledNumber);
  if (waitingCount === 0) return 0;
  return estimateWaitMinutes(waitingCount - 1, getEffectiveAvgServiceMinutes(service));
};

/**
 * 為 broadcastQueue 組裝 ETA 欄位（avgServiceMinutes + nextWaitMinutes）。
 * 由呼叫端確保 counter 為「事件後最新狀態」。
 */
export const buildBroadcastEtaFields = (
  counter: QueueCounterEtaInput | null,
  ticketsTaken: number,
  service: QueueEtaServiceInput
): { avgServiceMinutes: number; nextWaitMinutes: number | null } => {
  return {
    avgServiceMinutes: getEffectiveAvgServiceMinutes(service),
    nextWaitMinutes: computeNextWaitMinutes(counter, ticketsTaken, service)
  };
};

/** 判斷給定 timezone 下的當前時間是否在窗口內 */
export const isWithinQueueWindow = (
  windows: QueueWindowRow[],
  timezone: string,
  now: Date = new Date()
): { ok: boolean; window?: QueueWindowRow } => {
  const weekday = getTicketWeekday(timezone, now);
  const time = getTicketTimeString(timezone, now);
  for (const w of windows) {
    if (!w.isActive) continue;
    if (w.weekday !== weekday) continue;
    if (time >= w.startTime && time < w.endTime) {
      return { ok: true, window: w };
    }
  }
  return { ok: false };
};

// ====== 共用拿號核心（公開端 / 商家代建端共用） ======

export type QueueCustomerTitle = 'MR' | 'MRS' | 'MISS' | 'MX';

/**
 * claim token alphabet：排除易混淆字元 0/O/o/1/I/l，方便顧客口頭傳達短碼
 * 55 字元 × 8 碼 ≈ 2^46 組合，碰撞期望值對單日票量可忽略
 */
const CLAIM_TOKEN_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const CLAIM_TOKEN_LENGTH = 8;
const claimTokenNanoid = customAlphabet(CLAIM_TOKEN_ALPHABET, CLAIM_TOKEN_LENGTH);

/** 產生 8 碼不可猜測 claim token（排除 0/O/o/1/I/l） */
export const generateClaimToken = (): string => claimTokenNanoid();

/** 是否為 Prisma claimToken 唯一鍵衝突（P2002） */
const isClaimTokenCollision = (err: unknown): boolean => {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== 'P2002') return false;
  const target = (err.meta as { target?: string[] | string } | undefined)?.target;
  if (Array.isArray(target)) return target.includes('claimToken');
  if (typeof target === 'string') return target.includes('claimToken');
  return false;
};

export interface InternalCreateTicketInput {
  merchantId: string;
  serviceId: string;
  /** merchant timezone 當日 Date（@db.Date 用） */
  ticketDate: Date;
  customer: {
    lastName: string;
    title: QueueCustomerTitle;
    /** 公開端必填字串；商家代建可為 null（顧客未留電話） */
    phone: string | null;
  };
  /** 是否由商家後台代客建立（影響 createdByMerchant 欄位） */
  createdByMerchant: boolean;
  /** 當日上限（0 = 不限制）；事務內會再次精檢避免並發超發 */
  maxTickets?: number;
}

export type InternalCreateTicketResult =
  | {
      ok: true;
      ticket: {
        id: string;
        ticketNumber: number;
        ticketDate: Date;
        status: 'WAITING';
        claimToken: string;
      };
      currentServing: number;
    }
  | { ok: false; reason: 'FULL' | 'ALREADY_TAKEN'; existingTicketId?: string };

/**
 * 共用拿號核心：
 * - 公開端與商家代建端皆呼叫此函式，確保 Counter 序列化、advisory lock、唯一鍵防併發只有一份實作
 * - 「同人同日重複領號」規則僅在 phone 非 null 時觸發（商家代建未留電話不套用）
 * - claimToken 於交易內以 nanoid 產生；若觸發 P2002 重複，retry 一次（再失敗才往外拋）
 * - 不負責廣播，由呼叫端決定（公開端與商家端皆廣播 TICKET_TAKEN）
 */
export const internalCreateTicket = async (
  input: InternalCreateTicketInput
): Promise<InternalCreateTicketResult> => {
  const { merchantId, serviceId, ticketDate, customer, createdByMerchant, maxTickets = 0 } = input;

  // 事務外粗檢：同人同日重複領號（僅 phone 非 null 才查）
  if (customer.phone !== null) {
    const existing = await prisma.queueTicket.findFirst({
      where: {
        merchantId,
        serviceId,
        ticketDate,
        customerPhone: customer.phone,
        status: { in: ['WAITING', 'CALLED'] }
      },
      select: { id: true }
    });
    if (existing) {
      return { ok: false, reason: 'ALREADY_TAKEN', existingTicketId: existing.id };
    }
  }

  // 事務外粗檢：當日上限（0 視為不限）
  if (maxTickets > 0) {
    const count = await prisma.queueTicket.count({
      where: { merchantId, serviceId, ticketDate }
    });
    if (count >= maxTickets) {
      return { ok: false, reason: 'FULL' };
    }
  }

  const runTransaction = (claimToken: string) =>
    prisma.$transaction(async (tx) => {
      // 確保 counter 存在
      await tx.queueCounter.upsert({
        where: {
          merchantId_serviceId_counterDate: {
            merchantId,
            serviceId,
            counterDate: ticketDate
          }
        },
        update: {},
        create: {
          merchantId,
          serviceId,
          counterDate: ticketDate,
          lastTicketNumber: 0,
          lastCalledNumber: 0
        }
      });

      // 鎖 counter 該列（advisory lock；序列化兩並發拿號）
      const locked = await tx.$queryRaw<Array<{ id: string; lastTicketNumber: number; lastCalledNumber: number }>>`
        SELECT id, "lastTicketNumber", "lastCalledNumber"
        FROM "QueueCounter"
        WHERE "merchantId" = ${merchantId}
          AND "serviceId" = ${serviceId}
          AND "counterDate" = ${ticketDate}
        FOR UPDATE
      `;
      const counter = locked[0];
      if (!counter) throw new Error('counter not found after upsert');

      // 事務內再次精檢上限
      if (maxTickets > 0) {
        const inTxCount = await tx.queueTicket.count({
          where: { merchantId, serviceId, ticketDate }
        });
        if (inTxCount >= maxTickets) {
          return { full: true as const };
        }
      }

      const nextNumber = counter.lastTicketNumber + 1;
      await tx.queueCounter.update({
        where: { id: counter.id },
        data: { lastTicketNumber: nextNumber }
      });
      const ticket = await tx.queueTicket.create({
        data: {
          merchantId,
          serviceId,
          ticketDate,
          ticketNumber: nextNumber,
          status: 'WAITING',
          customerLastName: customer.lastName,
          customerTitle: customer.title,
          customerPhone: customer.phone,
          createdByMerchant,
          claimToken
        },
        select: { id: true, ticketNumber: true, ticketDate: true, status: true, claimToken: true }
      });
      return {
        full: false as const,
        ticket,
        currentServing: counter.lastCalledNumber
      };
    }, { isolationLevel: 'Serializable' as Prisma.TransactionIsolationLevel, timeout: 15000, maxWait: 10000 });

  let result: Awaited<ReturnType<typeof runTransaction>>;
  try {
    result = await runTransaction(generateClaimToken());
  } catch (err) {
    if (!isClaimTokenCollision(err)) throw err;
    // 8 碼 nanoid 撞鍵極罕見，整段交易換新 token 重試一次
    result = await runTransaction(generateClaimToken());
  }

  if (result.full) return { ok: false, reason: 'FULL' };
  const { ticket } = result;
  if (ticket.claimToken === null) throw new Error('claimToken unexpectedly null after create');
  return {
    ok: true,
    ticket: {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketDate: ticket.ticketDate,
      status: 'WAITING' as const,
      claimToken: ticket.claimToken
    },
    currentServing: result.currentServing
  };
};
