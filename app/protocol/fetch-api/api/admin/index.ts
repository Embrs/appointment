import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 取得平台管理員清單 */
export const GetAdminList = () => {
  if (IsMock()) return mock.GetAdminList();
  return methods.get<GetAdminListRes>('/nuxt-api/sys/admin');
};

/** 新增平台管理員 */
export const CreateAdmin = (params: CreateAdminParams) => {
  if (IsMock()) return mock.CreateAdmin();
  return methods.post<CreateAdminRes>('/nuxt-api/sys/admin', params);
};

/** 編輯平台管理員（不可改 email） */
export const UpdateAdmin = ({ id, ...body }: UpdateAdminParams) => {
  if (IsMock()) return mock.UpdateAdmin();
  return methods.put<UpdateAdminRes>(`/nuxt-api/sys/admin/${id}`, body);
};

/** 切換平台管理員啟用狀態 */
export const ToggleAdminActive = ({ id }: ToggleAdminActiveParams) => {
  if (IsMock()) return mock.ToggleAdminActive();
  return methods.post<ToggleAdminActiveRes>(`/nuxt-api/sys/admin/${id}/toggle-active`, {});
};
