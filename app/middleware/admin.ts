// 平台管理員頁面守門
// 用法：頁面以 definePageMeta({ middleware: ['admin'] }) 掛載
export default defineNuxtRouteMiddleware(() => {
  const storeSelf = StoreSelf();
  if (! storeSelf.isSignIn || storeSelf.selfType !== 'admin') {
    const localePath = useLocalePath();
    return navigateTo(localePath('/sys/sign-in'));
  }
});
