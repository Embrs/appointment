import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 公開：顧客拿號（無 token） */
export const TakeQueueTicket = (params: TakeQueueTicketParams) => {
  if (IsMock()) return mock.TakeQueueTicket();
  return methods.post<TakeQueueTicketRes>('/nuxt-api/public/queue/take', params as unknown as Record<string, unknown>);
};

/** 公開：查單張號碼牌（WS 兜底輪詢） */
export const GetQueueTicket = ({ id }: GetQueueTicketParams) => {
  if (IsMock()) return mock.GetQueueTicket();
  return methods.get<GetQueueTicketRes>(`/nuxt-api/public/queue/${id}`);
};

/** 商家：當日全部 ticket + counter */
export const GetQueueToday = () => {
  if (IsMock()) return mock.GetQueueToday();
  return methods.get<GetQueueTodayRes>('/nuxt-api/queue/today');
};

/** 商家：叫下一號 */
export const CallNextQueueTicket = (params: CallNextQueueTicketParams) => {
  if (IsMock()) return mock.CallNextQueueTicket();
  return methods.post<CallNextQueueTicketRes>('/nuxt-api/queue/call-next', params as unknown as Record<string, unknown>);
};

/** 商家：標完成 */
export const MarkQueueTicketDone = ({ id }: QueueTicketActionParams) => {
  if (IsMock()) return mock.MarkQueueTicketDone();
  return methods.post<QueueTicketActionRes>(`/nuxt-api/queue/${id}/done`);
};

/** 商家：標過號 */
export const MarkQueueTicketSkip = ({ id }: QueueTicketActionParams) => {
  if (IsMock()) return mock.MarkQueueTicketSkip();
  return methods.post<QueueTicketActionRes>(`/nuxt-api/queue/${id}/skip`);
};
