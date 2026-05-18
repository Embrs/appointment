import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 商家：讀取整週時段規則 */
export const GetScheduleRules = (params: GetScheduleRulesParams = {}) => {
  if (IsMock()) return mock.GetScheduleRules();
  return methods.get<GetScheduleRulesRes>('/nuxt-api/schedule/rules', params as Record<string, unknown>);
};

/** 商家：整組覆蓋整週時段規則 */
export const UpdateScheduleRules = (params: UpdateScheduleRulesParams) => {
  if (IsMock()) return mock.UpdateScheduleRules();
  return methods.put<UpdateScheduleRulesRes>('/nuxt-api/schedule/rules', params);
};

/** 商家：讀取特定日期覆寫 */
export const GetScheduleOverrides = (params: GetScheduleOverridesParams = {}) => {
  if (IsMock()) return mock.GetScheduleOverrides();
  return methods.get<GetScheduleOverridesRes>('/nuxt-api/schedule/override', params as Record<string, unknown>);
};

/** 商家：新增 / 更新特定日期覆寫（upsert） */
export const CreateScheduleOverride = (params: CreateScheduleOverrideParams) => {
  if (IsMock()) return mock.CreateScheduleOverride();
  return methods.post<CreateScheduleOverrideRes>('/nuxt-api/schedule/override', params);
};

/** 商家：刪除特定日期覆寫 */
export const DeleteScheduleOverride = ({ id }: DeleteScheduleOverrideParams) => {
  if (IsMock()) return mock.DeleteScheduleOverride();
  return methods.delete<DeleteScheduleOverrideRes>(`/nuxt-api/schedule/override/${id}`);
};
