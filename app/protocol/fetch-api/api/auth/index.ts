import * as mock from './mock';
import methods from '@/protocol/fetch-api/methods';

const IsMock = () => {
  const { public: { testMode } } = useRuntimeConfig();
  return testMode === 'T';
};

// -----------------------------------------------------------------------------------------------

/** 平台管理員登入 */
export const SignInAdmin = (params: SignInAdminParams) => {
  if (IsMock()) return mock.SignInAdmin();
  return methods.post<SignInAdminRes>('/nuxt-api/auth/sign-in', { ...params, type: 'admin' });
};

/** 商家成員登入 */
export const SignInMerchant = (params: SignInMerchantParams) => {
  if (IsMock()) return mock.SignInMerchant();
  return methods.post<SignInMerchantRes>('/nuxt-api/auth/sign-in', { ...params, type: 'merchant' });
};

/** 商家自助註冊（不簽 token） */
export const SignUpMerchant = (params: SignUpMerchantParams) => {
  if (IsMock()) return mock.SignUpMerchant();
  return methods.post<SignUpMerchantRes>('/nuxt-api/auth/sign-up', params);
};

/** 取自身身分資訊 */
export const MeInfo = () => {
  if (IsMock()) return mock.MeInfo();
  return methods.get<MeInfoRes>('/nuxt-api/auth/me');
};

/** 忘記密碼（MVP 通用回應，避免列舉攻擊） */
export const ForgotPassword = (params: ForgotPasswordParams) => {
  if (IsMock()) return mock.ForgotPassword();
  return methods.post<ForgotPasswordRes>('/nuxt-api/auth/forgot-password', params);
};
