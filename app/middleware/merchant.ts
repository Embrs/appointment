// 商家後台守門
// 用法：頁面以 definePageMeta({ middleware: ['merchant'] }) 掛載
export default defineNuxtRouteMiddleware(() => {
  const storeSelf = StoreSelf();
  if (! storeSelf.isSignIn || storeSelf.selfType !== 'merchant') {
    const localePath = useLocalePath();
    return navigateTo(localePath('/sign-in'));
  }
});
