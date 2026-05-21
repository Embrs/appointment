<script setup lang="ts">
// PageQueueStatus — 顧客等待頁
// 整合：BizQueueDisplay（號碼）+ BizQueueProgress（進度）+ BizQueueConnectionBar（連線狀態）+ BizQueueCallOverlay（叫號蓋層）
// 標題列：CALLED 時加 🔔 前綴讓背景分頁能感知
definePageMeta({ layout: 'front-desk' });

const route = useRoute();
const localePath = useLocalePath();
const slug = computed(() => String(route.params.slug ?? ''));
const ticketId = ref<string>(String(route.query.id ?? ''));
const claimToken = computed(() => String(route.query.token ?? ''));

const { t } = useI18n();
const queueStore = StoreQueueRealtime();
const recent = UseCustomerQueueRecent();
const loading = ref(true);
const initError = ref('');
/** 使用者按了「我知道了」後本次叫號蓋層暫時隱藏；若再有新的 CALLED 事件會重置 */
const callOverlayDismissedFor = ref<string>('');

const MyTicket = computed(() => queueStore.myTicket);
const MyNumber = computed(() => MyTicket.value?.ticket.ticketNumber ?? 0);
const CurrentServing = computed(() => MyTicket.value?.currentServing ?? 0);
const TotalTaken = computed(() => MyTicket.value?.lastTicketNumber ?? 0);
const ServiceName = computed(() => MyTicket.value?.ticket.serviceName ?? '');
const MyStatus = computed(() => MyTicket.value?.ticket.status ?? 'WAITING');
const IsCalled = computed(() => MyStatus.value === 'CALLED');
const IsDone = computed(() => MyStatus.value === 'DONE');
const IsSkipped = computed(() => MyStatus.value === 'SKIPPED');
const WaitingAhead = computed(() => MyTicket.value?.waitingAhead ?? 0);

// ETA 區塊：優先用 store 即時計算（隨 WS 推播即時推進），fallback 至 myTicket.estimatedWaitMinutes
const EtaMinutes = computed<number | null>(() => {
  const t = MyTicket.value;
  if (!t) return null;
  const sid = (t.ticket as { serviceId?: string }).serviceId || '';
  if (sid) {
    const live = queueStore.GetEtaForTicket(
      { ticketNumber: t.ticket.ticketNumber, status: t.ticket.status as 'WAITING' | 'CALLED' | 'DONE' | 'SKIPPED' },
      sid
    );
    if (live !== null) return live;
  }
  return t.estimatedWaitMinutes ?? null;
});

const EtaText = computed(() => {
  if (IsCalled.value || IsDone.value || IsSkipped.value) return '';
  if (EtaMinutes.value === null) return t('queue.eta.unknown');
  if (WaitingAhead.value === 0) return t('queue.eta.almostYourTurn');
  const ahead = t('queue.eta.aheadOfYou', { n: WaitingAhead.value });
  const minutes = t('queue.eta.estimateMinutes', { n: EtaMinutes.value });
  return `${ahead} ・ ${minutes}`;
});

const StatusHint = computed(() => {
  if (IsCalled.value) return t('queue.page.statusCalledHint');
  if (IsDone.value) return t('queue.page.statusDoneHint');
  if (IsSkipped.value) return t('queue.page.statusSkippedHint');
  if (WaitingAhead.value === 0) return t('queue.page.statusAheadHint', { n: 0 });
  return t('queue.page.statusAheadHint', { n: WaitingAhead.value });
});

const ShowCallOverlay = computed(() =>
  IsCalled.value && ticketId.value && callOverlayDismissedFor.value !== ticketId.value
);

// document.title：CALLED 時加鈴鐺前綴
useHead({
  title: () => {
    if (!ServiceName.value) return t('queue.page.statusYourNumber');
    if (IsCalled.value) {
      return t('queue.page.titleCalled', { serviceName: ServiceName.value, n: MyNumber.value });
    }
    return t('queue.page.titleWaiting', { serviceName: ServiceName.value });
  }
});

// 監聽 status 變化，若從非 CALLED → CALLED 重置 dismissed
watch(IsCalled, (now) => {
  if (now) {
    // 進入 CALLED 時清除 dismissed（讓蓋層出現）；除非剛剛是同一張票才剛 dismiss
    if (callOverlayDismissedFor.value !== ticketId.value) {
      callOverlayDismissedFor.value = '';
    }
  }
});

