// 號碼牌共用 helper：三語訊息、WebSocket peer Map、ticketDate timezone 工具、QueueWindow 校驗
// 規範：錯誤一律 return（不 throw）；廣播 payload 統一格式
import type { I18nMessage } from './response';

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
