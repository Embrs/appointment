<script setup lang="ts">
// PageSysImpersonate — 平台管理員代理進入商家後台的中介頁
// 1) 呼叫 impersonate API 取代理 token
// 2) UseImpersonation.EnterImpersonation 備份 admin 身分 + 寫入商家身分
// 3) navigateTo /admin，進入商家後台（紅色橫條由 back-desk layout 渲染）
definePageMeta({
  layout: 'default',
  middleware: ['admin']
});

const route = useRoute();
const merchantId = computed(() => String(route.params.merchantId ?? ''));

const errorMsg = ref('');

const RunFlow = async () => {
  if (!merchantId.value) {
    errorMsg.value = '缺少商家 ID';
    setTimeout(() => navigateTo('/sys/merchants'), 2000);
    return;
  }
  const res = await $api.SysImpersonateMerchant({ id: merchantId.value });
  if (res.status.code !== $enum.apiStatus.success) {
    errorMsg.value = res.status.message?.zh_tw || '代理失敗';
    setTimeout(() => navigateTo('/sys/merchants'), 3000);
    return;
  }
  const { token, merchantId: mid, ownerName, ownerEmail } = res.data;
  UseImpersonation().EnterImpersonation({
    token,
    merchantId: mid,
    role: 'OWNER',
    userName: ownerName,
    userEmail: ownerEmail
  });
  await navigateTo('/admin', { replace: true });
};

onMounted(() => {
  RunFlow();
});
</script>

<template lang="pug">
.PageSysImpersonate
  .PageSysImpersonate__card
    template(v-if="errorMsg")
      p.PageSysImpersonate__error {{ errorMsg }}
      p.PageSysImpersonate__hint 即將返回商家列表...
    template(v-else)
      p.PageSysImpersonate__loading 正在進入商家後台...
</template>

<style lang="scss" scoped>
.PageSysImpersonate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  padding: 24px;
}

.PageSysImpersonate__card {
  background-color: #fff;
  border-radius: 8px;
  padding: 32px 40px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 6%);
  text-align: center;
  min-width: 280px;
}

.PageSysImpersonate__loading {
  margin: 0;
  font-size: 15px;
  color: #606266;
}

.PageSysImpersonate__error {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: #f56c6c;
}

.PageSysImpersonate__hint {
  margin: 0;
  font-size: 13px;
  color: #909399;
}
</style>
