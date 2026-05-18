<script setup lang="ts">
// LayoutBackDesk — 平台管理員 / 商家後台 layout
// 提供：側邊 nav、header（登出）、admin 標記、代理中橫條
// 代理橫條僅當 selfType='merchant' 且 /auth/me 回傳 impersonatedBy 有值時顯示
const storeSelf = StoreSelf();
const impersonation = UseImpersonation();
const useAsk = UseAsk();

const isAdmin = computed(() => storeSelf.selfType === 'admin');
const meImpersonatedBy = ref<string>('');
const isImpersonating = computed(() => !isAdmin.value && !! meImpersonatedBy.value);

const displayName = computed(() => storeSelf.userName || (isAdmin.value ? '管理員' : '商家'));

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
});
</script>

<template lang="pug">
.LayoutBackDesk
  //- 代理中橫條（紅色警示）— 僅在「merchant 視角且為代理 token」時顯示
  .LayoutBackDesk__impersonate-bar(v-if="isImpersonating")
    span.LayoutBackDesk__impersonate-text 平台管理員代理中
    button.LayoutBackDesk__impersonate-exit(
      type="button"
      @click="ClickExitImpersonation"
    ) 退出代理
  .LayoutBackDesk__body
    aside.LayoutBackDesk__sidebar
      .LayoutBackDesk__sidebar-brand
        span(v-if="isAdmin") 平台後台
        span(v-else) 商家後台
      nav.LayoutBackDesk__nav
        template(v-if="isAdmin")
          NuxtLink.LayoutBackDesk__nav-link(to="/sys") 總覽
          NuxtLink.LayoutBackDesk__nav-link(to="/sys/merchants") 商家管理
          NuxtLink.LayoutBackDesk__nav-link(to="/sys/admins") 管理員
        template(v-else)
          NuxtLink.LayoutBackDesk__nav-link(to="/admin") 首頁
          NuxtLink.LayoutBackDesk__nav-link(
            v-if="storeSelf.HasRule('merchant.settings.update')"
            to="/admin/settings"
          ) 商家設定
          NuxtLink.LayoutBackDesk__nav-link(to="/admin/share-link") 對外連結
          NuxtLink.LayoutBackDesk__nav-link(to="/admin/services") 服務
          NuxtLink.LayoutBackDesk__nav-link(to="/admin/resources") 資源
          NuxtLink.LayoutBackDesk__nav-link(to="/admin/schedule") 時段
          NuxtLink.LayoutBackDesk__nav-link(to="/admin/holidays") 休假
          NuxtLink.LayoutBackDesk__nav-link(to="/admin/queue") 叫號
          NuxtLink.LayoutBackDesk__nav-link(
            v-if="storeSelf.HasRule('merchant.staff.manage')"
            to="/admin/staff"
          ) 成員
    .LayoutBackDesk__main
      header.LayoutBackDesk__header
        .LayoutBackDesk__role-tag(v-if="isAdmin") 平台管理員
        .LayoutBackDesk__role-tag.LayoutBackDesk__role-tag--impersonate(v-else-if="isImpersonating") 代理中
        .LayoutBackDesk__spacer
        .LayoutBackDesk__user {{ displayName }}
        button.LayoutBackDesk__signout-btn(type="button" @click="ClickSignOut") 登出
      .LayoutBackDesk__content
        slot
</template>

<style lang="scss" scoped>
.LayoutBackDesk {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.LayoutBackDesk__impersonate-bar {
  background-color: #f56c6c;
  color: #fff;
  font-size: 13px;
  text-align: center;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.LayoutBackDesk__impersonate-text {
  font-weight: 600;
}

.LayoutBackDesk__impersonate-exit {
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  padding: 2px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.LayoutBackDesk__impersonate-exit:hover {
  background-color: #fff;
  color: #f56c6c;
}

.LayoutBackDesk__body {
  flex: 1;
  display: flex;
}

.LayoutBackDesk__sidebar {
  width: 200px;
  background-color: #20222a;
  color: #cfd3dc;
  display: flex;
  flex-direction: column;
}

.LayoutBackDesk__sidebar-brand {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid #2d3038;
}

.LayoutBackDesk__nav {
  flex: 1;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
}

.LayoutBackDesk__nav-link {
  display: block;
  padding: 10px 16px;
  font-size: 14px;
  color: #cfd3dc;
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.LayoutBackDesk__nav-link:hover {
  background-color: #2d3038;
  color: #fff;
}

.LayoutBackDesk__nav-link.router-link-active {
  background-color: #409eff;
  color: #fff;
}

.LayoutBackDesk__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.LayoutBackDesk__header {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background-color: #fff;
  border-bottom: 1px solid #ebeef5;
}

.LayoutBackDesk__role-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: #ecf5ff;
  color: #409eff;
}

.LayoutBackDesk__role-tag--impersonate {
  background-color: #fef0f0;
  color: #f56c6c;
}

.LayoutBackDesk__spacer {
  flex: 1;
}

.LayoutBackDesk__user {
  font-size: 14px;
  color: #606266;
}

.LayoutBackDesk__signout-btn {
  border: 1px solid #dcdfe6;
  background: #fff;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
}

.LayoutBackDesk__signout-btn:hover {
  color: #f56c6c;
  border-color: #f56c6c;
}

.LayoutBackDesk__content {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

@media (max-width: 640px) {
  .LayoutBackDesk__body {
    flex-direction: column;
  }
  .LayoutBackDesk__sidebar {
    width: 100%;
    flex-direction: row;
    overflow-x: auto;
  }
  .LayoutBackDesk__sidebar-brand {
    border-bottom: 0;
    border-right: 1px solid #2d3038;
    flex-shrink: 0;
  }
  .LayoutBackDesk__nav {
    flex-direction: row;
    padding: 0;
  }
  .LayoutBackDesk__nav-link {
    flex-shrink: 0;
    padding: 14px 16px;
  }
}
</style>
