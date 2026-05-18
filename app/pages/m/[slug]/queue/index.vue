<script setup lang="ts">
// PageQueueLanding — 顧客領號頁
definePageMeta({ layout: 'front-desk' });

const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ''));
const sessionStore = StoreCustomerSession();
const queueStore = StoreQueueRealtime();

const loading = ref(true);
const taking = ref(false);
const merchant = ref<PublicMerchantItem | null>(null);
const queueServices = ref<PublicServiceItem[]>([]);

// 載入商家公開資訊，並只保留 QUEUE 模式服務
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
    queueServices.value = res.data.services.filter((s) => s.bookingMode === 'QUEUE');
    sessionStore.AddSlug(slug.value);
  } finally {
    loading.value = false;
  }
};

const ApiTake = async (serviceId: string, customer: CustomerTripletShape) => {
  if (!merchant.value) return;
  taking.value = true;
  try {
    const res = await $api.TakeQueueTicket({
      slug: slug.value,
      serviceId,
      customer: { lastName: customer.lastName, title: customer.title, phone: customer.phone }
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '領號失敗');
      return;
    }
    sessionStore.SetTriplet(customer);
    // 直接導向 status 頁，由 status 頁負責建立 WS 連線
    navigateTo(`/m/${slug.value}/queue/status?id=${res.data.ticketId}`);
  } finally {
    taking.value = false;
  }
};

const { t } = useI18n();

const ClickTake = async (serviceId: string) => {
  const prefill = sessionStore.triplet;
  const result = await $open.DialogCustomerForm({
    title: t('queue.page.formTitle'),
    submitLabel: t('queue.page.formSubmit'),
    initial: prefill ?? undefined
  });
  if (!result.done || !result.triplet) return;
  await ApiTake(serviceId, result.triplet);
};

onMounted(ApiLoad);

const TitleHint = (mode: string) => mode === 'QUEUE' ? t('admin.bookingMode.QUEUE') : '';
</script>

<template lang="pug">
.PageQueueLanding
  .PageQueueLanding__loading(v-if="loading") …
  .PageQueueLanding__empty(v-else-if="!merchant") {{ $t('booking.messages.notFound') }}
  template(v-else)
    .PageQueueLanding__head
      NuxtLink.PageQueueLanding__back(:to="`/m/${slug}`") ← {{ merchant.name }}
      h1.PageQueueLanding__title {{ $t('queue.page.landingTitle') }}
      p.PageQueueLanding__desc {{ $t('queue.page.landingHint') }}

    .PageQueueLanding__empty(v-if="queueServices.length === 0") {{ $t('queue.page.adminEmpty') }}
    .PageQueueLanding__list(v-else)
      .PageQueueLanding__card(v-for="s in queueServices" :key="s.id")
        .PageQueueLanding__card-head
          .PageQueueLanding__card-name {{ s.name }}
          .PageQueueLanding__card-mode {{ TitleHint(s.bookingMode) }}
        .PageQueueLanding__card-desc(v-if="s.description") {{ s.description }}
        .PageQueueLanding__card-foot
          ElButton(
            type="primary"
            :loading="taking"
            data-testid="queue-take-btn"
            @click="ClickTake(s.id)"
          ) {{ $t('queue.page.take') }}
</template>

<style lang="scss" scoped>
.PageQueueLanding {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.PageQueueLanding__loading,
.PageQueueLanding__empty {
  padding: 32px;
  text-align: center;
  color: #909399;
}

.PageQueueLanding__back {
  font-size: 14px;
  color: #606266;
  text-decoration: none;
}

.PageQueueLanding__title {
  margin: 8px 0 4px;
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.PageQueueLanding__desc {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.PageQueueLanding__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.PageQueueLanding__card {
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.PageQueueLanding__card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.PageQueueLanding__card-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.PageQueueLanding__card-mode {
  font-size: 12px;
  color: #67c23a;
  background: #f0f9eb;
  padding: 2px 10px;
  border-radius: 12px;
}

.PageQueueLanding__card-desc {
  font-size: 13px;
  color: #909399;
}

.PageQueueLanding__card-foot {
  display: flex;
  justify-content: flex-end;
}
</style>
