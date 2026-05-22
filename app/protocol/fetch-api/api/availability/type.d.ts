// 公開（無 token）：商家公開資訊 + 可預約時段查詢

type PublicBookingMode = 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'QUEUE';

interface PublicCancelPolicy {
  mode: 'free' | 'cutoff';
  hoursBeforeCannotCancel?: number;
}

interface PublicMerchantItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  timezone: string;
  address: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  cancelPolicy: PublicCancelPolicy;
  /** 是否啟用服務人員（Provider）制 */
  providerModeEnabled: boolean;
  /** 商家對「服務人員」一詞的三語自訂稱呼；UI 走 fallback 鏈解析 */
  providerLabel: { zh?: string; en?: string; ja?: string };
}

interface PublicServiceItem {
  id: string;
  name: string;
  description: string | null;
  bookingMode: PublicBookingMode;
  durationMinutes: number;
  slotIntervalMinutes: number;
  capacityPerSlot: number;
  priceCents: number | null;
  resourceIds: string[];
  /** 是否需指定服務人員 */
  requiresProvider: boolean;
  /** 可服務此項目之 Provider id */
  providerIds: string[];
  /** 僅 bookingMode='QUEUE' 時提供：當日叫到的號碼（無則 0） */
  currentServing?: number;
  /** 僅 bookingMode='QUEUE' 時提供：當日已發出的號碼總數（無則 0） */
  ticketsTaken?: number;
  /** 僅 bookingMode='QUEUE' 時提供：等待中人數 = max(0, ticketsTaken - currentServing) */
  waitingCount?: number;
  /** 僅 bookingMode='QUEUE' 時提供：下一位 WAITING 票的預估等待分鐘；無 counter 為 null */
  estimatedNextCallMinutes?: number | null;
  /** 僅 bookingMode='QUEUE' 時提供：effective 平均服務時長（已 fallback 至 durationMinutes） */
  avgServiceMinutes?: number;
  /** 僅 bookingMode='QUEUE' 時提供：按 (service, resource) 分群；未綁 resource 走單元素 id=null */
  resources?: PublicQueueServiceResource[];
}

/** 公開 QUEUE service 內每個 resource 的當前 serving 資訊 */
interface PublicQueueServiceResource {
  /** null = service 未綁 resource 的 fallback bucket */
  id: string | null;
  name: string | null;
  displayOrder: number | null;
  currentServing: number;
  ticketsTaken: number;
  waitingCount: number;
  avgServiceMinutes: number;
  estimatedNextCallMinutes: number | null;
  /** 啟用 Provider 制商家：當下時段該 resource 排定的 Provider；未啟用 / 未命中 / 多匹配為 null */
  provider?: { id: string; name: string } | null;
}

interface PublicResourceItem {
  id: string;
  name: string;
  description: string | null;
}

interface GetPublicMerchantParams {
  slug: string;
}

interface GetPublicMerchantRes {
  merchant: PublicMerchantItem;
  services: PublicServiceItem[];
  resources: PublicResourceItem[];
}

/**
 * Slot 不可選原因；僅在 `remaining=0` 時設置，可選時為 undefined。
 * 與後端 `server/utils/availability.ts/SlotUnavailableReason` 對齊。
 */
type SlotUnavailableReason =
  | 'past'
  | 'taken'
  | 'capacity'
  | 'closed'
  | 'holiday'
  | 'inactive';

interface AvailabilitySlot {
  /** ISO UTC 字串 */
  startAt: string;
  endAt: string;
  capacity: number;
  remaining: number;
  /** 不可選原因；可選時為 undefined */
  reason?: SlotUnavailableReason;
}

interface GetAvailabilityParams {
  slug: string;
  serviceId: string;
  resourceId?: string;
  /** 啟用 Provider 制 + 服務 requiresProvider=true 時必填 */
  providerId?: string;
  /** YYYY-MM-DD（商家時區下的當日） */
  date: string;
}

interface GetAvailabilityRes {
  timezone: string;
  date: string;
  slots: AvailabilitySlot[];
}
