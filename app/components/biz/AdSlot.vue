<script setup lang="ts">
// AdSlot — 廣告插槽（MVP 預留）
// v-if 控制：無內容時不渲染、不占空間
// StoreEnv.adConfig[name] 控制：未來可動態啟用某個位置的廣告

interface Props {
  name: string;
}

const props = defineProps<Props>();
const storeEnv = StoreEnv();

const ad = computed(() => storeEnv.adConfig[props.name]);
const hasAd = computed(() => !!ad.value?.enabled && !!ad.value?.html);
</script>

<template lang="pug">
.AdSlot(
  v-if="hasAd"
  :data-slot="name"
  :data-ad-enabled="true"
)
  div(v-html="ad?.html")
</template>

<style lang="scss" scoped>
.AdSlot {
  width: 100%;

  // 廣告容器邊距，由父層決定間距；自身僅做内容容納
  & > div {
    width: 100%;
  }
}
</style>
