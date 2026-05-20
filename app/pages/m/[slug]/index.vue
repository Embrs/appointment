<script setup lang="ts">
// PageMerchantHome — 顧客面：商家公開首頁
definePageMeta({ layout: 'front-desk' });

const route = useRoute();
const localePath = useLocalePath();
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
  navigateTo(localePath(`/m/${slug.value}/book?serviceId=${serviceId}`));
};

const ClickQueue = (_serviceId: string) => {
  navigateTo(localePath(`/m/${slug.value}/queue`));
};

const ClickLookup = () => navigateTo(localePath(`/m/${slug.value}/lookup`));
const ClickMyBookings = () => navigateTo(localePath(`/m/${slug.value}/my-bookings`));

onMounted(ApiLoad);
</script>

<template lang="pug">
.PageMerchantHome
  BizAdSlot(name="merchant-page-top")
  .PageMerchantHome__loading(v-if="loading") {{ $t('common.loading') }}
  .PageMerchantHome__empty(v-else-if="!merchant") {{ $t('booking.messages.notFound') }}
  template(v-else)
    //- Hero 卡
    .PageMerchantHome__hero(:class="{ 'PageMerchantHome__hero--noCover': !merchant.coverUrl }")
      img.PageMerchantHome__cover(v-if="merchant.coverUrl" :src="merchant.coverUrl" :alt="merchant.name")
      .PageMerchantHome__info
        img.PageMerchantHome__logo(v-if="merchant.logoUrl" :src="merchant.logoUrl" :alt="merchant.name")
        .PageMerchantHome__logoFallback(v-else) {{ (merchant.name || '?').charAt(0).toUpperCase() }}
        .PageMerchantHome__titleBlock
          h1.PageMerchantHome__name {{ merchant.name }}
          p.PageMerchantHome__desc(v-if="merchant.description") {{ merchant.description }}

    //- 快速操作
    .PageMerchantHome__quick
      button.PageMerchantHome__quickBtn(type="button" @click="ClickMyBookings")
        span.PageMerchantHome__quickIcon ◉
        span {{ $t('booking.nav.myBookings') }}
      button.PageMerchantHome__quickBtn(type="button" @click="ClickLookup")
        span.PageMerchantHome__quickIcon ⌕
        span {{ $t('booking.nav.lookup') }}

    //- 服務區
    .PageMerchantHome__section
      h2.PageMerchantHome__sectionTitle {{ $t('admin.nav.services') }}
      .PageMerchantHome__empty(v-if="services.length === 0") {{ $t('booking.messages.emptyList') }}
      .PageMerchantHome__grid(v-else)
        BizServiceCard(
          v-for="s in services"
          :key="s.id"
          :service="s"
          @click-book="ClickBook"
          @click-queue="ClickQueue"
        )
</template>

<style lang="scss" scoped>
.PageMerchantHome {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.PageMerchantHome__loading,
.PageMerchantHome__empty {
  padding: 32px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}

// Hero ----
.PageMerchantHome__hero {
  background-color: $white;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -8px rgba(31, 42, 68, 0.1);
}

.PageMerchantHome__hero--noCover {
  background: linear-gradient(135deg, $primary 0%, #2a3d62 60%, #1d2c4a 100%);
  color: $white;
  position: relative;
  overflow: hidden;
}

.PageMerchantHome__hero--noCover::before {
  content: '';
  position: absolute;
  top: -60px;
  right: -40px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 173, 169, 0.3), transparent 60%);
  pointer-events: none;
}

.PageMerchantHome__cover {
  width: 100%;
  aspect-ratio: 16 / 7;
  object-fit: cover;
  display: block;
}

.PageMerchantHome__info {
  display: flex;
  gap: 14px;
  padding: 20px 22px;
  align-items: center;
  position: relative;
}

.PageMerchantHome__logo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid $white;
  box-shadow: 0 4px 12px -4px rgba(31, 42, 68, 0.2);
  flex-shrink: 0;
}

.PageMerchantHome__logoFallback {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, $secondary, $tertiary);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 22px;
  flex-shrink: 0;
}

.PageMerchantHome__titleBlock {
  flex: 1;
  min-width: 0;
}

.PageMerchantHome__name {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.005em;
}

.PageMerchantHome__hero:not(.PageMerchantHome__hero--noCover) .PageMerchantHome__name {
  color: $primary;
}

.PageMerchantHome__desc {
  margin: 6px 0 0;
  font-size: 13.5px;
  line-height: 1.6;
  opacity: 0.78;
}

// 快速操作 ----
.PageMerchantHome__quick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.PageMerchantHome__quickBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: $white;
  border: 1px solid rgba(53, 77, 123, 0.12);
  color: $primary;
  font-size: 14px;
  font-weight: 600;
  padding: 13px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.PageMerchantHome__quickBtn:hover {
  transform: translateY(-1px);
  border-color: $primary;
  box-shadow: 0 8px 16px -8px rgba(53, 77, 123, 0.25);
}

.PageMerchantHome__quickIcon {
  font-size: 16px;
  color: $secondary;
}

// 服務區 ----
.PageMerchantHome__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.PageMerchantHome__sectionTitle {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: $primary;
  letter-spacing: -0.005em;
  position: relative;
  padding-left: 12px;
}

.PageMerchantHome__sectionTitle::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, $primary, $secondary);
}

.PageMerchantHome__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
</style>
