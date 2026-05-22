// 商家服務 type 定義

type BookingModeType =
  | 'TIME_SLOT'
  | 'TIME_CAPACITY'
  | 'RESOURCE'
  | 'RESOURCE_OPTIONAL'
  | 'QUEUE';

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  bookingMode: BookingModeType;
  durationMinutes: number;
  slotIntervalMinutes: number;
  capacityPerSlot: number;
  priceCents: number | '';
  isActive: boolean;
  displayOrder: number;
  resourceIds: string[];
  /** 平均單人服務時長（分鐘），null 時 fallback 至 durationMinutes；僅 QUEUE 服務使用 */
  avgServiceMinutes?: number | null;
  /** 是否需指定服務人員（Provider）；商家 providerModeEnabled=true 時有效 */
  requiresProvider?: boolean;
  /** 可服務此項目之 Provider id；requiresProvider=true 時非空 */
  providerIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// List -------------------------------------------------------------------------------------------

interface GetServiceListRes {
  items: ServiceItem[];
}

// Create -----------------------------------------------------------------------------------------

interface CreateServiceParams {
  name: string;
  description?: string;
  bookingMode: BookingModeType;
  durationMinutes?: number;
  slotIntervalMinutes?: number;
  capacityPerSlot?: number;
  priceCents?: number;
  isActive?: boolean;
  displayOrder?: number;
  resourceIds?: string[];
  /** QUEUE 服務的平均服務時長；null 或省略表示沿用 durationMinutes */
  avgServiceMinutes?: number | null;
  requiresProvider?: boolean;
  providerIds?: string[];
}

interface CreateServiceRes {
  service: ServiceItem;
}

// Detail -----------------------------------------------------------------------------------------

interface GetServiceParams {
  id: string;
}

interface GetServiceRes {
  service: ServiceItem;
}

// Update -----------------------------------------------------------------------------------------

interface UpdateServiceParams {
  id: string;
  name?: string;
  description?: string;
  bookingMode?: BookingModeType;
  durationMinutes?: number;
  slotIntervalMinutes?: number;
  capacityPerSlot?: number;
  priceCents?: number;
  isActive?: boolean;
  displayOrder?: number;
  resourceIds?: string[];
  /** QUEUE 服務的平均服務時長；null 表示沿用 durationMinutes */
  avgServiceMinutes?: number | null;
  requiresProvider?: boolean;
  providerIds?: string[];
}

interface UpdateServiceRes {
  service: ServiceItem;
}

// Delete -----------------------------------------------------------------------------------------

interface DeleteServiceParams {
  id: string;
}

interface DeleteServiceRes {
  id: string;
}
