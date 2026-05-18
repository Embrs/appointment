<script setup lang="ts">
// PageMerchantHome — 顧客面：商家公開首頁
definePageMeta({ layout: 'front-desk' });

const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ''));
const loading = ref(true);
const merchant = ref<PublicMerchantItem | null>(null);
const services = ref<PublicServiceItem[]>([]);
const sessionStore = StoreCustomerSession();

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetPublicMerchant({ slug: slug.value });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '商家不存在');
      merchant.value = null;
      return;
    }
    merchant.value = res.data.merchant;
    services.value = res.data.services;
    sessionStore.AddSlug(slug.value);
  } finally {
    loading.value = false;
  }
};

const ClickBook = (serviceId: string) => {
  navigateTo(`/m/${slug.value}/book?serviceId=${serviceId}`);
};

const ClickLookup = () => navigateTo(`/m/${slug.value}/lookup`);
const ClickMyBookings = () => navigateTo(`/m/${slug.value}/my-bookings`);

onMounted(ApiLoad);
</script>

<template lang="pug">
.PageMerchantHome
  BizAdSlot(name="merchant-page-top")
  .PageMerchantHome__loading(v-if="loading") …
  .PageMerchantHome__empty(v-else-if="!merchant") {{ $t('booking.messages.notFound') }}
  template(v-else)
    .PageMerchantHome__hero
      img.PageMerchantHome__cover(v-if="merchant.coverUrl" :src="merchant.coverUrl" :alt="merchant.name")
      .PageMerchantHome__info
        img.PageMerchantHome__logo(v-if="merchant.logoUrl" :src="merchant.logoUrl" :alt="merchant.name")
        .PageMerchantHome__title-block
          h1.PageMerchantHome__name {{ merchant.name }}
          p.PageMerchantHome__desc(v-if="merchant.description") {{ merchant.description }}
    .PageMerchantHome__quick
      ElButton(plain @click="ClickMyBookings") {{ $t('booking.nav.myBookings') }}
      ElButton(plain @click="ClickLookup") {{ $t('booking.nav.lookup') }}
    .PageMerchantHome__section
      h2.PageMerchantHome__section-title {{ $t('admin.nav.services') }}
      .PageMerchantHome__empty(v-if="services.length === 0") {{ $t('booking.messages.emptyList') }}
      .PageMerchantHome__grid(v-else)
        BizServiceCard(
          v-for="s in services"
          :key="s.id"
          :service="s"
          @click-book="ClickBook"
        )
</template>

<style lang="scss" scoped>
.PageMerchantHome {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageMerchantHome__loading,
.PageMerchantHome__empty {
  padding: 32px;
  text-align: center;
  color: #909399;
}

.PageMerchantHome__hero {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
}

.PageMerchantHome__cover {
  width: 100%;
  aspect-ratio: 16 / 7;
  object-fit: cover;
  display: block;
}

.PageMerchantHome__info {
  display: flex;
  gap: 12px;
  padding: 16px;
  align-items: center;
}

.PageMerchantHome__logo {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
}

.PageMerchantHome__title-block {
  flex: 1;
}

.PageMerchantHome__name {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: #303133;
}

.PageMerchantHome__desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.PageMerchantHome__quick {
  display: flex;
  gap: 8px;
}

.PageMerchantHome__quick .el-button {
  flex: 1;
}

.PageMerchantHome__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.PageMerchantHome__section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #303133;
}

.PageMerchantHome__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
</style>
