<script setup lang="ts">
// LayoutBackDesk — 平台管理員 / 商家後台 layout
// 提供：側邊 nav、header（登出）、admin 標記、代理中橫條
// 代理橫條僅當 selfType='merchant' 且 /auth/me 回傳 impersonatedBy 有值時顯示
import { resolveProviderLabel } from '~shared/i18n/provider-label';

const { t, locale } = useI18n();
const storeSelf = StoreSelf();
const impersonation = UseImpersonation();
const useAsk = UseAsk();

const isAdmin = computed(() => storeSelf.selfType === 'admin');
const meImpersonatedBy = ref<string>('');
const isImpersonating = computed(() => !isAdmin.value && !! meImpersonatedBy.value);
const merchant = ref<SelfMerchantFull | null>(null);

const displayName = computed(() => storeSelf.userName || (isAdmin.value ? '管理員' : '商家'));
const brandLabel = computed(() => isAdmin.value ? '平台後台' : '商家後台');

const resolveLocale = (): 'zh' | 'en' | 'ja' => {
  const l = locale.value;
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('ja')) return 'ja';
  return 'zh';
};
const providerLabel = computed(() => {
  if (!merchant.value) {
    const lo = resolveLocale();
    return lo === 'zh' ? '服務人員' : lo === 'en' ? 'Provider' : 'スタッフ';
  }
  return resolveProviderLabel(merchant.value, resolveLocale());
});
const providerModeEnabled = computed(() => merchant.value?.providerModeEnabled === true);

const ApiLoadMe = async () => {
  // /auth/me 是真相來源：JWT 解析後的 impersonatedBy 才能信任
  if (!storeSelf.isSignIn) return;
  const res = await $api.MeInfo();
  if (res.status.code !== $enum.apiStatus.success) return;
  const data = res.data;
  if (data && data.type === 'merchant') {
    meImpersonatedBy.value = data.impersonatedBy ?? '';
  } else {
    meImpersonatedBy.value = '';
  }
};

const ApiLoadMerchant = async () => {
  if (isAdmin.value || !storeSelf.isSignIn) return;
  const res = await $api.GetSelfMerchant();
  if (res.status.code === $enum.apiStatus.success) merchant.value = res.data.merchant;
};

const ClickSignOut = async () => {
  const ok = await useAsk.SignOut();
  if (!ok) return;
  // 登出時若處於代理中：清備份避免殘留
  if (isImpersonating.value) impersonation.ClearBackup();
  storeSelf.SignOut();
};

const ClickExitImpersonation = async () => {
  await impersonation.ExitImpersonation();
};

onMounted(() => {
  ApiLoadMe();
  ApiLoadMerchant();
});
</script>

