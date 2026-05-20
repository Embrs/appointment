<script setup lang="ts">
// PageAdminShareLink — 顯示 /m/{slug} 連結 + QR code
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const merchant = ref<SelfMerchantFull | null>(null);
// 初值 false：避免 v-loading 在 page transition mount 階段就建立 mask 而卡住
const loading = ref(false);

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
  BizPageHeader(title="對外連結" subtitle="把連結傳給顧客，或印 QR code 張貼於店面")
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
        NuxtLinkLocale(to="/admin/settings") 前往商家設定
</template>

<style lang="scss" scoped>
.PageAdminShareLink__card {
  background-color: $white;
  border-radius: 14px;
  padding: 28px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -10px rgba(31, 42, 68, 0.08);
  max-width: 520px;
}

.PageAdminShareLink__hint {
  margin: 0 0 14px 0;
  font-size: 13.5px;
  color: rgba(69, 69, 69, 0.7);
  line-height: 1.6;
}

.PageAdminShareLink__url-row {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.PageAdminShareLink__qr-wrap {
  display: flex;
  justify-content: center;
  padding: 20px;
  background-color: $bg;
  border-radius: 10px;
}

.PageAdminShareLink__empty {
  margin: 0;
  color: rgba(69, 69, 69, 0.6);
  font-size: 14px;
  display: flex;
  gap: 6px;
}
</style>
