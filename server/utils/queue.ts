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

export const MSG_QUEUE_RESOURCE_REQUIRED: I18nMessage = {
  zh_tw: '請先選擇診間／櫃台／資源',
  en: 'Please select a room/counter/resource',
  ja: '部屋／カウンター／リソースを選択してください'
};

export const MSG_QUEUE_RESOURCE_INVALID: I18nMessage = {
  zh_tw: '所選的診間／櫃台／資源不可用',
  en: 'Selected room/counter/resource is not available',
  ja: '選択した部屋／カウンター／リソースは利用できません'
};

export const MSG_QUEUE_INVALID_STATE: I18nMessage = {
  zh_tw: '此號碼牌目前狀態無法改派診間',
  en: 'Cannot reassign room for this ticket in its current state',
  ja: 'この整理券は現在の状態では部屋を変更できません'
};

export const MSG_QUEUE_NUMBER_TAKEN: I18nMessage = {
  zh_tw: '目標診間已有相同號碼，請選擇其他診間',
  en: 'Target room already has a ticket with this number',
  ja: '対象の部屋に同じ番号の整理券が既にあります'
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
  /** 多診間分群識別；null 表 service 未綁 resource（單號池） */
  resourceId?: string | null;
  /** 對應 resource 的顯示名稱；resourceId 為 null 時可省略 */
  resourceName?: string;
  /** CALL_NEXT 時的服務中號碼 */
  current?: number;
  /** 對應 ticket id */
  servingTicketId?: string;
  /** CALL_NEXT 時叫到的顧客姓氏（大螢幕僅顯示姓+稱謂，不顯示服務名稱） */
  servingCustomerLastName?: string;
  /** CALL_NEXT 時叫到的顧客稱謂 enum（i18n key 對應 appointment.customerTitle.*） */
  servingCustomerTitle?: 'MR' | 'MRS' | 'MISS' | 'MX';
  /** TICKET_TAKEN 時新發票號 */
  ticketNumber?: number;
  /** 該服務 effective 平均服務時長（avgServiceMinutes ?? durationMinutes），給訂閱端對任意票即時計算 ETA */
  avgServiceMinutes?: number;
  /** 該事件後「下一位 WAITING 票」的預估等待分鐘；null 表無法估算 */
  nextWaitMinutes?: number | null;
  /** 啟用 Provider 制商家：該事件對應 resource 當下時段排定的 Provider id；未啟用 / 未命中 / 多匹配為 null */
  providerId?: string | null;
  /** 啟用 Provider 制商家：對應 Provider 顯示名稱；未啟用 / 未命中 / 多匹配為 null */
  providerName?: string | null;
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
  /** 多診間分群；null 表單號池（service 未綁 resource）；呼叫端必須顯式傳入避免誤入單號池 */
  resourceId: string | null;
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
  /** 當日上限（0 = 不限制）；事務內會再次精檢避免並發超發。語意為「service 總上限」不分 resource */
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
        resourceId: string | null;
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
  const {
    merchantId,
    serviceId,
    resourceId,
    ticketDate,
    customer,
    createdByMerchant,
    maxTickets = 0
  } = input;

  // 事務外粗檢：同人同日重複領號（僅 phone 非 null 才查；按 resourceId 分群——不同 resource 視為新號池）
  if (customer.phone !== null) {
    const existing = await prisma.queueTicket.findFirst({
      where: {
        merchantId,
        serviceId,
        resourceId,
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

  // 事務外粗檢：當日上限（0 視為不限）——語意為「service 總上限」不分 resource
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
      // 確保 counter 存在（按 (merchantId, serviceId, resourceId, counterDate) 分群）
      // 注意：PostgreSQL unique 對多個 NULL 不衝突 + Prisma compound unique 對 nullable 欄位拒絕 null，
      // 所以 upsert 不適用 resourceId=null 路徑。改先鎖 service row 序列化建立、再 findFirst + create。
      await tx.$executeRaw`SELECT 1 FROM "Service" WHERE id = ${serviceId} FOR UPDATE`;
      const existing = await tx.queueCounter.findFirst({
        where: { merchantId, serviceId, resourceId, counterDate: ticketDate },
        select: { id: true }
      });
      if (!existing) {
        await tx.queueCounter.create({
          data: {
            merchantId,
            serviceId,
            resourceId,
            counterDate: ticketDate,
            lastTicketNumber: 0,
            lastCalledNumber: 0
          }
        });
      }

      // 鎖 counter row（FOR UPDATE 序列化兩並發拿號；不同 resource 鎖不同 row 自然不互鎖）
      const locked = await tx.$queryRaw<Array<{ id: string; lastTicketNumber: number; lastCalledNumber: number }>>`
        SELECT id, "lastTicketNumber", "lastCalledNumber"
        FROM "QueueCounter"
        WHERE "merchantId" = ${merchantId}
          AND "serviceId" = ${serviceId}
          AND "resourceId" IS NOT DISTINCT FROM ${resourceId}
          AND "counterDate" = ${ticketDate}
        FOR UPDATE
      `;
      const counter = locked[0];
      if (!counter) throw new Error('counter not found after upsert');

      // 事務內再次精檢上限（service 總上限）
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
          resourceId,
          ticketDate,
          ticketNumber: nextNumber,
          status: 'WAITING',
          customerLastName: customer.lastName,
          customerTitle: customer.title,
          customerPhone: customer.phone,
          createdByMerchant,
          claimToken
        },
        select: {
          id: true,
          ticketNumber: true,
          ticketDate: true,
          status: true,
          claimToken: true,
          resourceId: true
        }
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
      claimToken: ticket.claimToken,
      resourceId: ticket.resourceId
    },
    currentServing: result.currentServing
  };
};

// ====== Resource helper（QUEUE service 綁定的 Resource 列表 + 驗證） ======

export interface QueueResource {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

/**
 * 取得該 service 已綁定且 active / 未軟刪的 Resource，按 displayOrder 升序。
 * 給 take / call-next / create-for-customer / queue-today / public/m/[slug] 共用。
 */
export const getResourcesForQueueService = async (
  serviceId: string
): Promise<QueueResource[]> => {
  const rows = await prisma.serviceResource.findMany({
    where: {
      serviceId,
      resource: { deletedAt: null, isActive: true }
    },
    select: {
      resource: {
        select: { id: true, name: true, displayOrder: true, isActive: true }
      }
    }
  });
  return rows
    .map((r) => r.resource)
    .sort((a, b) => a.displayOrder - b.displayOrder);
};

export type ResourceValidationResult =
  | { ok: true; resource: QueueResource | null }
  | { ok: false; code: 'REQUIRED' | 'INVALID' };

// ====== Provider 推導（QueueTicket / Resource 不存 providerId；以 Schedule 反查為唯一來源） ======

/** resource → provider 對應；null 表「啟用 Provider 制但該 resource 該時段未命中（零匹配或多匹配）」 */
export type ResourceProviderEntry = { providerId: string; providerName: string } | null;

/** key 為 resourceId；服務未綁 resource 的單號池路徑用字面量 `'__null__'` */
export type ResourceProviderMap = Map<string, ResourceProviderEntry>;

const RESOURCE_NULL_KEY = '__null__';

export interface ProviderScheduleEntry {
  resourceId: string | null;
  providerId: string;
  startTime: string | null;
  endTime: string | null;
}

export interface SelectProviderEntriesInput {
  /** 當下時間（HH:mm 字串，已套商家時區） */
  time: string;
  /** ScheduleOverride 同日命中項（scope=PROVIDER、providerId 非 null、isClosed=false） */
  overrides: ProviderScheduleEntry[];
  /** ScheduleRule 同 weekday 命中項（scope=PROVIDER、providerId 非 null、isActive=true） */
  rules: ProviderScheduleEntry[];
}

/**
 * 從 schedule 命中資料推導 resource → provider 對應。純函式，便於單元測試。
 * - Override 優先 Rule（同 resource 有任一 Override 命中時忽略 Rule）
 * - 同 resource 命中多 Provider → 該 entry 為 null
 * - 命中單一 Provider → 該 entry 為 providerId（呼叫端再 join 取 name）
 */
export const selectProviderEntriesFromSchedule = (
  input: SelectProviderEntriesInput
): Map<string, string | null> => {
  const { time, overrides, rules } = input;
  const keyOf = (rid: string | null): string => rid ?? RESOURCE_NULL_KEY;
  const inWindow = (start: string | null, end: string | null): boolean => {
    if (!start || !end) return false;
    return time >= start && time < end;
  };

  type Acc = { providerIds: Set<string>; bestSource: 'override' | 'rule' };
  const byResource = new Map<string, Acc>();

  const ingest = (entry: ProviderScheduleEntry, source: 'override' | 'rule') => {
    if (!inWindow(entry.startTime, entry.endTime)) return;
    const k = keyOf(entry.resourceId);
    const cur = byResource.get(k);
    if (!cur) {
      byResource.set(k, { providerIds: new Set([entry.providerId]), bestSource: source });
      return;
    }
    if (cur.bestSource === 'rule' && source === 'override') {
      byResource.set(k, { providerIds: new Set([entry.providerId]), bestSource: 'override' });
      return;
    }
    if (cur.bestSource === 'override' && source === 'rule') {
      return; // 已有 override 命中，rule 不參與
    }
    cur.providerIds.add(entry.providerId);
  };

  for (const o of overrides) ingest(o, 'override');
  for (const r of rules) ingest(r, 'rule');

  const out = new Map<string, string | null>();
  for (const [k, { providerIds }] of byResource) {
    if (providerIds.size === 1) {
      const [only] = providerIds;
      out.set(k, only ?? null);
    } else {
      out.set(k, null);
    }
  }
  return out;
};

/**
 * 依商家當下 timezone 的 weekday + HH:mm 反查「每個 resource 對應的 Provider」。
 * - 商家 providerModeEnabled=false 一律回空 Map（短路，不查 schedule）
 * - ScheduleOverride（特定日期）優先於 ScheduleRule（每週）
 * - 同一 resource 在同一時段命中多個 Provider 視為排班錯誤，該 resource 的值為 null（畫面不渲染副標）
 * - 同一 resource 在同一時段命中單一 Provider 時，該 resource 的值為 { providerId, providerName }
 * - QueueTicket / Resource 不存 providerId；本 helper 為唯一推導入口
 */
export const resolveProviderByResourceMap = async (
  merchantId: string,
  now: Date = new Date()
): Promise<ResourceProviderMap> => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { providerModeEnabled: true, timezone: true }
  });
  if (!merchant || !merchant.providerModeEnabled) return new Map();

  const tz = merchant.timezone ?? 'Asia/Taipei';
  const weekday = getTicketWeekday(tz, now);
  const time = getTicketTimeString(tz, now);
  const ticketDate = getTicketDate(tz, now);

  const [overrideRows, ruleRows] = await Promise.all([
    prisma.scheduleOverride.findMany({
      where: {
        merchantId,
        date: ticketDate,
        scope: 'PROVIDER',
        providerId: { not: null },
        isClosed: false
      },
      select: { resourceId: true, providerId: true, startTime: true, endTime: true }
    }),
    prisma.scheduleRule.findMany({
      where: {
        merchantId,
        weekday,
        scope: 'PROVIDER',
        providerId: { not: null },
        isActive: true
      },
      select: { resourceId: true, providerId: true, startTime: true, endTime: true }
    })
  ]);

  const overrides: ProviderScheduleEntry[] = overrideRows
    .filter((o): o is typeof o & { providerId: string } => o.providerId !== null)
    .map((o) => ({
      resourceId: o.resourceId,
      providerId: o.providerId,
      startTime: o.startTime,
      endTime: o.endTime
    }));
  const rules: ProviderScheduleEntry[] = ruleRows
    .filter((r): r is typeof r & { providerId: string } => r.providerId !== null)
    .map((r) => ({
      resourceId: r.resourceId,
      providerId: r.providerId,
      startTime: r.startTime,
      endTime: r.endTime
    }));

  const resolved = selectProviderEntriesFromSchedule({ time, overrides, rules });

  // 收集所有要查 name 的 providerId（單一命中者）
  const singleHitProviderIds = new Set<string>();
  for (const pid of resolved.values()) if (pid !== null) singleHitProviderIds.add(pid);

  const providers = singleHitProviderIds.size
    ? await prisma.provider.findMany({
        where: { id: { in: [...singleHitProviderIds] }, deletedAt: null },
        select: { id: true, name: true }
      })
    : [];
  const providerNameById = new Map(providers.map((p) => [p.id, p.name]));

  const out: ResourceProviderMap = new Map();
  for (const [k, pid] of resolved) {
    if (pid === null) {
      out.set(k, null);
      continue;
    }
    const name = providerNameById.get(pid);
    if (!name) {
      out.set(k, null); // Provider 已軟刪 → 視為未命中
      continue;
    }
    out.set(k, { providerId: pid, providerName: name });
  }
  return out;
};

