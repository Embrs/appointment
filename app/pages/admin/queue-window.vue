<script setup lang="ts">
// PageAdminQueueWindow — 舊路由 redirect 至 /admin/schedule?tab=queue-window
// 領號時間已整合到「排班」整合頁;此頁僅保留作為書籤相容入口
definePageMeta({ layout: 'back-desk', middleware: 'merchant' });

const localePath = useLocalePath();
onMounted(async () => {
  await navigateTo(localePath('/admin/schedule?tab=queue-window'), { replace: true });
});
</script>

<template lang="pug">
.PageAdminQueueWindowRedirect
  .PageAdminQueueWindowRedirect__loading 載入中…
</template>

<style lang="scss" scoped>
.PageAdminQueueWindowRedirect__loading {
  padding: 32px 24px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}
</style>
