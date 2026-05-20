<script setup lang="ts">
// BizCustomerPageHeader — 顧客面 / 公開頁的統一頁首
// 用法（inline，給 m/[slug]/* 等 single-column 頁）：
//   BizCustomerPageHeader(title="查詢預約" :back-to="`/m/${slug}`")
//     template(#actions)
//       ElButton(size="small") 切換身份
//
// 用法（overlay，給 sign-in/up/forgot 等 split layout，左上浮動按鈕）：
//   BizCustomerPageHeader(variant="overlay" :back-to="/")
//   // overlay 模式只顯示返回按鈕，不顯示 title/subtitle

const { t } = useI18n();
const localePath = useLocalePath();

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    backTo?: string | null;
    backLabel?: string;
    variant?: 'inline' | 'overlay';
  }>(),
  {
    title: '',
    subtitle: '',
    backTo: null,
    backLabel: '',
    variant: 'inline'
  }
);

const BackLabelText = computed(() => props.backLabel || t('common.back'));

const ClickBack = () => {
  if (!props.backTo) return;
  navigateTo(localePath(props.backTo));
};

const HasBack = computed(() => !!props.backTo);
</script>

<template lang="pug">
header.BizCustomerPageHeader(:class="`BizCustomerPageHeader--${variant}`")
  template(v-if="variant === 'overlay'")
    button.BizCustomerPageHeader__overlayBack(
      v-if="HasBack"
      type="button"
      data-testid="page-header-back"
      :aria-label="BackLabelText"
      @click="ClickBack"
    )
      span.BizCustomerPageHeader__backIcon ←
      span.BizCustomerPageHeader__backText {{ BackLabelText }}
  template(v-else)
    .BizCustomerPageHeader__bar
      button.BizCustomerPageHeader__back(
        v-if="HasBack"
        type="button"
        data-testid="page-header-back"
        :aria-label="BackLabelText"
        @click="ClickBack"
      )
        span.BizCustomerPageHeader__backIcon ←
        span.BizCustomerPageHeader__backText {{ BackLabelText }}
      .BizCustomerPageHeader__main(v-if="title || subtitle")
        h1.BizCustomerPageHeader__title(v-if="title") {{ title }}
        p.BizCustomerPageHeader__subtitle(v-if="subtitle") {{ subtitle }}
      .BizCustomerPageHeader__actions(v-if="$slots.actions")
        slot(name="actions")
</template>

<style lang="scss" scoped>
.BizCustomerPageHeader {
  width: 100%;
}

// inline 模式（給單欄頁用）----------------
.BizCustomerPageHeader--inline {
  margin-bottom: 12px;
}

.BizCustomerPageHeader__bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.BizCustomerPageHeader__back {
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
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
  min-height: 36px;
  flex-shrink: 0;
}

.BizCustomerPageHeader__back:hover {
  border-color: $primary;
  background-color: rgba(53, 77, 123, 0.04);
}

.BizCustomerPageHeader__backIcon {
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}

.BizCustomerPageHeader__backText {
  line-height: 1;
}

.BizCustomerPageHeader__main {
  min-width: 0;
  flex: 1;
}

.BizCustomerPageHeader__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
  line-height: 1.3;
}

.BizCustomerPageHeader__subtitle {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: rgba(69, 69, 69, 0.6);
  line-height: 1.5;
}

.BizCustomerPageHeader__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}

// overlay 模式（給 split layout 頁面用，左上角浮動）----------------
.BizCustomerPageHeader--overlay {
  margin-bottom: 0;
}

.BizCustomerPageHeader__overlayBack {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(8px);
  border: 1px solid rgba(53, 77, 123, 0.15);
  color: $primary;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 12px -6px rgba(31, 42, 68, 0.18);
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
  min-height: 36px;
}

.BizCustomerPageHeader__overlayBack:hover {
  border-color: $primary;
  background-color: $white;
  color: $primary;
}

// 手機版 ----------------
@media (max-width: 640px) {
  .BizCustomerPageHeader__back {
    min-height: 40px;
    padding: 8px 12px;
    font-size: 13px;
  }

  .BizCustomerPageHeader__title {
    font-size: 17px;
  }

  .BizCustomerPageHeader__bar {
    gap: 10px;
  }

  // overlay 在手機版仍可見，位置稍微內縮
  .BizCustomerPageHeader__overlayBack {
    top: 12px;
    left: 12px;
    padding: 8px 12px;
    min-height: 40px;
  }
}
</style>
