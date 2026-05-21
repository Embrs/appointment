// 號碼牌 API type 定義

type QueueTicketStatusType = 'WAITING' | 'CALLED' | 'DONE' | 'SKIPPED' | 'CANCELED';

interface QueueCustomerTriplet {
  lastName: string;
  title: CustomerTitleType;
  phone: string;
}

// 公開：拿號 -----------------------------------------------------------------------------------

interface TakeQueueTicketParams {
  slug: string;
  serviceId: string;
  customer: QueueCustomerTriplet;
}

interface TakeQueueTicketRes {
  ticketId: string;
  ticketNumber: number;
  /** YYYY-MM-DD */
  ticketDate: string;
  status: QueueTicketStatusType;
  currentServing: number;
  serviceName: string;
  timezone: string;
  /** 8 碼 nanoid，供顧客掃 QR 自助回查 */
  claimToken: string;
}

// 公開：找回號碼牌（手機末 4 碼） -----------------------------------------------------------

interface FindQueueTicketParams {
  slug: string;
  serviceId: string;
  /** 4 位數字字串 */
  phoneLast4: string;
}

interface FindQueueTicketRes {
  ticketId: string;
}

// 公開：查單張號碼牌 ---------------------------------------------------------------------------

interface GetQueueTicketParams {
  id: string;
}

interface GetQueueTicketRes {
  ticket: {
    id: string;
    serviceId: string;
    ticketNumber: number;
    ticketDate: string;
    status: QueueTicketStatusType;
    takenAt: string;
    calledAt: string | null;
    doneAt: string | null;
    serviceName: string;
  };
  merchant: {
    id: string;
    name: string;
    timezone: string;
  };
  currentServing: number;
  lastTicketNumber: number;
  waitingAhead: number;
  /** 預估還需等待分鐘；無 counter 時為 null */
  estimatedWaitMinutes: number | null;
  /** 該服務的 effective 平均服務時長（已 fallback 至 durationMinutes） */
  avgServiceMinutes: number;
}

// 商家：當日總覽 -------------------------------------------------------------------------------

interface QueueTodayTicketItem {
  id: string;
  ticketNumber: number;
  status: QueueTicketStatusType;
  customerLastName: string;
  customerTitle: CustomerTitleType;
  /** 商家現場代建可為 null（顧客未留電話） */
  customerPhone: string | null;
  /** 是否由商家後台代客建立 */
  createdByMerchant: boolean;
  takenAt: string;
  calledAt: string | null;
  doneAt: string | null;
  /** 預估還需等待分鐘；null 表示無 counter 無法估算 */
  estimatedWaitMinutes: number | null;
}

interface QueueTodayServiceItem {
  serviceId: string;
  serviceName: string;
  isActive: boolean;
  lastTicketNumber: number;
  lastCalledNumber: number;
  /** 該服務的 effective 平均服務時長（已 fallback 至 durationMinutes） */
  avgServiceMinutes: number;
  tickets: QueueTodayTicketItem[];
}

interface GetQueueTodayRes {
  ticketDate: string;
  timezone: string;
  services: QueueTodayServiceItem[];
}

// 商家：叫下一號 -------------------------------------------------------------------------------

interface CallNextQueueTicketParams {
  serviceId: string;
}

interface CallNextQueueTicketRes {
  ticketId: string;
  ticketNumber: number;
  serviceId: string;
}

// 商家：現場代客領號 ---------------------------------------------------------------------------

interface CreateQueueTicketForCustomerParams {
  serviceId: string;
  customer: {
    lastName: string;
    title: CustomerTitleType;
    /** 商家代建可省略；省略後該票 customerPhone = null */
    phone?: string;
  };
}

interface CreateQueueTicketForCustomerRes {
  ticketId: string;
  ticketNumber: number;
  /** YYYY-MM-DD */
  ticketDate: string;
  status: QueueTicketStatusType;
  currentServing: number;
  serviceName: string;
  timezone: string;
  /** 8 碼 nanoid，供顧客掃 QR 自助回查 */
  claimToken: string;
}

// 公開：用 claim token 取回票券 ----------------------------------------------------------------

interface GetQueueClaimParams {
  /** 8 碼 nanoid */
  token: string;
}

/** 與 GetQueueTicketRes 同 shape；以 token 入口，不需手機末 4 碼 */
type GetQueueClaimRes = GetQueueTicketRes;

// 商家：標完成 / 過號 ---------------------------------------------------------------------------

interface QueueTicketActionParams {
  id: string;
}

interface QueueTicketActionRes {
  ticketId: string;
  ticketNumber: number;
  status: QueueTicketStatusType;
  doneAt?: string | null;
}
