<script setup lang="ts">
// LayoutFrontDesk — 顧客面 layout
// 由 /m/{slug}/* 顧客頁面使用；header 顯示商家名（之後接 store/SSR data）
// 不含登出按鈕（顧客匿名），語系切換暫為按鈕殼（Change 8 接邏輯）
const merchantName = ref(''); // 由頁面或 route data 注入；MVP 階段先空字串
const ClickSwitchLocale = () => {
  // TODO: Change 8 接 useI18n().setLocale
};
</script>

<template lang="pug">
.LayoutFrontDesk
  header.LayoutFrontDesk__header
    .LayoutFrontDesk__brand {{ merchantName || '預約服務' }}
    .LayoutFrontDesk__actions
      button.LayoutFrontDesk__locale-btn(type="button" @click="ClickSwitchLocale") 語系
  main.LayoutFrontDesk__main
    slot
</template>

<style lang="scss" scoped>
.LayoutFrontDesk {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f7f8fa;
}

.LayoutFrontDesk__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
  background-color: #fff;
  border-bottom: 1px solid #ebeef5;
  position: sticky;
  top: 0;
  z-index: 10;
}

.LayoutFrontDesk__brand {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.LayoutFrontDesk__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.LayoutFrontDesk__locale-btn {
  border: 1px solid #dcdfe6;
  background: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
}

.LayoutFrontDesk__main {
  flex: 1;
  padding: 16px;
}
</style>
