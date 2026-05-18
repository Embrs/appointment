import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 商家：休假日列表 */
export const GetHolidayList = (params: GetHolidayListParams = {}) => {
  if (IsMock()) return mock.GetHolidayList();
  return methods.get<GetHolidayListRes>('/nuxt-api/holiday', params as Record<string, unknown>);
};

/** 商家：新增休假日 */
export const CreateHoliday = (params: CreateHolidayParams) => {
  if (IsMock()) return mock.CreateHoliday();
  return methods.post<CreateHolidayRes>('/nuxt-api/holiday', params);
};

/** 商家：刪除休假日 */
export const DeleteHoliday = ({ id }: DeleteHolidayParams) => {
  if (IsMock()) return mock.DeleteHoliday();
  return methods.delete<DeleteHolidayRes>(`/nuxt-api/holiday/${id}`);
};
