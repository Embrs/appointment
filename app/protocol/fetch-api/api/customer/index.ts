import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 公開：顧客多商家彙整查詢（無 token） */
export const CustomerLookup = (params: CustomerLookupParams) => {
  if (IsMock()) return mock.CustomerLookup();
  return methods.post<CustomerLookupRes>('/nuxt-api/public/customer/lookup', params as unknown as Record<string, unknown>);
};
