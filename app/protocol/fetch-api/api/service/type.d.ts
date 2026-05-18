// 商家服務 type 定義

type BookingModeType = 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'QUEUE';

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
