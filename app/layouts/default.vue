<script setup lang="ts">
// LayoutDefault — 簡潔通用 layout（登入頁、登出後、靜態介紹頁用）
</script>

<template lang="pug">
.LayoutDefault
  slot
</template>

<style lang="scss" scoped>
.LayoutDefault {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
