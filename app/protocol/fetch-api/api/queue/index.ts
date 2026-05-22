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

/** 公開：以手機末 4 碼找回今日號碼牌 */
export const FindQueueTicket = (params: FindQueueTicketParams) => {
  if (IsMock()) return mock.FindQueueTicket();
  return methods.post<FindQueueTicketRes>('/nuxt-api/public/queue/find', params as unknown as Record<string, unknown>);
};

/** 公開：用 claim token 取回自己今日票券（QR 掃碼入口；不需手機末 4 碼） */
export const GetQueueClaim = ({ token }: GetQueueClaimParams) => {
  if (IsMock()) return mock.GetQueueClaim();
  return methods.get<GetQueueClaimRes>(`/nuxt-api/public/queue/claim/${encodeURIComponent(token)}`);
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

/** 商家：現場代客領號（櫃台 walk-in） */
export const CreateQueueTicketForCustomer = (params: CreateQueueTicketForCustomerParams) => {
  if (IsMock()) return mock.CreateQueueTicketForCustomer();
  return methods.post<CreateQueueTicketForCustomerRes>('/nuxt-api/queue/create-for-customer', params as unknown as Record<string, unknown>);
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

/** 商家：報到台改派診間（WAITING 票切換到另一 active resource，保留原 ticketNumber） */
export const AssignResourceQueue = ({ id, resourceId }: AssignResourceQueueParams) => {
  if (IsMock()) return mock.AssignResourceQueue();
  return methods.post<AssignResourceQueueRes>(
    `/nuxt-api/queue/${id}/assign-resource`,
    { resourceId }
  );
};