const ApiLoad = async () => {
  loading.value = true;
  try {
    // 入口優先序：?token=（QR 掃碼）→ ?id=（既有手機末 4 碼 / localStorage 還原路徑）
    if (claimToken.value) {
      const res = await $api.GetQueueClaim({ token: claimToken.value });
      if (res.status.code !== $enum.apiStatus.success) {
        // token 失敗（過期 / RateLimited）：一次性提示 + 降級到手機末 4 碼回查
        ElMessage.warning(t('queue.claim.tokenExpired'));
        navigateTo(localePath(`/m/${slug.value}/queue/find`));
        return;
      }
      ticketId.value = res.data.ticket.id;
      queueStore.SetMyTicket(ticketId.value, res.data);
      queueStore.Connect(res.data.merchant.id);
      return;
    }

    if (!ticketId.value) {
      initError.value = t('queue.messages.ticketNotFound');
      return;
    }
    const res = await $api.GetQueueTicket({ id: ticketId.value });
    if (res.status.code !== $enum.apiStatus.success) {
      initError.value = res.status.message?.zh_tw || t('queue.messages.ticketNotFound');
      queueStore.ClearMyTicket();
      // 同步把 localStorage 裡的失效 entry 拿掉（避免下次又被自動還原）
      recent.RemoveByTicketId(ticketId.value);
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

const ClickBackQueue = () => navigateTo(localePath(`/m/${slug.value}/queue`));
const ClickHome = () => navigateTo(localePath(`/m/${slug.value}`));
const ClickRetake = () => {
  // 領完號完成後，移除本張票紀錄再回到領號頁
  recent.RemoveByTicketId(ticketId.value);
  queueStore.ClearMyTicket();
  navigateTo(localePath(`/m/${slug.value}/queue`));
};
const ClickDismissOverlay = () => {
  callOverlayDismissedFor.value = ticketId.value;
};
const ClickRetry = () => {
  queueStore.ForceReconnect();
};

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
  .PageQueueStatus__loading(v-if="loading") {{ $t('common.loading') }}
  .PageQueueStatus__empty(v-else-if="initError")
    .PageQueueStatus__emptyIcon !
    p.PageQueueStatus__emptyText {{ initError }}
    ElButton(type="primary" @click="ClickBackQueue") {{ $t('common.back') }}
  template(v-else-if="MyTicket")
    //- 連線狀態 banner（四態）
    BizQueueConnectionBar(
      :state="queueStore.connectionState"
      :reconnect-in="queueStore.reconnectIn"
      @retry="ClickRetry"
    )

    //- 服務名稱
    .PageQueueStatus__serviceBar
      .PageQueueStatus__serviceEyebrow {{ $t('admin.bookingMode.QUEUE') }}
      .PageQueueStatus__serviceName {{ ServiceName }}

    //- DONE 收尾畫面
    .PageQueueStatus__close.PageQueueStatus__close--done(v-if="IsDone" data-testid="queue-status-done")
      .PageQueueStatus__closeIcon ✓
      h2.PageQueueStatus__closeTitle {{ $t('queue.page.doneTitle') }}
      p.PageQueueStatus__closeSub {{ $t('queue.page.doneSubtitle') }}
      .PageQueueStatus__closeActions
        ElButton(size="large" @click="ClickHome") {{ $t('queue.page.doneCtaHome') }}
        ElButton(size="large" type="primary" @click="ClickRetake") {{ $t('queue.page.doneCtaRetake') }}

    //- SKIPPED 收尾畫面
    .PageQueueStatus__close.PageQueueStatus__close--skipped(v-else-if="IsSkipped" data-testid="queue-status-skipped")
      .PageQueueStatus__closeIcon !
      h2.PageQueueStatus__closeTitle {{ $t('queue.page.skippedTitle') }}
      p.PageQueueStatus__closeSub {{ $t('queue.page.skippedSubtitle') }}
      .PageQueueStatus__closeActions
        ElButton(size="large" @click="ClickHome") {{ $t('queue.page.skippedCtaContact') }}
        ElButton(size="large" type="primary" @click="ClickRetake") {{ $t('queue.page.doneCtaRetake') }}

    //- 一般等待狀態：大號碼 + 進度條
    template(v-else)
      BizQueueDisplay.PageQueueStatus__display(
        :primary-label="$t('queue.page.statusYourNumber')"
        :primary-number="MyNumber"
        :secondary-label="$t('queue.page.statusServing')"
        :secondary-number="CurrentServing"
        :highlight="IsCalled"
        :hint="StatusHint"
        data-testid="queue-display"
      )

      BizQueueProgress(
        :current-serving="CurrentServing"
        :my-number="MyNumber"
        :total-taken="TotalTaken"
        :my-status="MyStatus"
      )

      //- ETA 預估等待時間
      .PageQueueStatus__eta(v-if="EtaText" data-testid="queue-eta")
        .PageQueueStatus__etaText {{ EtaText }}

      BizAdSlot(name="queue-status-below")

      .PageQueueStatus__actions
        ElButton(size="large" @click="ClickRefresh") {{ $t('common.search') }}

    //- 全螢幕叫號蓋層（CALLED 且未 dismiss）
    BizQueueCallOverlay(
      v-if="ShowCallOverlay"
      :ticket-number="MyNumber"
      :service-name="ServiceName"
      @dismiss="ClickDismissOverlay"
    )
</template>

<style lang="scss" scoped>
.PageQueueStatus {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

// 服務名稱列 ----
.PageQueueStatus__serviceBar {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background-color: $white;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageQueueStatus__serviceEyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(69, 69, 69, 0.5);
}

.PageQueueStatus__serviceName {
  font-size: 15px;
  font-weight: 700;
  color: $primary;
}

// 收尾畫面 ----
.PageQueueStatus__close {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 36px 22px 28px;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 12px -8px rgba(31, 42, 68, 0.08);
  text-align: center;
}

.PageQueueStatus__close--done .PageQueueStatus__closeIcon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: rgba(0, 173, 169, 0.14);
  color: $secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
}

.PageQueueStatus__close--skipped .PageQueueStatus__closeIcon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: rgba(235, 139, 45, 0.14);
  color: $tertiary;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 800;
}

.PageQueueStatus__closeTitle {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: $primary;
}

.PageQueueStatus__closeSub {
  margin: 0;
  font-size: 13.5px;
  color: rgba(69, 69, 69, 0.7);
  line-height: 1.6;
}

.PageQueueStatus__closeActions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 6px;
}

.PageQueueStatus__closeActions > * {
  min-width: 140px;
}

// ETA 預估等待時間 ----
.PageQueueStatus__eta {
  display: flex;
  justify-content: center;
  padding: 14px 16px;
  background-color: rgba(53, 77, 123, 0.06);
  border-radius: 12px;
  border: 1px solid rgba(53, 77, 123, 0.12);
}

.PageQueueStatus__etaText {
  font-size: 14.5px;
  font-weight: 600;
  color: $primary;
  text-align: center;
  line-height: 1.5;
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
