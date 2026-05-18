// 平台管理員視角 + 商家自身視角 Merchant 相關 API type 定義

type MerchantStatusType = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

// 商家自身視角 ----------------------------------------------------------------------------------

/** 取消政策（cancelPolicy Json 欄位約定結構） */
interface CancelPolicy {
  mode: 'free' | 'cutoff';
  hoursBeforeCannotCancel?: number;
  /** Change 3 reject 時可能寫入；本 change 不修改但 spread 保留 */
  rejectReason?: string;
  [key: string]: unknown;
}

interface SelfMerchantFull {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  timezone: string;
  status: MerchantStatusType;
  cancelPolicy: CancelPolicy;
  contactPhone: string;
  contactEmail: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

interface GetSelfMerchantRes {
  merchant: SelfMerchantFull;
}

interface UpdateSelfMerchantParams {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  timezone?: string;
  address?: string;
  cancelPolicy?: CancelPolicy;
}

interface UpdateSelfMerchantRes {
  merchant: SelfMerchantFull;
}

// 商家成員管理（OWNER only） -----------------------------------------------------------------

interface MerchantStaffItem {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'STAFF';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GetStaffListRes {
  items: MerchantStaffItem[];
}

interface CreateStaffParams {
  email: string;
  password: string;
  name: string;
  role: 'OWNER' | 'STAFF';
}

interface CreateStaffRes {
  user: MerchantStaffItem;
}

interface UpdateStaffParams {
  id: string;
  name?: string;
  password?: string;
  role?: 'OWNER' | 'STAFF';
}

interface UpdateStaffRes {
  user: MerchantStaffItem;
}

interface ToggleStaffActiveParams {
  id: string;
}

interface ToggleStaffActiveRes {
  user: MerchantStaffItem;
}

// 平台管理員視角 --------------------------------------------------------------------------------
type MerchantStatusFilter = MerchantStatusType | 'ALL';

interface SysMerchantItem {
  id: string;
  name: string;
  slug: string;
  status: MerchantStatusType;
  contactEmail: string;
  contactPhone: string;
  createdAt: string;
  ownerEmail: string;
  ownerName: string;
}

interface SysMerchantFull {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  timezone: string;
  status: MerchantStatusType;
  cancelPolicy: Record<string, unknown>;
  contactPhone: string;
  contactEmail: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

interface SysMerchantOwner {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  role: 'OWNER' | 'STAFF';
  createdAt: string;
}

// 列表 -------------------------------------------------------------------------------------------

interface SysGetMerchantListParams {
  status?: MerchantStatusFilter;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

interface SysGetMerchantListRes {
  items: SysMerchantItem[];
  total: number;
  page: number;
  pageSize: number;
}

// 詳情 -------------------------------------------------------------------------------------------

interface SysGetMerchantDetailParams {
  id: string;
}

interface SysGetMerchantDetailRes {
  merchant: SysMerchantFull;
  ownerUser: SysMerchantOwner | null;
}

// 更新 -------------------------------------------------------------------------------------------

interface SysUpdateMerchantParams {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  contactPhone?: string;
  contactEmail?: string;
  timezone?: string;
  address?: string;
}

interface SysUpdateMerchantRes {
  merchant: Pick<SysMerchantFull,
    | 'id'
    | 'slug'
    | 'name'
    | 'description'
    | 'timezone'
    | 'status'
    | 'contactPhone'
    | 'contactEmail'
    | 'address'
    | 'updatedAt'
  >;
}

// 狀態轉換 ---------------------------------------------------------------------------------------

interface SysMerchantStatusParams {
  id: string;
}

interface SysRejectMerchantParams {
  id: string;
  reason?: string;
}

interface SysMerchantStatusRes {
  id: string;
  status: MerchantStatusType;
}

// 代理 -------------------------------------------------------------------------------------------

interface SysImpersonateMerchantParams {
  id: string;
}

interface SysImpersonateMerchantRes {
  token: string;
  merchantId: string;
  merchantName: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  expiresInSeconds: number;
}
