<script setup lang="ts">
// PageQueueStatus — 顧客等待頁（大號碼顯示 + WS 即時 + 15 秒輪詢兜底）
definePageMeta({ layout: 'front-desk' });

const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ''));
const ticketId = computed(() => String(route.query.id ?? ''));

const { t } = useI18n();
const queueStore = StoreQueueRealtime();
const loading = ref(true);
const initError = ref('');

const MyTicket = computed(() => queueStore.myTicket);
const MyNumber = computed(() => MyTicket.value?.ticket.ticketNumber ?? 0);
const CurrentServing = computed(() => MyTicket.value?.currentServing ?? 0);
const ServiceName = computed(() => MyTicket.value?.ticket.serviceName ?? '');
const IsCalled = computed(() => MyTicket.value?.ticket.status === 'CALLED');
const IsDone = computed(() => MyTicket.value?.ticket.status === 'DONE');
const IsSkipped = computed(() => MyTicket.value?.ticket.status === 'SKIPPED');
const WaitingAhead = computed(() => MyTicket.value?.waitingAhead ?? 0);

const StatusHint = computed(() => {
  if (IsCalled.value) return t('queue.page.statusCalledHint');
  if (IsDone.value) return t('queue.page.statusDoneHint');
  if (IsSkipped.value) return t('queue.page.statusSkippedHint');
  if (WaitingAhead.value === 0) return t('queue.page.statusAheadHint', { n: 0 });
  return t('queue.page.statusAheadHint', { n: WaitingAhead.value });
});

const ApiLoad = async () => {
  if (!ticketId.value) {
    initError.value = t('queue.messages.ticketNotFound');
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const res = await $api.GetQueueTicket({ id: ticketId.value });
    if (res.status.code !== $enum.apiStatus.success) {
      initError.value = res.status.message?.zh_tw || t('queue.messages.ticketNotFound');
      queueStore.ClearMyTicket();
      return;
    }
    queueStore.SetMyTicket(ticketId.value, res.data);
    // 連 WebSocket（用 merchant.id 訂閱）
    queueStore.Connect(res.data.merchant.id);
  } finally {
    loading.value = false;
  }
};

const ClickRefresh = async () => {
  await queueStore.RefreshMyTicket();
};

const ClickBackHome = () => navigateTo(`/m/${slug.value}`);

onMounted(ApiLoad);

onBeforeUnmount(() => {
  queueStore.Disconnect();
  queueStore.ClearMyTicket();
});
</script>

<template lang="pug">
.PageQueueStatus
  .PageQueueStatus__loading(v-if="loading") …
  .PageQueueStatus__empty(v-else-if="initError")
    p {{ initError }}
    ElButton(@click="ClickBackHome") {{ $t('common.goHome') }}
  template(v-else-if="MyTicket")
    .PageQueueStatus__bar
      span.PageQueueStatus__bar-service {{ ServiceName }}
      span.PageQueueStatus__bar-conn(:class="{ 'PageQueueStatus__bar-conn--off': !queueStore.isWsConnected }")
        | {{ queueStore.isWsConnected ? `● ${$t('queue.page.connLive')}` : `○ ${$t('queue.page.connFallback')}` }}

    BizQueueDisplay.PageQueueStatus__display(
      :primary-label="$t('queue.page.statusYourNumber')"
      :primary-number="MyNumber"
      :secondary-label="$t('queue.page.statusServing')"
      :secondary-number="CurrentServing"
      :highlight="IsCalled"
      :hint="StatusHint"
      data-testid="queue-display"
    )

    BizAdSlot(name="queue-status-below")

    .PageQueueStatus__actions
      ElButton(plain @click="ClickRefresh") {{ $t('common.search') }}
      ElButton(plain @click="ClickBackHome") {{ $t('common.goHome') }}
</template>

<style lang="scss" scoped>
.PageQueueStatus {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageQueueStatus__loading,
.PageQueueStatus__empty {
  padding: 32px;
  text-align: center;
  color: #909399;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.PageQueueStatus__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.PageQueueStatus__bar-service {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.PageQueueStatus__bar-conn {
  font-size: 12px;
  color: #67c23a;
}

.PageQueueStatus__bar-conn--off {
  color: #e6a23c;
}

.PageQueueStatus__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.PageQueueStatus__ad-slot {
  // 預留廣告插槽：無內容時不佔空間
  &:empty {
    display: none;
  }
}
</style>
