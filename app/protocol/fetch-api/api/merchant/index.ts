import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

// 商家自身視角 ----------------------------------------------------------------------------------

/** 商家：取得自身完整資訊 */
export const GetSelfMerchant = () => {
  if (IsMock()) return mock.GetSelfMerchant();
  return methods.get<GetSelfMerchantRes>('/nuxt-api/merchant');
};

/** 商家：更新自身資訊 */
export const UpdateSelfMerchant = ({ id, ...body }: UpdateSelfMerchantParams) => {
  if (IsMock()) return mock.UpdateSelfMerchant();
  return methods.put<UpdateSelfMerchantRes>(`/nuxt-api/merchant/${id}`, body);
};

// 商家成員管理 -----------------------------------------------------------------------------------

/** 商家：成員列表 */
export const GetStaffList = () => {
  if (IsMock()) return mock.GetStaffList();
  return methods.get<GetStaffListRes>('/nuxt-api/merchant/staff');
};

/** 商家：新增成員（OWNER only） */
export const CreateStaff = (params: CreateStaffParams) => {
  if (IsMock()) return mock.CreateStaff();
  return methods.post<CreateStaffRes>('/nuxt-api/merchant/staff', params);
};

/** 商家：編輯成員（OWNER only） */
export const UpdateStaff = ({ id, ...body }: UpdateStaffParams) => {
  if (IsMock()) return mock.UpdateStaff();
  return methods.put<UpdateStaffRes>(`/nuxt-api/merchant/staff/${id}`, body);
};

/** 商家：切換成員啟用（OWNER only） */
export const ToggleStaffActive = ({ id }: ToggleStaffActiveParams) => {
  if (IsMock()) return mock.ToggleStaffActive();
  return methods.post<ToggleStaffActiveRes>(`/nuxt-api/merchant/staff/${id}/toggle-active`, {});
};

// 平台管理員視角 ---------------------------------------------------------------------------------

/** 平台後台：商家列表（含 status/keyword/分頁） */
export const SysGetMerchantList = (params: SysGetMerchantListParams = {}) => {
  if (IsMock()) return mock.SysGetMerchantList();
  return methods.get<SysGetMerchantListRes>('/nuxt-api/sys/merchant', params as Record<string, unknown>);
};

/** 平台後台：商家詳情 */
export const SysGetMerchantDetail = ({ id }: SysGetMerchantDetailParams) => {
  if (IsMock()) return mock.SysGetMerchantDetail();
  return methods.get<SysGetMerchantDetailRes>(`/nuxt-api/sys/merchant/${id}`);
};

/** 平台後台：編輯商家基本資料 */
export const SysUpdateMerchant = ({ id, ...body }: SysUpdateMerchantParams) => {
  if (IsMock()) return mock.SysUpdateMerchant();
  return methods.put<SysUpdateMerchantRes>(`/nuxt-api/sys/merchant/${id}`, body);
};

/** 平台後台：審核通過商家（PENDING → ACTIVE） */
export const SysApproveMerchant = ({ id }: SysMerchantStatusParams) => {
  if (IsMock()) return mock.SysMerchantStatus('ACTIVE');
  return methods.post<SysMerchantStatusRes>(`/nuxt-api/sys/merchant/${id}/approve`, {});
};

/** 平台後台：停用商家（ACTIVE → SUSPENDED） */
export const SysSuspendMerchant = ({ id }: SysMerchantStatusParams) => {
  if (IsMock()) return mock.SysMerchantStatus('SUSPENDED');
  return methods.post<SysMerchantStatusRes>(`/nuxt-api/sys/merchant/${id}/suspend`, {});
};

/** 平台後台：解除停用（SUSPENDED → ACTIVE） */
export const SysActivateMerchant = ({ id }: SysMerchantStatusParams) => {
  if (IsMock()) return mock.SysMerchantStatus('ACTIVE');
  return methods.post<SysMerchantStatusRes>(`/nuxt-api/sys/merchant/${id}/activate`, {});
};

/** 平台後台：拒絕商家申請（PENDING → REJECTED） */
export const SysRejectMerchant = ({ id, reason }: SysRejectMerchantParams) => {
  if (IsMock()) return mock.SysMerchantStatus('REJECTED');
  return methods.post<SysMerchantStatusRes>(
    `/nuxt-api/sys/merchant/${id}/reject`,
    reason !== undefined ? { reason } : {}
  );
};

/** 平台後台：代理進入商家後台（簽 30 分鐘 TTL 商家 token） */
export const SysImpersonateMerchant = ({ id }: SysImpersonateMerchantParams) => {
  if (IsMock()) return mock.SysImpersonateMerchant();
  return methods.post<SysImpersonateMerchantRes>(`/nuxt-api/sys/merchant/${id}/impersonate`, {});
};
