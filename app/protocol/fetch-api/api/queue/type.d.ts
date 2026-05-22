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
  /** service 已綁 active resources 時必填；未綁時不可帶 */
  resourceId?: string | null;
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
  /** 多 resource 分群：未綁時為 null */
  resourceId?: string | null;
  resourceName?: string | null;
}

// 公開：找回號碼牌（手機末 4 碼） -----------------------------------------------------------

interface FindQueueTicketParams {
  slug: string;
  serviceId: string;
  /** 4 位數字字串 */
  phoneLast4: string;
}

interface FindQueueTicketRes {
  /** 命中單筆時提供（向後相容） */
  ticketId?: string;
  /**
   * 命中多筆（同手機末 4 碼跨 resource）時提供；每筆含可區分用的 resource 名稱與 claimToken。
   * 單筆命中時亦會回此欄位（length=1），但客戶端可優先讀 `ticketId` 維持舊行為。
   */
  tickets?: Array<{
    ticketId: string;
    ticketNumber: number;
    serviceName: string;
    resourceId: string | null;
    resourceName: string | null;
    status: QueueTicketStatusType;
    claimToken: string;
  }>;
}

// 公開：查單張號碼牌 ---------------------------------------------------------------------------

interface GetQueueTicketParams {
  id: string;
}

interface GetQueueTicketRes {
  ticket: {
    id: string;
    serviceId: string;
    /** 多 resource 號池：屬於哪間 resource；未綁 resource 為 null */
    resourceId?: string | null;
    /** resource 名稱（同 resourceId） */
    resourceName?: string | null;
    ticketNumber: number;
    ticketDate: string;
    status: QueueTicketStatusType;
    takenAt: string;
    calledAt: string | null;
    doneAt: string | null;
    serviceName: string;
    /** 啟用 Provider 制商家：當下時段排定的 Provider id；未啟用 / 未命中 / 多匹配為 null */
    providerId?: string | null;
    /** 啟用 Provider 制商家：當下時段排定的 Provider 顯示名稱；未啟用 / 未命中 / 多匹配為 null */
    providerName?: string | null;
  };
  merchant: {
    id: string;
    name: string;
    timezone: string;
    /** 商家三語自訂「服務人員」稱呼；用於前端 useProviderLabel fallback */
    providerLabel?: { zh?: string | null; en?: string | null; ja?: string | null } | null;
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
  /** 啟用 Provider 制商家：當下時段排定的 Provider id；未啟用 / 未命中 / 多匹配為 null */
  providerId?: string | null;
  /** 啟用 Provider 制商家：當下時段排定的 Provider 顯示名稱；未啟用 / 未命中 / 多匹配為 null */
  providerName?: string | null;
}

interface QueueTodayResourceItem {
  /** 未綁 resource 的 service 走 fallback：id=null、name=null */
  id: string | null;
  name: string | null;
  displayOrder: number | null;
  /** null 代表 fallback 元素（無 resource）；歷史已停用 resource 為 false */
  isActive: boolean | null;
  lastTicketNumber: number;
  lastCalledNumber: number;
  /** 啟用 Provider 制商家：當下時段該 resource 排定的 Provider；未啟用 / 未命中 / 多匹配為 null */
  provider?: { id: string; name: string } | null;
  tickets: QueueTodayTicketItem[];
}

interface QueueTodayServiceItem {
  serviceId: string;
  serviceName: string;
  isActive: boolean;
  /** 既有欄位：未綁時等於唯一 slot；綁多 resource 時為合計 */
  lastTicketNumber: number;
  /** 既有欄位：未綁時等於唯一 slot；綁多 resource 時為 active 最小 lastCalledNumber */
  lastCalledNumber: number;
  /** 該服務的 effective 平均服務時長（已 fallback 至 durationMinutes） */
  avgServiceMinutes: number;
  /** 既有欄位：所有 resource 攤平合併（向後相容） */
  tickets: QueueTodayTicketItem[];
  /** 本服務當日累計票數 */
  ticketsTotal?: number;
  /** 按 (service, resource) 分群；未綁 resource 走單元素 fallback id=null */
  resources: QueueTodayResourceItem[];
}

interface GetQueueTodayRes {
  ticketDate: string;
  timezone: string;
  services: QueueTodayServiceItem[];
}

// 商家：叫下一號 -------------------------------------------------------------------------------

interface CallNextQueueTicketParams {
  serviceId: string;
  /** service 已綁 active resources 時必填；未綁時不可帶 */
  resourceId?: string | null;
}

interface CallNextQueueTicketRes {
  ticketId: string;
  ticketNumber: number;
  serviceId: string;
  resourceId?: string | null;
  resourceName?: string | null;
}

// 商家：現場代客領號 ---------------------------------------------------------------------------

interface CreateQueueTicketForCustomerParams {
  serviceId: string;
  /** service 已綁 active resources 時必填；未綁時不可帶 */
  resourceId?: string | null;
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
  resourceId?: string | null;
  resourceName?: string | null;
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

// 商家：報到台改派診間 -------------------------------------------------------------------------

interface AssignResourceQueueParams {
  id: string;
  /** 目標 resource id；與當前 resourceId 相同視為 no-op */
  resourceId: string;
}

interface AssignResourceQueueRes {
  ok: boolean;
  /** 改派為當前 resource 時為 true（no-op） */
  noChange?: boolean;
  ticketId?: string;
  ticketNumber?: number;
  fromResourceId?: string | null;
  toResourceId?: string;
  toResourceName?: string;
}
