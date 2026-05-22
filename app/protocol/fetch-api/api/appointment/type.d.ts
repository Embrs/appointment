// 預約相關 API type 定義

type CustomerTitleType = 'MR' | 'MRS' | 'MISS' | 'MX';
type AppointmentModeType = 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'RESOURCE_OPTIONAL';
type AppointmentStatusType = 'CONFIRMED' | 'CANCELED' | 'NO_SHOW' | 'COMPLETED';
type CanceledByType = 'CUSTOMER' | 'MERCHANT' | 'SYSTEM';
type AppointmentBookingMode = 'TIME_SLOT' | 'TIME_CAPACITY' | 'RESOURCE' | 'RESOURCE_OPTIONAL' | 'QUEUE';

interface CustomerTriplet {
  lastName: string;
  title: CustomerTitleType;
  phone: string;
}

// 公開：建預約 ---------------------------------------------------------------------------------

interface CreatePublicAppointmentParams {
  slug: string;
  serviceId: string;
  resourceId?: string;
  /** 啟用 Provider 制商家：指定服務人員 */
  providerId?: string;
  /** ISO UTC */
  startAt: string;
  customer: CustomerTriplet;
  note?: string;
}

interface CreatePublicAppointmentRes {
  id: string;
  startAt: string;
  endAt: string;
}

// 公開：三元組查詢 -----------------------------------------------------------------------------

interface LookupAppointmentParams extends CustomerTriplet {
  slug: string;
  includeCanceled?: boolean;
}

interface LookupAppointmentItem {
  id: string;
  mode: AppointmentModeType;
  status: AppointmentStatusType;
  startAt: string;
  endAt: string;
  service: { id: string; name: string };
  resource: { id: string; name: string } | null;
  provider: { id: string; name: string; isActive: boolean } | null;
  note: string | null;
  cancelReason: string | null;
  canceledBy: CanceledByType | null;
  canceledAt: string | null;
}

interface LookupAppointmentRes {
  merchant: {
    slug: string;
    name: string;
    timezone: string;
    cancelPolicy: { mode: 'free' | 'cutoff'; hoursBeforeCannotCancel?: number };
  };
  appointments: LookupAppointmentItem[];
}

// 公開：取消預約 -------------------------------------------------------------------------------

interface CancelPublicAppointmentParams extends CustomerTriplet {
  id: string;
}

interface CancelPublicAppointmentRes {
  id: string;
}

// 商家：列表 -----------------------------------------------------------------------------------

interface GetAppointmentListParams {
  dateFrom?: string;
  dateTo?: string;
  status?: AppointmentStatusType;
  serviceId?: string;
  resourceId?: string;
  providerId?: string;
  customerPhone?: string;
  page?: number;
  pageSize?: number;
}

interface AppointmentItem {
  id: string;
  mode: AppointmentModeType;
  status: AppointmentStatusType;
  startAt: string;
  endAt: string;
  service: {
    id: string;
    name: string;
    bookingMode: AppointmentBookingMode;
    durationMinutes: number;
  };
  resource: { id: string; name: string } | null;
  /** 服務人員（啟用 Provider 制商家才會非 null） */
  provider: { id: string; name: string; isActive: boolean } | null;
  /** Provider 的原始 id（便於 join）；provider 物件為已軟刪時可能為 null 但 providerId 仍有值 */
  providerId?: string | null;
  customerLastName: string;
  customerTitle: CustomerTitleType;
  customerPhone: string;
  note: string | null;
  cancelReason: string | null;
  canceledBy: CanceledByType | null;
  canceledAt: string | null;
  createdAt: string;
}

interface GetAppointmentListRes {
  total: number;
  page: number;
  pageSize: number;
  items: AppointmentItem[];
}

// 商家：代客預約 -------------------------------------------------------------------------------

interface CreateAppointmentParams {
  serviceId: string;
  resourceId?: string;
  providerId?: string;
  startAt: string;
  customer: CustomerTriplet;
  note?: string;
}

interface CreateAppointmentRes {
  id: string;
  startAt: string;
  endAt: string;
}

// 商家：取消 -----------------------------------------------------------------------------------

interface CancelAppointmentParams {
  id: string;
  reason?: string;
}

interface CancelAppointmentRes {
  id: string;
}

// 商家：標記完成 / 標記未到 --------------------------------------------------------------------

interface CompleteAppointmentParams {
  id: string;
}

interface CompleteAppointmentRes {
  id: string;
  status: 'COMPLETED';
}

interface NoShowAppointmentParams {
  id: string;
}

interface NoShowAppointmentRes {
  id: string;
  status: 'NO_SHOW';
}

// 商家：修改預約（reschedule） ----------------------------------------------------------------

interface RescheduleAppointmentParams {
  id: string;
  /** ISO UTC */
  startAt: string;
  /** 不帶 = 沿用原資源；null = RESOURCE_OPTIONAL 改為「不指定」；TIME_SLOT/TIME_CAPACITY 不可帶 */
  resourceId?: string | null;
  /** true = 允許過去時段 + 跳過資源排班檢查（仍會阻擋雙開） */
  force?: boolean;
}

interface RescheduleAppointmentRes {
  appointment: AppointmentItem;
}

// 商家：歷史 -----------------------------------------------------------------------------------

interface GetAppointmentArchiveParams {
  dateFrom?: string;
  dateTo?: string;
  customerPhone?: string;
  page?: number;
  pageSize?: number;
}

interface AppointmentArchiveItem {
  id: string;
  mode: AppointmentModeType;
  status: AppointmentStatusType;
  startAt: string;
  endAt: string;
  serviceId: string;
  resourceId: string | null;
  customerLastName: string;
  customerTitle: CustomerTitleType;
  customerPhone: string;
  note: string | null;
  cancelReason: string | null;
  canceledBy: CanceledByType | null;
  canceledAt: string | null;
  archivedAt: string;
}

interface GetAppointmentArchiveRes {
  total: number;
  page: number;
  pageSize: number;
  items: AppointmentArchiveItem[];
}