/** 從 ResourceProviderMap 安全取出 entry；包含 null / undefined（未啟用 Provider 制）皆回 null */
export const getResourceProviderEntry = (
  map: ResourceProviderMap,
  resourceId: string | null
): ResourceProviderEntry => {
  const key = resourceId ?? RESOURCE_NULL_KEY;
  return map.get(key) ?? null;
};

/**
 * 驗證 body 帶來的 resourceId：
 * - service 已綁 active resources：resourceId 必填、且必須在綁定列表中
 * - service 未綁 active resources：resourceId 必須為 undefined（傳了視為錯誤）
 * 回傳 ok=true 時 resource 為對應 active resource 或 null（單號池路徑）。
 */
export const validateResourceIdForQueueService = async (
  serviceId: string,
  resourceId: string | undefined
): Promise<ResourceValidationResult> => {
  const resources = await getResourcesForQueueService(serviceId);
  if (resources.length === 0) {
    if (resourceId !== undefined) return { ok: false, code: 'INVALID' };
    return { ok: true, resource: null };
  }
  if (resourceId === undefined) return { ok: false, code: 'REQUIRED' };
  const found = resources.find((r) => r.id === resourceId);
  if (!found) return { ok: false, code: 'INVALID' };
  return { ok: true, resource: found };
};
