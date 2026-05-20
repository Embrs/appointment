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
  /** 僅 bookingMode='QUEUE' 時提供：當日叫到的號碼（無則 0） */
  currentServing?: number;
  /** 僅 bookingMode='QUEUE' 時提供：當日已發出的號碼總數（無則 0） */
  ticketsTaken?: number;
  /** 僅 bookingMode='QUEUE' 時提供：等待中人數 = max(0, ticketsTaken - currentServing) */
  waitingCount?: number;
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
  /** YYYY-MM-DD（商家時區下的當日） */
  date: string;
}

interface GetAvailabilityRes {
  timezone: string;
  date: string;
  slots: AvailabilitySlot[];
}
