// 認證流程 type 定義
// 規範：sign-in 同端點雙身分；sign-up 僅商家，不簽 token

// 共用 -------------------------------------------------------------------------------------------

/** 商家成員角色 */
type MerchantUserRoleType = 'OWNER' | 'STAFF';

// SignIn -----------------------------------------------------------------------------------------

interface SignInAdminParams {
  email: string;
  password: string;
}

interface SignInMerchantParams {
  email: string;
  password: string;
}

interface SignInAdminRes {
  token: string;
  type: 'admin';
  userName: string;
  userEmail: string;
}

interface SignInMerchantRes {
  token: string;
  type: 'merchant';
  role: MerchantUserRoleType;
  merchantId: string;
  merchantName: string;
  userName: string;
  userEmail: string;
}

// SignUp（僅商家自助註冊）-------------------------------------------------------------------------

interface SignUpMerchantParams {
  email: string;
  password: string;
  merchantName: string;
}

interface SignUpMerchantRes {
  /** 永遠為 true；不簽 token，前端據此顯示「待管理員審核」 */
  pending: boolean;
  merchantId?: string;
}

// Me ---------------------------------------------------------------------------------------------

type MeInfoAdminRes = {
  type: 'admin';
  userName: string;
  userEmail: string;
};

type MeInfoMerchantRes = {
  type: 'merchant';
  userName: string;
  userEmail: string;
  merchantId: string;
  merchantName: string;
  role: MerchantUserRoleType;
  /** 由 Change 3 引入：當前 token 為平台管理員代理 token 時，帶 adminId */
  impersonatedBy?: string;
};

type MeInfoRes = MeInfoAdminRes | MeInfoMerchantRes;

// Forgot password ---------------------------------------------------------------------------------

interface ForgotPasswordParams {
  email: string;
}

interface ForgotPasswordRes {
  sent: boolean;
}
