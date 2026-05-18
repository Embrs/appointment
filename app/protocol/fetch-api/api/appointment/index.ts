import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 公開：顧客建立預約（無 token） */
export const CreatePublicAppointment = (params: CreatePublicAppointmentParams) => {
  if (IsMock()) return mock.CreatePublicAppointment();
  return methods.post<CreatePublicAppointmentRes>('/nuxt-api/public/appointment', params as unknown as Record<string, unknown>);
};

/** 公開：三元組查詢預約（無 token，rate limit） */
export const LookupAppointment = (params: LookupAppointmentParams) => {
  if (IsMock()) return mock.LookupAppointment();
  return methods.post<LookupAppointmentRes>('/nuxt-api/public/appointment/lookup', params as unknown as Record<string, unknown>);
};

/** 公開：顧客取消預約（驗三元組） */
export const CancelPublicAppointment = ({ id, ...body }: CancelPublicAppointmentParams) => {
  if (IsMock()) return mock.CancelPublicAppointment();
  return methods.post<CancelPublicAppointmentRes>(`/nuxt-api/public/appointment/${id}/cancel`, body as unknown as Record<string, unknown>);
};

/** 商家：預約列表 */
export const GetAppointmentList = (params: GetAppointmentListParams = {}) => {
  if (IsMock()) return mock.GetAppointmentList();
  return methods.get<GetAppointmentListRes>('/nuxt-api/appointment', params as unknown as Record<string, unknown>);
};

/** 商家：代客預約 */
export const CreateAppointment = (params: CreateAppointmentParams) => {
  if (IsMock()) return mock.CreateAppointment();
  return methods.post<CreateAppointmentRes>('/nuxt-api/appointment', params as unknown as Record<string, unknown>);
};

/** 商家：取消預約 */
export const CancelAppointment = ({ id, ...body }: CancelAppointmentParams) => {
  if (IsMock()) return mock.CancelAppointment();
  return methods.post<CancelAppointmentRes>(`/nuxt-api/appointment/${id}/cancel`, body as unknown as Record<string, unknown>);
};

/** 商家：歷史紀錄 */
export const GetAppointmentArchive = (params: GetAppointmentArchiveParams = {}) => {
  if (IsMock()) return mock.GetAppointmentArchive();
  return methods.get<GetAppointmentArchiveRes>('/nuxt-api/appointment/archive', params as unknown as Record<string, unknown>);
};
