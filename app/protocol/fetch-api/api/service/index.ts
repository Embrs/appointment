import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 商家：服務列表 */
export const GetServiceList = () => {
  if (IsMock()) return mock.GetServiceList();
  return methods.get<GetServiceListRes>('/nuxt-api/service');
};

/** 商家：新增服務 */
export const CreateService = (params: CreateServiceParams) => {
  if (IsMock()) return mock.CreateService();
  return methods.post<CreateServiceRes>('/nuxt-api/service', params);
};

/** 商家：服務詳情 */
export const GetService = ({ id }: GetServiceParams) => {
  if (IsMock()) return mock.GetService();
  return methods.get<GetServiceRes>(`/nuxt-api/service/${id}`);
};

/** 商家：更新服務 */
export const UpdateService = ({ id, ...body }: UpdateServiceParams) => {
  if (IsMock()) return mock.UpdateService();
  return methods.put<UpdateServiceRes>(`/nuxt-api/service/${id}`, body);
};

/** 商家：刪除服務（軟刪除） */
export const DeleteService = ({ id }: DeleteServiceParams) => {
  if (IsMock()) return mock.DeleteService();
  return methods.delete<DeleteServiceRes>(`/nuxt-api/service/${id}`);
};
