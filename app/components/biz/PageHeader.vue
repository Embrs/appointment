<script setup lang="ts">
// BizPageHeader — 後台內部頁的統一頁首
// 用法：
//   BizPageHeader(title="服務管理" subtitle="管理你提供的服務項目")
//     template(#actions)
//       ElButton(type="primary") + 新增

defineProps<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
}>();
</script>

<template lang="pug">
header.BizPageHeader
  .BizPageHeader__main
    .BizPageHeader__eyebrow(v-if="eyebrow") {{ eyebrow }}
    h1.BizPageHeader__title {{ title }}
    p.BizPageHeader__subtitle(v-if="subtitle") {{ subtitle }}
  .BizPageHeader__actions(v-if="$slots.actions")
    slot(name="actions")
</template>

<style lang="scss" scoped>
.BizPageHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(53, 77, 123, 0.08);
}

.BizPageHeader__main {
  min-width: 0;
  flex: 1;
}

.BizPageHeader__eyebrow {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 999px;
  background-color: rgba(53, 77, 123, 0.08);
  color: $primary;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.BizPageHeader__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
  position: relative;
  padding-left: 14px;
}

.BizPageHeader__title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 20px;
  border-radius: 2px;
  background: linear-gradient(180deg, $primary, $secondary);
}

.BizPageHeader__subtitle {
  margin: 8px 0 0;
  padding-left: 14px;
  font-size: 13px;
  color: rgba(69, 69, 69, 0.6);
  line-height: 1.6;
}

.BizPageHeader__actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .BizPageHeader {
    flex-direction: column;
    align-items: stretch;
  }

  .BizPageHeader__title {
    font-size: 20px;
  }

  .BizPageHeader__actions {
    flex-wrap: wrap;
  }
}
</style>
