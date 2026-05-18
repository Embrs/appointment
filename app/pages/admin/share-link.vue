<script setup lang="ts">
// PageAdminShareLink — 顯示 /m/{slug} 連結 + QR code
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const merchant = ref<SelfMerchantFull | null>(null);
const loading = ref(true);

const origin = computed(() => {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
});

const shareUrl = computed(() => {
  if (!merchant.value?.slug) return '';
  return `${origin.value}/m/${merchant.value.slug}`;
});

const qrUrl = computed(() => {
  if (!shareUrl.value) return '';
  // 用 qrserver.com 公開 API 渲染（無依賴前端 QR 套件）
  const encoded = encodeURIComponent(shareUrl.value);
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`;
});

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetSelfMerchant();
    if (res.status.code !== $enum.apiStatus.success) return;
    merchant.value = res.data.merchant;
  } finally {
    loading.value = false;
  }
};

const ClickCopy = async () => {
  if (!shareUrl.value) return;
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    ElMessage.success('已複製連結');
  } catch {
    ElMessage.error('複製失敗，請手動選取');
  }
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminShareLink
  h1.PageAdminShareLink__title 對外連結
  .PageAdminShareLink__card(v-loading="loading")
    template(v-if="merchant && merchant.slug")
      p.PageAdminShareLink__hint 把以下連結傳給顧客，或印 QR code 張貼於店面：
      .PageAdminShareLink__url-row
        ElInput(:model-value="shareUrl" readonly)
        ElButton(type="primary" @click="ClickCopy") 複製
      .PageAdminShareLink__qr-wrap
        ElImage(
          v-if="qrUrl"
          :src="qrUrl"
          alt="QR code"
          fit="contain"
          style="width: 240px; height: 240px;"
        )
    template(v-else)
      p.PageAdminShareLink__empty
        | 尚未設定 slug ·
        NuxtLink(to="/admin/settings") 前往商家設定
</template>

<style lang="scss" scoped>
.PageAdminShareLink {
  padding: 8px;
}

.PageAdminShareLink__title {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.PageAdminShareLink__card {
  background-color: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
  max-width: 480px;
}

.PageAdminShareLink__hint {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #606266;
}

.PageAdminShareLink__url-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.PageAdminShareLink__qr-wrap {
  display: flex;
  justify-content: center;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 4px;
}

.PageAdminShareLink__empty {
  margin: 0;
  color: #909399;
  font-size: 14px;
  display: flex;
  gap: 6px;
}
</style>
