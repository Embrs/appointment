<script setup lang="ts">
// PageAdminQueue — 商家叫號控制台
definePageMeta({ layout: 'back-desk', middleware: 'merchant' });

const storeSelf = StoreSelf();
const queueStore = StoreQueueRealtime();
const useAsk = UseAsk();

const loading = ref(true);
const actionLoading = ref(false);
const today = ref<GetQueueTodayRes | null>(null);

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
});

onBeforeUnmount(() => {
  queueStore.Disconnect();
});
</script>

<template lang="pug">
.PageAdminQueue
  .PageAdminQueue__head
    h1.PageAdminQueue__title 號碼牌叫號台
    .PageAdminQueue__meta
      span(v-if="today") {{ today.ticketDate }}
      span.PageAdminQueue__conn(:class="{ 'PageAdminQueue__conn--off': !queueStore.isWsConnected }")
        | {{ queueStore.isWsConnected ? '● 即時連線中' : '○ 連線中斷' }}

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
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageAdminQueue__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.PageAdminQueue__title {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  margin: 0;
}

.PageAdminQueue__meta {
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 12px;
}

.PageAdminQueue__conn {
  color: #67c23a;
}

.PageAdminQueue__conn--off {
  color: #e6a23c;
}

.PageAdminQueue__loading,
.PageAdminQueue__empty {
  padding: 32px;
  text-align: center;
  color: #909399;
}

.PageAdminQueue__empty-hint {
  font-size: 13px;
  color: #c0c4cc;
  margin-top: 4px;
}

.PageAdminQueue__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}
</style>
