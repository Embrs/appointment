<script setup lang="ts">
// LayoutFrontDesk — 顧客面 layout
// /m/{slug}/* 顧客頁面共用；header 顯示商家名（之後接 store/SSR data）
// 不含登出按鈕（顧客匿名），語系切換使用 ElDropdown + useI18n().setLocale
const merchantName = ref('');

const { locale, locales, setLocale } = useI18n();

interface LocaleOption {
  code: string;
  name?: string;
  iso?: string;
}

const localeOptions = computed<LocaleOption[]>(() => (locales.value as LocaleOption[]) ?? []);

const CurrentLocaleName = computed(() => {
  const found = localeOptions.value.find((l) => l.code === locale.value);
  return found?.name ?? locale.value;
});

const ClickSetLocale = async (code: string) => {
  if (code === locale.value) return;
  await setLocale(code as 'zh' | 'en' | 'ja');
};
</script>

<template lang="pug">
.LayoutFrontDesk
  header.LayoutFrontDesk__header
    .LayoutFrontDesk__headerInner
      .LayoutFrontDesk__brand
        .LayoutFrontDesk__brandMark A
        .LayoutFrontDesk__brandName {{ merchantName || '預約服務' }}
      .LayoutFrontDesk__actions
        ElDropdown(trigger="click" @command="ClickSetLocale")
          button.LayoutFrontDesk__localeBtn(
            type="button"
            data-testid="locale-switch-btn"
            :aria-label="$t('booking.actions.switchLocale')"
          )
            NuxtIcon.LayoutFrontDesk__localeIcon(name="mdi:translate")
            span.LayoutFrontDesk__localeName {{ CurrentLocaleName }}
          template(#dropdown)
            ElDropdownMenu
              ElDropdownItem(
                v-for="l in localeOptions"
                :key="l.code"
                :command="l.code"
                :disabled="l.code === locale"
              ) {{ l.name }}
  main.LayoutFrontDesk__main
    .LayoutFrontDesk__container
      slot
</template>

<style lang="scss" scoped>
.LayoutFrontDesk {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $bg;
}

.LayoutFrontDesk__header {
  height: 60px;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid rgba(53, 77, 123, 0.08);
  position: sticky;
  top: 0;
  z-index: 10;
}

.LayoutFrontDesk__headerInner {
  max-width: 960px;
  margin: 0 auto;
  height: 100%;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.LayoutFrontDesk__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.LayoutFrontDesk__brandMark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, $primary, $secondary);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.LayoutFrontDesk__brandName {
  font-size: 15px;
  font-weight: 700;
  color: $primary;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.LayoutFrontDesk__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.LayoutFrontDesk__localeBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(53, 77, 123, 0.15);
  background-color: $white;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12.5px;
  color: $primary;
  font-weight: 500;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.LayoutFrontDesk__localeBtn:hover {
  border-color: $primary;
  background-color: rgba(53, 77, 123, 0.04);
}

.LayoutFrontDesk__localeIcon {
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  color: $secondary;
}

.LayoutFrontDesk__localeName {
  line-height: 1.2;
}

.LayoutFrontDesk__main {
  flex: 1;
}

.LayoutFrontDesk__container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 20px 48px;
}

@media (max-width: 640px) {
  .LayoutFrontDesk__headerInner {
    padding: 0 16px;
  }

  .LayoutFrontDesk__container {
    padding: 16px 16px 32px;
  }
}
</style>
