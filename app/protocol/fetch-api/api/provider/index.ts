import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 商家：服務人員列表 */
export const GetProviderList = () => {
  if (IsMock()) return mock.GetProviderList();
  return methods.get<GetProviderListRes>('/nuxt-api/provider');
};

/** 商家：新增服務人員 */
export const CreateProvider = (params: CreateProviderParams) => {
  if (IsMock()) return mock.CreateProvider();
  return methods.post<CreateProviderRes>('/nuxt-api/provider', params);
};

/** 商家：服務人員詳情 */
export const GetProvider = ({ id }: GetProviderParams) => {
  if (IsMock()) return mock.GetProvider();
  return methods.get<GetProviderRes>(`/nuxt-api/provider/${id}`);
};

/** 商家：更新服務人員 */
export const UpdateProvider = ({ id, ...body }: UpdateProviderParams) => {
  if (IsMock()) return mock.UpdateProvider();
  return methods.put<UpdateProviderRes>(`/nuxt-api/provider/${id}`, body);
};

/** 商家：刪除服務人員（軟刪除） */
export const DeleteProvider = ({ id }: DeleteProviderParams) => {
  if (IsMock()) return mock.DeleteProvider();
  return methods.delete<DeleteProviderRes>(`/nuxt-api/provider/${id}`);
};

/** 公開：取得商家服務人員列表（商家未啟用 Provider 制時回空陣列） */
export const GetPublicProviderList = ({ slug }: GetPublicProviderListParams) => {
  if (IsMock()) return mock.GetPublicProviderList();
  return methods.get<GetPublicProviderListRes>('/nuxt-api/public/provider', { slug });
};
