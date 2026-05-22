// 平台管理員頁面守門
// 用法：頁面以 definePageMeta({ middleware: ['admin'] }) 掛載
// 進站前 await /nuxt-api/auth/me 驗證 session（token 失效時直接 redirect 登入頁）
// SSR 期間短路；admin / merchant middleware 各自共享 in-flight promise 避免並發重複呼叫
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
      setTimeout(() => { pendingMe = null; }, 0);
    }
  })();
  return pendingMe;
};

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return;

  const storeSelf = StoreSelf();
  const localePath = useLocalePath();

  if (! storeSelf.isSignIn || storeSelf.selfType !== 'admin') {
    return navigateTo(localePath('/sys/sign-in'));
  }

  const result = await checkMe();
  if (result === 'fail') {
    storeSelf.ClearInfo();
    return navigateTo(localePath('/sys/sign-in'));
  }
});
