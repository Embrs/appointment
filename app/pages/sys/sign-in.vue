<script setup lang="ts">
// PageSysSignIn — 平台管理員登入入口
// 為避免兩處維護登入表單，本頁僅將 `/sys/sign-in` 重導到 `/sign-in?type=admin`
// Change 1 的 admin middleware / 401 跳轉皆指向此路徑，保持向後相容
definePageMeta({ layout: 'default' });

const localePath = useLocalePath();
if (import.meta.client) {
  await navigateTo(localePath('/sign-in?type=admin'), { replace: true });
}
</script>

<template lang="pug">
.PageSysSignIn
  p 重新導向至平台管理員登入...
</template>

<style lang="scss" scoped>
.PageSysSignIn {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}
</style>
