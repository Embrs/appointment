import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 商家：資源列表 */
export const GetResourceList = () => {
  if (IsMock()) return mock.GetResourceList();
  return methods.get<GetResourceListRes>('/nuxt-api/resource');
};

/** 商家：新增資源 */
export const CreateResource = (params: CreateResourceParams) => {
  if (IsMock()) return mock.CreateResource();
  return methods.post<CreateResourceRes>('/nuxt-api/resource', params);
};

/** 商家：資源詳情 */
export const GetResource = ({ id }: GetResourceParams) => {
  if (IsMock()) return mock.GetResource();
  return methods.get<GetResourceRes>(`/nuxt-api/resource/${id}`);
};

/** 商家：更新資源 */
export const UpdateResource = ({ id, ...body }: UpdateResourceParams) => {
  if (IsMock()) return mock.UpdateResource();
  return methods.put<UpdateResourceRes>(`/nuxt-api/resource/${id}`, body);
};

/** 商家：刪除資源（軟刪除） */
export const DeleteResource = ({ id }: DeleteResourceParams) => {
  if (IsMock()) return mock.DeleteResource();
  return methods.delete<DeleteResourceRes>(`/nuxt-api/resource/${id}`);
};