<template lang="pug">
.LayoutBackDesk
  //- 代理中橫條（紅色警示）— 僅在「merchant 視角且為代理 token」時顯示
  .LayoutBackDesk__impersonateBar(v-if="isImpersonating")
    .LayoutBackDesk__impersonateDot
    span.LayoutBackDesk__impersonateText 平台管理員代理中
    button.LayoutBackDesk__impersonateExit(
      type="button"
      @click="ClickExitImpersonation"
    ) 退出代理

  .LayoutBackDesk__body
    //- 側邊欄
    aside.LayoutBackDesk__sidebar
      NuxtLinkLocale.LayoutBackDesk__brand(to="/")
        .LayoutBackDesk__brandMark A
        .LayoutBackDesk__brandText
          .LayoutBackDesk__brandName Appointment
          .LayoutBackDesk__brandRole {{ brandLabel }}

      nav.LayoutBackDesk__nav
        template(v-if="isAdmin")
          NuxtLinkLocale.LayoutBackDesk__navLink(to="/sys") 總覽
          NuxtLinkLocale.LayoutBackDesk__navLink(to="/sys/merchants") 商家管理
          NuxtLinkLocale.LayoutBackDesk__navLink(to="/sys/admins") 管理員
        template(v-else)
          .LayoutBackDesk__navSection
            .LayoutBackDesk__navSectionTitle {{ t('admin.nav.sectionOperate') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(to="/admin") {{ t('admin.nav.home') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(to="/admin/appointments") {{ t('admin.nav.appointments') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(to="/admin/queue") {{ t('admin.nav.queue') }}
          .LayoutBackDesk__navSection
            .LayoutBackDesk__navSectionTitle {{ t('admin.nav.sectionSchedule') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(to="/admin/schedule") {{ t('admin.nav.schedule') }}
          .LayoutBackDesk__navSection
            .LayoutBackDesk__navSectionTitle {{ t('admin.nav.sectionSettings') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(
              v-if="storeSelf.HasRule('merchant.settings.update')"
              to="/admin/settings"
            ) {{ t('admin.nav.settings') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(to="/admin/share-link") {{ t('admin.nav.shareLink') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(to="/admin/services") {{ t('admin.nav.services') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(to="/admin/resources") {{ t('admin.nav.resources') }}
            NuxtLinkLocale.LayoutBackDesk__navLink(
              v-if="providerModeEnabled"
              to="/admin/providers"
            ) {{ t('admin.nav.providers', { label: providerLabel }) }}
            NuxtLinkLocale.LayoutBackDesk__navLink(
              v-if="storeSelf.HasRule('merchant.staff.manage')"
              to="/admin/staff"
            ) {{ t('admin.nav.staff') }}

      .LayoutBackDesk__sidebarFooter
        .LayoutBackDesk__sidebarUser
          .LayoutBackDesk__sidebarAvatar {{ displayName.charAt(0).toUpperCase() }}
          .LayoutBackDesk__sidebarMeta
            .LayoutBackDesk__sidebarName {{ displayName }}
            .LayoutBackDesk__sidebarRole {{ isAdmin ? '平台管理員' : '商家成員' }}

    //- 主要內容區
    .LayoutBackDesk__main
      header.LayoutBackDesk__header
        .LayoutBackDesk__headerLeft
          .LayoutBackDesk__roleTag(v-if="isAdmin") 平台管理員
          .LayoutBackDesk__roleTag.LayoutBackDesk__roleTag--impersonate(v-else-if="isImpersonating") 代理中
          .LayoutBackDesk__roleTag.LayoutBackDesk__roleTag--merchant(v-else) 商家
        .LayoutBackDesk__headerRight
          .LayoutBackDesk__user {{ displayName }}
          button.LayoutBackDesk__signoutBtn(type="button" @click="ClickSignOut") 登出
      .LayoutBackDesk__content
        slot
</template>

<style lang="scss" scoped>
$sidebarWidth: 240px;
$headerHeight: 60px;

.LayoutBackDesk {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

// 代理中橫條 ----
.LayoutBackDesk__impersonateBar {
  background: linear-gradient(135deg, #ee5151 0%, #d63a3a 100%);
  color: $white;
  font-size: 13px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.LayoutBackDesk__impersonateDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: $white;
  animation: backDeskPulse 1.6s ease-in-out infinite;
}

@keyframes backDeskPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.LayoutBackDesk__impersonateText {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.LayoutBackDesk__impersonateExit {
  background-color: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: $white;
  padding: 4px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.LayoutBackDesk__impersonateExit:hover {
  background-color: $white;
  color: #d63a3a;
}

// 主版型 ----
.LayoutBackDesk__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

// 側邊欄 ----
.LayoutBackDesk__sidebar {
  width: $sidebarWidth;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  color: rgba(255, 255, 255, 0.85);
  background:
    radial-gradient(400px 300px at 100% 0%, rgba(0, 173, 169, 0.18), transparent 60%),
    radial-gradient(500px 400px at 0% 100%, rgba(235, 139, 45, 0.12), transparent 60%),
    linear-gradient(180deg, $primary 0%, #283c66 60%, #1d2c4a 100%);
  position: relative;
}

.LayoutBackDesk__sidebar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background-color: rgba(255, 255, 255, 0.06);
}

.LayoutBackDesk__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 20px;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.LayoutBackDesk__brandMark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, $secondary, $tertiary);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 17px;
  flex-shrink: 0;
}

.LayoutBackDesk__brandText {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.LayoutBackDesk__brandName {
  font-size: 14px;
  font-weight: 700;
  color: $white;
  letter-spacing: 0.02em;
}

.LayoutBackDesk__brandRole {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.04em;
  margin-top: 2px;
}

// 導覽 ----
.LayoutBackDesk__nav {
  flex: 1;
  padding: 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.LayoutBackDesk__navSection {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.LayoutBackDesk__navSection:last-child {
  border-bottom: none;
}

.LayoutBackDesk__navSectionTitle {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.38);
  padding: 6px 14px 4px;
}

.LayoutBackDesk__navLink {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
  border-radius: 8px;
  transition: background-color 0.15s ease, color 0.15s ease;
  position: relative;
}

.LayoutBackDesk__navLink:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: $white;
}

.LayoutBackDesk__navLink.router-link-exact-active,
.LayoutBackDesk__navLink.router-link-active {
  background-color: rgba(255, 255, 255, 0.14);
  color: $white;
  font-weight: 600;
}

.LayoutBackDesk__navLink.router-link-active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  background: linear-gradient(180deg, $secondary, $tertiary);
  border-radius: 0 3px 3px 0;
}

// Sidebar footer ----
.LayoutBackDesk__sidebarFooter {
  padding: 14px 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.LayoutBackDesk__sidebarUser {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.05);
}

.LayoutBackDesk__sidebarAvatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, $secondary, $tertiary);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.LayoutBackDesk__sidebarMeta {
  flex: 1;
  min-width: 0;
}

.LayoutBackDesk__sidebarName {
  font-size: 13px;
  font-weight: 600;
  color: $white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.LayoutBackDesk__sidebarRole {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 1px;
}

// 主內容區 ----
.LayoutBackDesk__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.LayoutBackDesk__header {
  height: $headerHeight;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background-color: $white;
  border-bottom: 1px solid #e9ecf2;
}

.LayoutBackDesk__headerLeft,
.LayoutBackDesk__headerRight {
  display: flex;
  align-items: center;
  gap: 14px;
}

.LayoutBackDesk__roleTag {
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background-color: rgba(53, 77, 123, 0.1);
  color: $primary;
}

.LayoutBackDesk__roleTag--merchant {
  background-color: rgba(0, 173, 169, 0.12);
  color: $secondary;
}

.LayoutBackDesk__roleTag--impersonate {
  background-color: rgba(238, 81, 81, 0.12);
  color: #d63a3a;
}

.LayoutBackDesk__user {
  font-size: 13.5px;
  color: rgba(69, 69, 69, 0.85);
  font-weight: 500;
}

.LayoutBackDesk__signoutBtn {
  border: 1px solid rgba(53, 77, 123, 0.18);
  background-color: $white;
  padding: 6px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: $primary;
  font-weight: 500;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.LayoutBackDesk__signoutBtn:hover {
  border-color: $primary;
  background-color: rgba(53, 77, 123, 0.04);
}

.LayoutBackDesk__content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}

// RWD ----
@media (max-width: 960px) {
  .LayoutBackDesk__sidebar {
    width: 200px;
  }
}

@media (max-width: 760px) {
  .LayoutBackDesk__body {
    flex-direction: column;
  }

  .LayoutBackDesk__sidebar {
    width: 100%;
    flex-direction: column;
  }

  .LayoutBackDesk__brand {
    padding: 14px 16px;
  }

  .LayoutBackDesk__nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 8px;
    gap: 4px;
  }

  .LayoutBackDesk__navSection {
    flex-direction: row;
    padding: 0;
    border-bottom: none;
    gap: 4px;
  }

  .LayoutBackDesk__navSectionTitle {
    display: none;
  }

  .LayoutBackDesk__navLink {
    flex-shrink: 0;
    padding: 8px 12px;
    font-size: 13px;
  }

  .LayoutBackDesk__navLink.router-link-active::before {
    display: none;
  }

  .LayoutBackDesk__sidebarFooter {
    display: none;
  }

  .LayoutBackDesk__sidebar::after {
    display: none;
  }

  .LayoutBackDesk__header {
    padding: 0 16px;
  }

  .LayoutBackDesk__content {
    padding: 16px;
  }
}
</style>
