// 公開（無 token）：商家公開資訊 + 可預約時段查詢

type PublicBookingMode = 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'QUEUE';

interface PublicCancelPolicy {
  mode: 'free' | 'cutoff';
  hoursBeforeCannotCancel?: number;
}

interface PublicMerchantItem {
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

interface AvailabilitySlot {
  /** ISO UTC 字串 */
  startAt: string;
  endAt: string;
  capacity: number;
  remaining: number;
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
