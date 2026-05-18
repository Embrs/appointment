// 登入與權限
// MVP 三種身分：平台管理員 (admin) / 商家成員 (merchant) / 顧客匿名 (guest)
// 商家成員 role：OWNER（完整權限）/ STAFF（受限）；admin 視為 ADMIN

export type SelfType = 'admin' | 'merchant' | 'guest';
export type SelfRole = 'OWNER' | 'STAFF' | 'ADMIN' | '';

/** 僅 OWNER 可用、STAFF 禁用的權限白名單字首 */
const OWNER_ONLY_PREFIXES = [
  'merchant.staff.',    // 員工管理
  'merchant.settings.', // 商家設定
  'merchant.billing.'   // 帳務（未來）
];

export const StoreSelf = defineStore('StoreSelf', () => {
  /** API Token */
  const apiToken = UseEncryptCookie<string>('ss_t', '');
  /** 身分類型 */
  const selfType = UseEncryptCookie<SelfType>('ss_type', 'guest');
  /** 商家 ID（type=merchant 才有值） */
  const merchantId = UseEncryptCookie<string>('ss_mid', '');
  /** 角色（admin=ADMIN；merchant=OWNER/STAFF） */
  const role = UseEncryptCookie<SelfRole>('ss_role', '');
  /** 使用者名稱 */
  const userName = UseEncryptCookie<string>('ss_name', '');
  /** 使用者 email */
  const userEmail = UseEncryptCookie<string>('ss_email', '');

  /** 是否登入 */
  const isSignIn = computed(() => !! apiToken.value);

  /** 設定 Token */
  const SetToken = (_token = '') => {
    apiToken.value = _token;
  };

  /** 設定完整身分（登入成功後呼叫） */
  const SetIdentity = (info: {
    token: string;
    type: SelfType;
    role?: SelfRole;
    merchantId?: string;
    userName?: string;
    userEmail?: string;
  }) => {
    apiToken.value = info.token;
    selfType.value = info.type;
    role.value = info.role ?? '';
    merchantId.value = info.merchantId ?? '';
    userName.value = info.userName ?? '';
    userEmail.value = info.userEmail ?? '';
  };

  /**
   * 權限檢查
   * - admin：永遠 true
   * - merchant + OWNER：所有 merchant.* 為 true
   * - merchant + STAFF：除 OWNER_ONLY_PREFIXES 字首外的 merchant.* 為 true
   * - guest 或 type 不符：false
   */
  const HasRule = (rule: string): boolean => {
    if (!isSignIn.value) return false;
    if (selfType.value === 'admin') return true;
    if (selfType.value === 'merchant') {
      if (!rule.startsWith('merchant.')) return false;
      if (role.value === 'OWNER') return true;
      if (role.value === 'STAFF') {
        return ! OWNER_ONLY_PREFIXES.some((prefix) => rule.startsWith(prefix));
      }
    }
    return false;
  };

  /** 個人資料清除（不跳轉，由 SignOut / methods.ts 處理跳轉） */
  const ClearInfo = () => {
    apiToken.value = '';
    selfType.value = 'guest';
    role.value = '';
    merchantId.value = '';
    userName.value = '';
    userEmail.value = '';
  };

  /** 登出（依 selfType 決定跳轉路徑） */
  const SignOut = () => {
    const prevType = selfType.value;
    ClearInfo();
    if (prevType === 'admin') {
      navigateTo('/sys/sign-in');
    } else if (prevType === 'merchant') {
      navigateTo('/sign-in');
    }
    // guest 不跳轉
  };

  // -----------------------------------------------------------------------------------------------
  return {
    /** API Token */
    apiToken,
    /** 身分類型 */
    selfType,
    /** 商家 ID */
    merchantId,
    /** 角色 */
    role,
    /** 使用者名稱 */
    userName,
    /** 使用者 email */
    userEmail,
    /** 是否登入 */
    isSignIn,
    /** 設定 Token */
    SetToken,
    /** 設定完整身分 */
    SetIdentity,
    /** 權限檢查 */
    HasRule,
    /** 清除身分（不跳轉） */
    ClearInfo,
    /** 登出（清除 + 依角色跳轉） */
    SignOut
  };
});
