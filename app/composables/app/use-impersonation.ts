// 平台管理員代理進入商家後台的身分切換
// 進場：備份目前 admin 身分到 ss_back_*，把 store 切到 merchant
// 退場：從 ss_back_* 還原 admin 身分，清除備份
import type { SelfType, SelfRole } from '~/stores/3.store-self';

interface EnterParams {
  token: string;
  merchantId: string;
  role: SelfRole;
  userName: string;
  userEmail: string;
}

export const UseImpersonation = () => {
  const backToken = UseEncryptCookie<string>('ss_back_t', '');
  const backType = UseEncryptCookie<SelfType>('ss_back_type', 'guest');
  const backName = UseEncryptCookie<string>('ss_back_name', '');
  const backEmail = UseEncryptCookie<string>('ss_back_email', '');

  const ClearBackup = () => {
    backToken.value = '';
    backType.value = 'guest';
    backName.value = '';
    backEmail.value = '';
  };

  /** 進入代理：備份目前身分 → 寫入 merchant 身分 */
  const EnterImpersonation = (params: EnterParams) => {
    const storeSelf = StoreSelf();
    backToken.value = storeSelf.apiToken;
    backType.value = storeSelf.selfType;
    backName.value = storeSelf.userName;
    backEmail.value = storeSelf.userEmail;

    storeSelf.SetIdentity({
      token: params.token,
      type: 'merchant',
      role: params.role,
      merchantId: params.merchantId,
      userName: params.userName,
      userEmail: params.userEmail
    });
  };

  /** 退出代理：還原 admin 身分 → 清備份 → 跳 /sys/merchants */
  const ExitImpersonation = async () => {
    const storeSelf = StoreSelf();
    if (!backToken.value || backType.value !== 'admin') {
      // 沒備份，退化為一般登出
      storeSelf.SignOut();
      return;
    }
    storeSelf.SetIdentity({
      token: backToken.value,
      type: 'admin',
      role: '',
      merchantId: '',
      userName: backName.value,
      userEmail: backEmail.value
    });
    ClearBackup();
    await navigateTo('/sys/merchants');
  };

  /** 當前是否有有效備份（admin token 仍在） */
  const HasBackup = computed(() => !! backToken.value && backType.value === 'admin');

  return {
    EnterImpersonation,
    ExitImpersonation,
    ClearBackup,
    HasBackup
  };
};
