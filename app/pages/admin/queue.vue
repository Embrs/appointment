<script setup lang="ts">
// PageAdminQueue — 商家叫號控制台
definePageMeta({ layout: 'back-desk', middleware: 'merchant' });

const storeSelf = StoreSelf();
const queueStore = StoreQueueRealtime();
const useAsk = UseAsk();

const loading = ref(true);
const actionLoading = ref(false);
const today = ref<GetQueueTodayRes | null>(null);
const hasAnyWindow = ref(true);

const ApiCheckWindows = async () => {
  if (!today.value || today.value.services.length === 0) {
    hasAnyWindow.value = true;
    return;
  }
  const results = await Promise.all(
    today.value.services.map((s) => $api.GetQueueWindows({ serviceId: s.serviceId }))
  );
  hasAnyWindow.value = results.some(
    (r) => r.status.code === $enum.apiStatus.success && r.data.windows.length > 0
  );
};

const ServingTicketIdMap = computed(() => {
  // 由 serviceMap 抓 servingTicketId（WS 推播即時值）；退而求其次用 today.services 的 CALLED 票
  const m: Record<string, string> = {};
  for (const s of today.value?.services ?? []) {
    const wsState = queueStore.serviceMap[s.serviceId];
    if (wsState?.servingTicketId) {
      m[s.serviceId] = wsState.servingTicketId;
      continue;
    }
    const called = s.tickets.find((t) => t.status === 'CALLED');
    if (called) m[s.serviceId] = called.id;
  }
  return m;
});

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetQueueToday();
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '載入失敗');
      today.value = null;
      return;
    }
    today.value = res.data;
    // 初始化 serviceMap（避免 WS 連上前畫面空白）
    for (const s of res.data.services) {
      if (!queueStore.serviceMap[s.serviceId]) {
        const called = s.tickets.find((t) => t.status === 'CALLED');
        queueStore.serviceMap[s.serviceId] = {
          serviceId: s.serviceId,
          currentServing: s.lastCalledNumber,
          servingTicketId: called?.id ?? '',
          lastEventAt: Date.now()
        };
      }
    }
  } finally {
    loading.value = false;
  }
};

const ApiCallNext = async (serviceId: string) => {
  actionLoading.value = true;
  try {
    const res = await $api.CallNextQueueTicket({ serviceId });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '叫號失敗');
      return;
    }
    ElMessage.success(`已叫號：${res.data.ticketNumber}`);
    await ApiLoad();
  } finally {
    actionLoading.value = false;
  }
};

const ApiDone = async (ticketId: string) => {
  actionLoading.value = true;
  try {
    const res = await $api.MarkQueueTicketDone({ id: ticketId });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '操作失敗');
      return;
    }
    ElMessage.success('已標完成');
    await ApiLoad();
  } finally {
    actionLoading.value = false;
  }
};

const ApiSkip = async (ticketId: string) => {
  const ok = await useAsk.Any('確定將此號碼標記為過號嗎？', '確認過號', '取消', '過號', 'warning');
  if (!ok) return;
  actionLoading.value = true;
  try {
    const res = await $api.MarkQueueTicketSkip({ id: ticketId });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '操作失敗');
      return;
    }
    ElMessage.success('已標過號');
    await ApiLoad();
  } finally {
    actionLoading.value = false;
  }
};

// WS 收到事件後自動重抓（讓列表狀態同步）
watch(() => queueStore.lastEventAt, (v) => {
  if (v && !loading.value) ApiLoad();
});

onMounted(async () => {
  await ApiLoad();
  if (storeSelf.merchantId) {
    queueStore.Connect(storeSelf.merchantId);
  }
  await ApiCheckWindows();
});

onBeforeUnmount(() => {
  queueStore.Disconnect();
});
</script>

<template lang="pug">
.PageAdminQueue
  BizPageHeader(title="號碼牌叫號台" :subtitle="today ? `今日 ${today.ticketDate}` : '即時叫號控制台'")
    template(#actions)
      span.PageAdminQueue__conn(:class="{ 'PageAdminQueue__conn--off': !queueStore.isWsConnected }")
        span.PageAdminQueue__connDot
        span {{ queueStore.isWsConnected ? '即時連線中' : '連線中斷' }}

  ElAlert(
    v-if="!loading && today && today.services.length > 0 && !hasAnyWindow"
    type="warning"
    :closable="false"
    show-icon
    data-testid="queue-no-window-alert"
  )
    template(#title)
      span {{ $t('admin.queueWindow.adminNoWindow') }}
      NuxtLinkLocale.PageAdminQueue__alertLink(to="/admin/queue-window") {{ $t('admin.queueWindow.adminNoWindowAction') }}

  .PageAdminQueue__loading(v-if="loading") 載入中…
  .PageAdminQueue__empty(v-else-if="!today || today.services.length === 0")
    p 尚未建立號碼牌服務
    p.PageAdminQueue__empty-hint 請至「服務」頁新增 bookingMode=QUEUE 的服務並設定每週領號時段。

  .PageAdminQueue__grid(v-else)
    BizQueueControlPanel(
      v-for="s in today.services"
      :key="s.serviceId"
      :service="s"
      :serving-ticket-id="ServingTicketIdMap[s.serviceId] ?? ''"
      :loading="actionLoading"
      @click-call-next="ApiCallNext"
      @click-done="ApiDone"
      @click-skip="ApiSkip"
    )
</template>

<style lang="scss" scoped>
.PageAdminQueue {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageAdminQueue__conn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: $secondary;
  background-color: rgba(0, 173, 169, 0.1);
  padding: 6px 12px;
  border-radius: 999px;
}

.PageAdminQueue__connDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: $secondary;
  animation: pageAdminQueuePulse 1.6s ease-in-out infinite;
}

.PageAdminQueue__conn--off {
  color: $tertiary;
  background-color: rgba(235, 139, 45, 0.1);
}

.PageAdminQueue__conn--off .PageAdminQueue__connDot {
  background-color: $tertiary;
  animation: none;
}

@keyframes pageAdminQueuePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.PageAdminQueue__loading,
.PageAdminQueue__empty {
  padding: 40px 24px;
  text-align: center;
  color: rgba(69, 69, 69, 0.6);
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageAdminQueue__empty-hint {
  font-size: 13px;
  color: rgba(69, 69, 69, 0.5);
  margin-top: 4px;
}

.PageAdminQueue__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.PageAdminQueue__alertLink {
  margin-left: 8px;
  font-weight: 600;
  color: $primary;
  text-decoration: underline;
}
</style>
