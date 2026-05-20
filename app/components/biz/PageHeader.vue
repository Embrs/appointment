<script setup lang="ts">
// BizPageHeader — 後台內部頁的統一頁首
// 用法：
//   BizPageHeader(title="服務管理" subtitle="管理你提供的服務項目")
//     template(#actions)
//       ElButton(type="primary") + 新增
//
// 二級詳情頁可加上 back-to 提供回到列表的入口（不傳則行為與既有相同）：
//   BizPageHeader(title="商家詳情" :back-to="/sys/merchants")

const { t } = useI18n();
const localePath = useLocalePath();

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    eyebrow?: string;
    backTo?: string | null;
    backLabel?: string;
  }>(),
  {
    subtitle: '',
    eyebrow: '',
    backTo: null,
    backLabel: ''
  }
);

const BackLabelText = computed(() => props.backLabel || t('common.back'));

const ClickBack = () => {
  if (!props.backTo) return;
  navigateTo(localePath(props.backTo));
};
</script>

<template lang="pug">
header.BizPageHeader
  button.BizPageHeader__back(
    v-if="backTo"
    type="button"
    data-testid="page-header-back"
    :aria-label="BackLabelText"
    @click="ClickBack"
  )
    span.BizPageHeader__backIcon ←
    span.BizPageHeader__backText {{ BackLabelText }}
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

.BizPageHeader__back {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: transparent;
  border: 1px solid rgba(53, 77, 123, 0.15);
  color: $primary;
  font-size: 13px;
  font-weight: 500;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  min-height: 36px;
  flex-shrink: 0;
}

.BizPageHeader__back:hover {
  border-color: $primary;
  background-color: rgba(53, 77, 123, 0.04);
}

.BizPageHeader__backIcon {
  font-size: 14px;
  line-height: 1;
}

.BizPageHeader__backText {
  line-height: 1;
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

  .BizPageHeader__back {
    align-self: flex-start;
  }

  .BizPageHeader__title {
    font-size: 20px;
  }

  .BizPageHeader__actions {
    flex-wrap: wrap;
  }
}
</style>
