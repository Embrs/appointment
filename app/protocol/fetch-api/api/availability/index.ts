import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 公開：取得商家公開資訊 + 啟用中服務 / 資源（無 token） */
export const GetPublicMerchant = ({ slug }: GetPublicMerchantParams) => {
  if (IsMock()) return mock.GetPublicMerchant();
  return methods.get<GetPublicMerchantRes>(`/nuxt-api/public/m/${slug}`);
};

/** 公開：查詢某日可預約時段（無 token） */
export const GetAvailability = (params: GetAvailabilityParams) => {
  if (IsMock()) return mock.GetAvailability();
  return methods.get<GetAvailabilityRes>('/nuxt-api/public/availability', params as Record<string, unknown>);
};
