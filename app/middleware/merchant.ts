// 商家後台守門
// 用法：頁面以 definePageMeta({ middleware: ['merchant'] }) 掛載
// 進站前 await /nuxt-api/auth/me 驗證 session（reseed 或 token 失效時直接 redirect 登入頁，避免使用者看到滿屏 404）
// SSR 期間短路，預檢交由 client 端執行；middleware 共享 in-flight promise 避免並發重複呼叫
let pendingMe: Promise<MeCheckResult> | null = null;
type MeCheckResult = 'ok' | 'fail';

const checkMe = async (): Promise<MeCheckResult> => {
  if (pendingMe) return pendingMe;
  pendingMe = (async () => {
    try {
      const res = await $api.MeInfo();
      if (res.status.code === $enum.apiStatus.success) return 'ok';
      return 'fail';
    } catch {
      return 'fail';
    } finally {
      // 路由切換後重置，下一次進站重新驗證
      setTimeout(() => { pendingMe = null; }, 0);
    }
  })();
  return pendingMe;
};

export default defineNuxtRouteMiddleware(async () => {
  // SSR 短路：cookie 解密與 me 預檢交給 client 端執行，避免 SSR/CSR 不同源差異
  if (import.meta.server) return;

  const storeSelf = StoreSelf();
  const localePath = useLocalePath();

  // 無 token 或身分不符：直接 redirect，無需 me 預檢
  if (! storeSelf.isSignIn || storeSelf.selfType !== 'merchant') {
    return navigateTo(localePath('/sign-in'));
  }

  // me 預檢：失敗代表 token 已過期或身分主體在 DB 不存在/停用，清身分後 redirect
  const result = await checkMe();
  if (result === 'fail') {
    storeSelf.ClearInfo();
    return navigateTo(localePath('/sign-in'));
  }
});
