// 認證 API Mock（NUXT_PUBLIC_TEST_MODE='T' 時走此路）
// 預設 code=200 與真實 server 對齊，避免 caller 對 status.code 判斷分裂

const SuccessRes = <T>(data: T, wait = 200) => new Promise<ApiRes<T>>((resolve) => {
  const res = { data, status: { code: 200, message: { zh_tw: '', en: '', ja: '' } } } as ApiRes<T>;
  setTimeout(() => { resolve(res); }, wait);
});

// -------------------------------------------------------------------------------------------------

export const SignInAdmin = () => SuccessRes<SignInAdminRes>({
  token: 'mock-admin-token',
  type: 'admin',
  userName: 'Mock Admin',
  userEmail: 'admin@mock.local'
});

export const SignInMerchant = () => SuccessRes<SignInMerchantRes>({
  token: 'mock-merchant-token',
  type: 'merchant',
  role: 'OWNER',
  merchantId: 'mock-merchant-id',
  merchantName: 'Mock Merchant',
  userName: 'Mock Owner',
  userEmail: 'owner@mock.local'
});

export const SignUpMerchant = () => SuccessRes<SignUpMerchantRes>({
  pending: true,
  merchantId: 'mock-merchant-id'
});

export const MeInfo = () => SuccessRes<MeInfoRes>({
  type: 'merchant',
  userName: 'Mock Owner',
  userEmail: 'owner@mock.local',
  merchantId: 'mock-merchant-id',
  merchantName: 'Mock Merchant',
  role: 'OWNER'
});

export const ForgotPassword = () => SuccessRes<ForgotPasswordRes>({ sent: true });
