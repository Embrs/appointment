<script setup lang="ts">
// PageAdminHolidays — 舊路由 redirect 至 /admin/schedule?tab=holidays
// 公休日已整合到「排班」整合頁;此頁僅保留作為書籤相容入口
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const localePath = useLocalePath();
onMounted(async () => {
  await navigateTo(localePath('/admin/schedule?tab=holidays'), { replace: true });
});
</script>

<template lang="pug">
.PageAdminHolidaysRedirect
  .PageAdminHolidaysRedirect__loading 載入中…
</template>

<style lang="scss" scoped>
.PageAdminHolidaysRedirect__loading {
  padding: 32px 24px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}
</style>
