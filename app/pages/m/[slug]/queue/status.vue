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

const ClickBackQueue = () => navigateTo(`/m/${slug.value}/queue`);

onMounted(ApiLoad);

onBeforeUnmount(() => {
  queueStore.Disconnect();
  queueStore.ClearMyTicket();
});
</script>

<template lang="pug">
.PageQueueStatus
  BizCustomerPageHeader(
    :title="$t('queue.page.statusYourNumber')"
    :back-to="`/m/${slug}/queue`"
  )
  .PageQueueStatus__loading(v-if="loading") 載入中…
  .PageQueueStatus__empty(v-else-if="initError")
    .PageQueueStatus__emptyIcon !
    p.PageQueueStatus__emptyText {{ initError }}
    ElButton(type="primary" @click="ClickBackQueue") {{ $t('common.back') }}
  template(v-else-if="MyTicket")
    //- 狀態 bar
    .PageQueueStatus__bar
      .PageQueueStatus__barService
        .PageQueueStatus__barEyebrow 號碼牌服務
        .PageQueueStatus__barName {{ ServiceName }}
      .PageQueueStatus__barConn(:class="{ 'PageQueueStatus__barConn--off': !queueStore.isWsConnected }")
        span.PageQueueStatus__barConnDot
        span {{ queueStore.isWsConnected ? $t('queue.page.connLive') : $t('queue.page.connFallback') }}

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
      ElButton(size="large" @click="ClickRefresh") {{ $t('common.search') }}
</template>

<style lang="scss" scoped>
.PageQueueStatus {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageQueueStatus__loading {
  padding: 32px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}

.PageQueueStatus__empty {
  padding: 40px 24px;
  text-align: center;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.PageQueueStatus__emptyIcon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: rgba(238, 81, 81, 0.1);
  color: #ee5151;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
}

.PageQueueStatus__emptyText {
  margin: 0;
  color: rgba(69, 69, 69, 0.7);
  font-size: 14px;
}

// 狀態 bar ----
.PageQueueStatus__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background-color: $white;
  padding: 14px 18px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 12px -8px rgba(31, 42, 68, 0.08);
}

.PageQueueStatus__barService {
  min-width: 0;
  flex: 1;
}

.PageQueueStatus__barEyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(69, 69, 69, 0.5);
  margin-bottom: 2px;
}

.PageQueueStatus__barName {
  font-size: 15px;
  font-weight: 700;
  color: $primary;
}

.PageQueueStatus__barConn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: $secondary;
  background-color: rgba(0, 173, 169, 0.1);
  padding: 6px 12px;
  border-radius: 999px;
  flex-shrink: 0;
}

.PageQueueStatus__barConnDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: $secondary;
  animation: pageQueueStatusPulse 1.6s ease-in-out infinite;
}

.PageQueueStatus__barConn--off {
  color: $tertiary;
  background-color: rgba(235, 139, 45, 0.1);
}

.PageQueueStatus__barConn--off .PageQueueStatus__barConnDot {
  background-color: $tertiary;
  animation: none;
}

@keyframes pageQueueStatusPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.PageQueueStatus__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.PageQueueStatus__actions > * {
  flex: 1;
  max-width: 200px;
}
</style>
