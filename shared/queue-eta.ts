// 號碼牌 ETA 預估純函式：前後端共用實作，避免雙實作漂移
// 演算法：「等待人數 × 平均服務時長」線性模型

export type QueueTicketStatusForEta = 'WAITING' | 'CALLED' | 'DONE' | 'SKIPPED';

export interface QueueTicketEtaInput {
  ticketNumber: number;
  status: QueueTicketStatusForEta;
}

export interface QueueCounterEtaInput {
  lastCalledNumber: number;
}

/**
 * 計算某張票面前還有幾位顧客等候（不含自己、不含目前正在被服務的那一號）。
 * - CALLED/DONE/SKIPPED 票一律回 0（自己已脫離等待序列）
 * - WAITING 票：max(0, ticketNumber - lastCalledNumber - 1)
 * - lastCalledNumber=0（尚未開始叫號）：回 max(0, ticketNumber - 1)
 */
export const getTicketsAhead = (
  ticket: QueueTicketEtaInput,
  counter: QueueCounterEtaInput
): number => {
  if (ticket.status !== 'WAITING') return 0;
  return Math.max(0, ticket.ticketNumber - counter.lastCalledNumber - 1);
};

/**
 * 根據前面等待人數與平均服務分鐘數估算等待時間。
 * - 負數 / 非有限數 / 0 平均時長一律視為 0（不傳遞 NaN 或負值到 UI）
 * - 結果四捨五入為非負整數
 */
export const estimateWaitMinutes = (
  waitingAhead: number,
  avgServiceMinutes: number
): number => {
  if (!Number.isFinite(waitingAhead) || waitingAhead <= 0) return 0;
  if (!Number.isFinite(avgServiceMinutes) || avgServiceMinutes <= 0) return 0;
  return Math.max(0, Math.round(waitingAhead * avgServiceMinutes));
};
