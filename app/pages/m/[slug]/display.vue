<script setup lang="ts">
// PageQueueDisplay — 店面大螢幕叫號顯示頁
// /m/{slug}/display — 全螢幕投影用，無認證、純前端展示
// 資料來源：
//   - 初始 snapshot：$api.GetPublicMerchant({ slug })（取每個 QUEUE 服務的 currentServing / ticketsTaken / waitingCount / avgServiceMinutes）
//   - 即時更新：StoreQueueRealtime（WS + 15s 輪詢兜底）
// TTS：UseTts composable，預設關閉、localStorage 持久化、依 i18n locale 切換語系
import { estimateWaitMinutes } from '~shared/queue-eta';

definePageMeta({ layout: 'front-desk', displayMode: true });

const route = useRoute();
const { t, locale } = useI18n();
const slug = computed(() => String(route.params.slug ?? ''));

const queueStore = StoreQueueRealtime();
const tts = UseTts();

const loading = ref(true);
const merchantId = ref('');
const merchantName = ref('');
const merchantPublic = ref<PublicMerchantItem | null>(null);
const initialServices = ref<PublicServiceItem[]>([]);
const merchantForLabel = computed(() => merchantPublic.value);
const { FormatProviderDisplay } = UseProviderLabel(merchantForLabel);
const initError = ref('');
/** key=`${serviceId}|${resourceId ?? '__null__'}`、value=該 (service,resource) 最近一次唸過的號碼 */
const lastSpokenNumberByResource = ref<Record<string, number>>({});
/** key=resourceKey、value=動畫 tick；每次號碼變動 ++ 觸發 CSS 動畫 */
const animateKeyByResource = ref<Record<string, number>>({});

// === 服務挑選 ===
const QueueServices = computed(() =>
  initialServices.value.filter((s) => s.bookingMode === 'QUEUE')
);

const activeServiceIdManual = ref<string>('');

const ActiveServiceId = computed(() => {
  if (activeServiceIdManual.value) return activeServiceIdManual.value;
  const fromQuery = String(route.query.serviceId ?? '');
  if (fromQuery && QueueServices.value.some((s) => s.id === fromQuery)) return fromQuery;
  // 自動挑：先找「至少一個 resource 有 WAITING」的 service；若無，退到 ticketsTaken 最大
  type Score = { id: string; minCurrent: number; ticketsTaken: number; hasWaiting: boolean };
  const scores: Score[] = QueueServices.value.map((s) => {
    const rs = s.resources ?? [];
    const hasWaiting = rs.length > 0
      ? rs.some((r) => (r.waitingCount ?? 0) > 0)
      : (s.waitingCount ?? 0) > 0;
    const minCurrent = rs.length > 0
      ? Math.min(...rs.map((r) => r.currentServing ?? 0))
      : (s.currentServing ?? 0);
    return { id: s.id, minCurrent, ticketsTaken: s.ticketsTaken ?? 0, hasWaiting };
  });
  const withWaiting = scores.filter((s) => s.hasWaiting);
  const pool = withWaiting.length > 0 ? withWaiting : scores;
  if (pool.length === 0) return '';
  return [...pool].sort((a, b) => a.minCurrent - b.minCurrent)[0]?.id ?? '';
});

const ActiveService = computed(() =>
  QueueServices.value.find((s) => s.id === ActiveServiceId.value) ?? null
);

/** 後端 sanitizeNulls 會把 null 轉為空字串；fallback bucket 的 id 在 client 為 "" 而非 null */
const IsFallbackResource = (r: { id: string | null | undefined } | undefined): boolean => {
  if (!r) return true;
  return r.id === null || r.id === undefined || r.id === '';
};

/** 該 service 用於顯示的 resources（過濾 fallback bucket） */
const EffectiveResources = computed(() => {
  const rs = ActiveService.value?.resources ?? [];
  return rs.filter((r) => !IsFallbackResource(r));
});

/** ≥2 個 active resource 才走多 resource layout */
const IsMultiResource = computed(() => EffectiveResources.value.length >= 2);

// 服務中顧客「姓 + 稱謂」顯示字串（隱私：取代服務項目名稱）
// 單 resource 情境讀頂層 projection；多 resource 改在 ResourceCell 內各自讀
const ServingCustomerDisplay = computed(() => {
  const live = queueStore.serviceMap[ActiveServiceId.value];
  const lastName = live?.servingCustomerLastName ?? '';
  if (!lastName) return '';
  const titleKey = live?.servingCustomerTitle ?? '';
  const titleLabel = titleKey ? t(`appointment.customerTitle.${titleKey}`, '') : '';
  return `${lastName}${titleLabel}`;
});

/** 多 resource 的每個 cell state（即時：WS > snapshot） */
type ResourceCellState = {
  resourceId: string;
  resourceName: string;
  currentServing: number;
  ticketsTaken: number;
  waitingCount: number;
  avgServiceMinutes: number;
  nextNumber: number;
  nextAfterNumber: number;
  estimateMinutes: number;
  servingCustomerDisplay: string;
  animateKey: number;
  /** Provider 顯示文字（已套自訂稱呼三層 fallback）；無 Provider 或多匹配為 null，呼叫端不渲染 */
  providerDisplay: string | null;
};

const ResourceCells = computed<ResourceCellState[]>(() => {
  const sid = ActiveServiceId.value;
  if (!sid) return [];
  return EffectiveResources.value.map((r) => {
    const live = queueStore.GetResourceState(sid, r.id);
    const currentServing = live?.currentServing ?? r.currentServing ?? 0;
    const ticketsTaken = live?.ticketsTaken ?? r.ticketsTaken ?? 0;
    const waitingCount = live?.waitingCount ?? r.waitingCount ?? Math.max(0, ticketsTaken - currentServing);
    const avgServiceMinutes = live?.avgServiceMinutes ?? r.avgServiceMinutes ?? 0;
    const nextNumber = waitingCount >= 1 ? currentServing + 1 : 0;
    const nextAfterNumber = waitingCount >= 2 ? currentServing + 2 : 0;
    const estimateMinutes = estimateWaitMinutes(waitingCount, avgServiceMinutes);
    const lastName = live?.servingCustomerLastName ?? '';
    const titleKey = live?.servingCustomerTitle ?? '';
    const titleLabel = titleKey ? t(`appointment.customerTitle.${titleKey}`, '') : '';
    const servingCustomerDisplay = lastName ? `${lastName}${titleLabel}` : '';
    const animateKey = animateKeyByResource.value[`${sid}|${r.id ?? '__null__'}`] ?? 0;
    const providerName = live?.providerName ?? r.provider?.name ?? null;
    return {
      resourceId: r.id as string,
      resourceName: r.name ?? '',
      currentServing,
      ticketsTaken,
      waitingCount,
      avgServiceMinutes,
      nextNumber,
      nextAfterNumber,
      estimateMinutes,
      servingCustomerDisplay,
      animateKey,
      providerDisplay: FormatProviderDisplay(providerName)
    };
  });
});

// === 即時狀態（WS 推播會更新 serviceMap） ===
const LiveState = computed(() => {
  const sid = ActiveServiceId.value;
  if (!sid) return null;
  return queueStore.serviceMap[sid] ?? null;
});

const CurrentServing = computed<number>(() => {
  const live = LiveState.value?.currentServing;
  if (typeof live === 'number' && live > 0) return live;
  return ActiveService.value?.currentServing ?? 0;
});

const AvgServiceMinutes = computed<number>(() => {
  const live = LiveState.value?.avgServiceMinutes;
  if (typeof live === 'number' && live > 0) return live;
  return ActiveService.value?.avgServiceMinutes ?? 0;
});

const TicketsTaken = computed<number>(() => ActiveService.value?.ticketsTaken ?? 0);

// 等待人數：max(0, ticketsTaken - currentServing)
const WaitingCount = computed<number>(() =>
  Math.max(0, TicketsTaken.value - CurrentServing.value)
);

const NextNumber = computed<number>(() =>
  WaitingCount.value >= 1 ? CurrentServing.value + 1 : 0
);

const NextAfterNumber = computed<number>(() =>
  WaitingCount.value >= 2 ? CurrentServing.value + 2 : 0
);

const EstimateMinutes = computed<number>(() =>
  estimateWaitMinutes(WaitingCount.value, AvgServiceMinutes.value)
);

const AllDone = computed(() =>
  TicketsTaken.value > 0 && WaitingCount.value === 0 && CurrentServing.value >= TicketsTaken.value
);

// === 載入 ===
const ApiLoad = async () => {
  loading.value = true;
  initError.value = '';
  try {
    const res = await $api.GetPublicMerchant({ slug: slug.value });
    if (res.status.code !== $enum.apiStatus.success) {
      initError.value = res.status.message?.zh_tw || '商家不存在';
      return;
    }
    merchantId.value = res.data.merchant.id;
    merchantName.value = res.data.merchant.name;
    merchantPublic.value = res.data.merchant;
    initialServices.value = res.data.services;
    // 把初始 snapshot 灌入 serviceMap 的 resourceMap，讓 WS 還沒連上時畫面也有資料
    // 後端 sanitizeNulls 會把 fallback bucket 的 id/name 轉為 ""；正規化回 null 後再灌入 store
    for (const s of res.data.services) {
      if (s.bookingMode !== 'QUEUE') continue;
      const rs = s.resources ?? [];
      if (rs.length > 0) {
        queueStore.UpsertResourcesSnapshot({
          serviceId: s.id,
          avgServiceMinutes: s.avgServiceMinutes ?? 0,
          resources: rs.map((r) => ({
            id: r.id === '' ? null : (r.id ?? null),
            name: r.name === '' ? null : (r.name ?? null),
            currentServing: r.currentServing ?? 0,
            ticketsTaken: r.ticketsTaken ?? 0,
            waitingCount: r.waitingCount ?? 0,
            avgServiceMinutes: r.avgServiceMinutes ?? s.avgServiceMinutes ?? 0,
            provider: r.provider ?? null
          }))
        });
      }
    }
    if (merchantId.value) {
      queueStore.Connect(merchantId.value);
    }
    // 鎖定初始 active service：把目前各 resource 的 currentServing 記為 lastSpokenNumber（避免一打開就唸切換到的當前號碼）
    const sid = ActiveServiceId.value;
    if (sid) {
      if (IsMultiResource.value) {
        for (const cell of ResourceCells.value) {
          lastSpokenNumberByResource.value[`${sid}|${cell.resourceId}`] = cell.currentServing || 0;
        }
      } else {
        lastSpokenNumberByResource.value[`${sid}|__null__`] = CurrentServing.value || 0;
      }
    }
  } finally {
    loading.value = false;
  }
};

/** 對單一 (service, resource) 的 currentServing 變動處理：觸發動畫 + 必要時 TTS */
const TriggerCallAnnouncement = (sid: string, resourceId: string | null, resourceName: string | null, next: number, customerName: string) => {
  const key = `${sid}|${resourceId ?? '__null__'}`;
  // 動畫 tick
  animateKeyByResource.value = { ...animateKeyByResource.value, [key]: (animateKeyByResource.value[key] ?? 0) + 1 };
  // 同號碼不重播
  if (lastSpokenNumberByResource.value[key] === next) return;
  lastSpokenNumberByResource.value[key] = next;
  if (!tts.isEnabled.value) return;
  const lang = TtsLangMap[locale.value as 'zh' | 'en' | 'ja'] ?? TtsLangMap.zh;
  let text: string;
  if (resourceName) {
    text = t('display.tts.callPhraseWithRoom', { number: next, room: resourceName });
  } else if (customerName) {
    text = t('display.tts.callPhraseWithCustomer', { number: next, customerName });
  } else {
    text = t('display.tts.callPhraseSimple', { number: next });
  }
  tts.Speak(text, lang);
};

// === 動畫 + TTS：watch 多 resource 的 currentServing 變化（每個 cell 各自比對） ===
watch(ResourceCells, (next, prev) => {
  const sid = ActiveServiceId.value;
  if (!sid || !IsMultiResource.value) return;
  for (const cell of next) {
    if (!cell.currentServing) continue;
    const before = prev?.find((p) => p.resourceId === cell.resourceId);
    if (before && before.currentServing === cell.currentServing) continue;
    TriggerCallAnnouncement(sid, cell.resourceId, cell.resourceName || null, cell.currentServing, cell.servingCustomerDisplay);
  }
}, { deep: true });

// === 動畫 + TTS：watch 單一 resource path 的 currentServing 變化（未綁 resource 沿用原行為） ===
watch(CurrentServing, (next, prev) => {
  if (!next || next === prev) return;
  if (IsMultiResource.value) return; // 多 resource 走上方 watch
  const sid = ActiveServiceId.value;
  if (!sid) return;
  TriggerCallAnnouncement(sid, null, null, next, ServingCustomerDisplay.value);
});

// 切換 active service 時 reset：不立即廣播切換後的當前號碼
watch(ActiveServiceId, () => {
  // 把當前 active 的所有 (resource) 號碼當作「已唸過」，避免切換時立刻播報
  const sid = ActiveServiceId.value;
  if (!sid) return;
  if (IsMultiResource.value) {
    for (const cell of ResourceCells.value) {
      lastSpokenNumberByResource.value[`${sid}|${cell.resourceId}`] = cell.currentServing || 0;
    }
  } else {
    lastSpokenNumberByResource.value[`${sid}|__null__`] = CurrentServing.value || 0;
  }
  animateKeyByResource.value = {};
});

// === Toolbar 浮動顯示控制 ===
const toolbarVisible = ref(true);
let toolbarHideTimer: ReturnType<typeof setTimeout> | null = null;
const ShowToolbar = () => {
  toolbarVisible.value = true;
  if (toolbarHideTimer) clearTimeout(toolbarHideTimer);
  toolbarHideTimer = setTimeout(() => {
    toolbarVisible.value = false;
  }, 2500);
};
const KeepToolbar = () => {
  if (toolbarHideTimer) {
    clearTimeout(toolbarHideTimer);
    toolbarHideTimer = null;
  }
  toolbarVisible.value = true;
};

const ClickToggleTts = () => {
  tts.Toggle();
  KeepToolbar();
};

const ChangeService = (id: string) => {
  activeServiceIdManual.value = id;
  KeepToolbar();
};

useHead({
  title: () => {
    const base = t('display.calling');
    return merchantName.value ? `${base} - ${merchantName.value}` : base;
  }
});

onMounted(() => {
  ApiLoad();
  ShowToolbar();
});

onBeforeUnmount(() => {
  if (toolbarHideTimer) clearTimeout(toolbarHideTimer);
  queueStore.Disconnect();
});

const FormatNumber = (n: number) => (n > 0 ? String(n).padStart(2, '0') : '—');
</script>

<template lang="pug">
.PageDisplay(@mousemove="ShowToolbar")
  .PageDisplay__loading(v-if="loading") {{ $t('common.loading') }}
  .PageDisplay__empty(v-else-if="initError") {{ initError }}
  .PageDisplay__empty(v-else-if="QueueServices.length === 0") {{ $t('display.noService') }}
  template(v-else)
    //- 多 resource：grid 分區顯示
    .PageDisplay__multi(
      v-if="IsMultiResource"
      :class="{ 'PageDisplay__multi--two': ResourceCells.length === 2, 'PageDisplay__multi--auto': ResourceCells.length >= 3 }"
      data-testid="display-multi"
    )
      .PageDisplay__cell(
        v-for="cell in ResourceCells"
        :key="cell.resourceId"
        :data-testid="`display-cell-${cell.resourceId}`"
      )
        .PageDisplay__cellRoom {{ cell.resourceName }}
        .PageDisplay__cellProvider(
          v-if="cell.providerDisplay"
          :data-testid="`display-cell-provider-${cell.resourceId}`"
        ) {{ cell.providerDisplay }}
        .PageDisplay__cellEyebrow {{ $t('display.calling') }}
        .PageDisplay__cellCustomer(
          v-if="cell.servingCustomerDisplay"
          :data-testid="`display-cell-customer-${cell.resourceId}`"
        ) {{ cell.servingCustomerDisplay }}
        .PageDisplay__cellBigWrap
          .PageDisplay__cellBig(
            v-if="cell.currentServing > 0"
            :key="cell.animateKey"
            :class="{ 'PageDisplay__cellBig--animate': cell.animateKey > 0 }"
            :data-testid="`display-cell-current-${cell.resourceId}`"
          ) {{ FormatNumber(cell.currentServing) }}
          .PageDisplay__cellPlaceholder(v-else :data-testid="`display-cell-empty-${cell.resourceId}`") {{ $t('display.noNumber') }}
        .PageDisplay__cellGoto(:data-testid="`display-cell-goto-${cell.resourceId}`") {{ $t('display.gotoRoom', { room: cell.resourceName }) }}
        .PageDisplay__cellStats
          .PageDisplay__cellStat
            .PageDisplay__cellStatLabel {{ $t('display.next') }}
            .PageDisplay__cellStatValue(:data-testid="`display-cell-next-${cell.resourceId}`") {{ FormatNumber(cell.nextNumber) }}
          .PageDisplay__cellStat
            .PageDisplay__cellStatLabel {{ $t('display.waiting') }}
            .PageDisplay__cellStatValue(:data-testid="`display-cell-waiting-${cell.resourceId}`") {{ $t('display.waitingPeople', { count: cell.waitingCount }) }}

    //- 單一 resource / 未綁 resource：沿用原始全螢幕單號碼 layout（迴歸保護）
    .PageDisplay__main(v-else)
      //- 左半：目前叫號
      section.PageDisplay__left
        .PageDisplay__eyebrow {{ $t('display.calling') }}
        .PageDisplay__customerName(
          v-if="ServingCustomerDisplay"
          data-testid="display-customer-name"
        ) {{ ServingCustomerDisplay }}
        .PageDisplay__bigNumberWrap
          .PageDisplay__bigNumber(
            v-if="CurrentServing > 0"
            :key="animateKeyByResource[`${ActiveServiceId}|__null__`] ?? 0"
            :class="{ 'PageDisplay__bigNumber--animate': (animateKeyByResource[`${ActiveServiceId}|__null__`] ?? 0) > 0 }"
            data-testid="display-current"
          ) {{ FormatNumber(CurrentServing) }}
          .PageDisplay__bigPlaceholder(v-else-if="AllDone" data-testid="display-current-alldone") {{ $t('display.allDone') }}
          .PageDisplay__bigPlaceholder(v-else data-testid="display-current-empty") {{ $t('display.noNumber') }}

      //- 右半：下一位 / 再下一位 / 等待 / 預估
      section.PageDisplay__right
        .PageDisplay__card.PageDisplay__card--next
          .PageDisplay__cardLabel {{ $t('display.next') }}
          .PageDisplay__cardValue(data-testid="display-next") {{ FormatNumber(NextNumber) }}
        .PageDisplay__card.PageDisplay__card--nextAfter
          .PageDisplay__cardLabel {{ $t('display.nextAfter') }}
          .PageDisplay__cardValue(data-testid="display-next-after") {{ FormatNumber(NextAfterNumber) }}
        .PageDisplay__card.PageDisplay__card--waiting
          .PageDisplay__cardLabel {{ $t('display.waiting') }}
          .PageDisplay__cardValue(data-testid="display-waiting") {{ $t('display.waitingPeople', { count: WaitingCount }) }}
        .PageDisplay__card.PageDisplay__card--eta
          .PageDisplay__cardLabel {{ $t('display.estimate') }}
          .PageDisplay__cardValue(data-testid="display-estimate")
            template(v-if="WaitingCount === 0 || AvgServiceMinutes <= 0") {{ $t('display.minutesShort') }}
            template(v-else) {{ $t('display.minutes', { n: EstimateMinutes }) }}

    //- Toolbar（右上角浮動，hover/keep 顯示）
    .PageDisplay__toolbar(
      :class="{ 'PageDisplay__toolbar--hidden': !toolbarVisible }"
      @mouseenter="KeepToolbar"
      @mouseleave="ShowToolbar"
    )
      //- 服務切換（多 QUEUE 服務時才顯示）
      ElSelect(
        v-if="QueueServices.length > 1"
        :model-value="ActiveServiceId"
        size="small"
        :placeholder="$t('display.pickService')"
        @update:model-value="ChangeService"
      )
        ElOption(
          v-for="s in QueueServices"
          :key="s.id"
          :label="s.name"
          :value="s.id"
        )
      //- TTS 開關
      button.PageDisplay__ttsBtn(
        type="button"
        :class="{ 'PageDisplay__ttsBtn--on': tts.isEnabled.value }"
        :disabled="!tts.isSupported.value"
        :title="tts.isSupported.value ? '' : $t('display.tts.unsupported')"
        data-testid="display-tts-toggle"
        @click="ClickToggleTts"
      )
        NuxtIcon.PageDisplay__ttsIcon(:name="tts.isEnabled.value ? 'mdi:volume-high' : 'mdi:volume-off'")
        span.PageDisplay__ttsLabel {{ tts.isEnabled.value ? $t('display.tts.on') : $t('display.tts.off') }}
</template>

<style lang="scss" scoped>
.PageDisplay {
  width: 100vw;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0b1224 0%, #1a2746 100%);
  color: #f4f6fb;
  font-family: var(--app-font-display, var(--app-font, inherit));
  overflow: hidden;
  position: relative;
}

.PageDisplay__loading,
.PageDisplay__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(24px, 3vw, 40px);
  color: rgba(244, 246, 251, 0.7);
  text-align: center;
  padding: 24px;
}

// 主要顯示區 ----
.PageDisplay__main {
  flex: 1;
  display: flex;
  width: 100%;
  min-height: 100vh;
}

.PageDisplay__left {
  flex: 0 0 60%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 4vh 3vw;
  border-right: 1px solid rgba(244, 246, 251, 0.08);
  text-align: center;
  gap: clamp(8px, 1.2vh, 18px);
}

.PageDisplay__eyebrow {
  font-size: clamp(20px, 1.8vw, 32px);
  font-weight: 500;
  letter-spacing: 0.18em;
  color: rgba(244, 246, 251, 0.65);
  text-transform: uppercase;
}

.PageDisplay__customerName {
  font-size: clamp(28px, 3vw, 56px);
  font-weight: 600;
  color: #a9c4ff;
  margin-bottom: clamp(4px, 1vh, 16px);
  letter-spacing: 0.04em;
}

.PageDisplay__bigNumberWrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.PageDisplay__bigNumber {
  font-size: clamp(160px, 18vw, 280px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  color: #ffffff;
  text-shadow: 0 0 60px rgba(120, 180, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.PageDisplay__bigNumber--animate {
  animation: pageDisplayCallNext 0.6s ease-out;
}

.PageDisplay__bigPlaceholder {
  font-size: clamp(40px, 5vw, 80px);
  color: rgba(244, 246, 251, 0.4);
  font-weight: 500;
}

@keyframes pageDisplayCallNext {
  0% {
    transform: scale(1);
    color: #ffffff;
    text-shadow: 0 0 60px rgba(120, 180, 255, 0.4);
  }
  50% {
    transform: scale(1.08);
    color: #ffd166;
    text-shadow: 0 0 80px rgba(255, 209, 102, 0.7);
  }
  100% {
    transform: scale(1);
    color: #ffffff;
    text-shadow: 0 0 60px rgba(120, 180, 255, 0.4);
  }
}

// 右半 ----
.PageDisplay__right {
  flex: 0 0 40%;
  display: grid;
  grid-template-rows: 1fr 1fr 1fr 1fr;
  gap: clamp(8px, 1.4vh, 24px);
  padding: 4vh 3vw;
  align-items: stretch;
}

.PageDisplay__card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-color: rgba(244, 246, 251, 0.06);
  border-radius: 16px;
  padding: 2vh 2vw;
  border: 1px solid rgba(244, 246, 251, 0.08);
}

.PageDisplay__card--next {
  background-color: rgba(120, 180, 255, 0.12);
  border-color: rgba(120, 180, 255, 0.28);
}

.PageDisplay__card--eta {
  background-color: rgba(255, 209, 102, 0.08);
  border-color: rgba(255, 209, 102, 0.22);
}

.PageDisplay__cardLabel {
  font-size: clamp(16px, 1.4vw, 26px);
  font-weight: 500;
  color: rgba(244, 246, 251, 0.65);
  letter-spacing: 0.06em;
  margin-bottom: clamp(4px, 0.6vh, 10px);
}

.PageDisplay__cardValue {
  font-size: clamp(56px, 6vw, 96px);
  font-weight: 800;
  color: #f4f6fb;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.PageDisplay__card--eta .PageDisplay__cardValue {
  color: #ffd166;
}

// Toolbar ----
.PageDisplay__toolbar {
  position: absolute;
  top: 18px;
  right: 18px;
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  background-color: rgba(11, 18, 36, 0.7);
  border: 1px solid rgba(244, 246, 251, 0.12);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  transition: opacity 0.4s ease;
  z-index: 20;
  opacity: 1;
  width: max-content;
  max-width: calc(100vw - 36px);
}

.PageDisplay__toolbar > * {
  flex: 0 0 auto;
}

.PageDisplay__toolbar :deep(.el-select) {
  width: 140px;
}

@media (max-width: 540px) {
  .PageDisplay__toolbar {
    flex-wrap: wrap;
    justify-content: flex-end;
    border-radius: 18px;
  }

  .PageDisplay__toolbar :deep(.el-select) {
    width: 120px;
  }
}

.PageDisplay__toolbar--hidden {
  opacity: 0;
  pointer-events: none;
}

.PageDisplay__ttsBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(244, 246, 251, 0.15);
  background-color: rgba(244, 246, 251, 0.06);
  color: rgba(244, 246, 251, 0.78);
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.PageDisplay__ttsLabel {
  white-space: nowrap;
}

.PageDisplay__ttsBtn:hover:not(:disabled) {
  background-color: rgba(244, 246, 251, 0.12);
  border-color: rgba(244, 246, 251, 0.3);
}

.PageDisplay__ttsBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.PageDisplay__ttsBtn--on {
  background-color: rgba(0, 173, 169, 0.22);
  border-color: rgba(0, 173, 169, 0.5);
  color: #6ee7e3;
}

.PageDisplay__ttsIcon {
  font-size: 16px;
  display: inline-flex;
  align-items: center;
}

// 響應式：≤ 1023px 切換為「上下兩欄」
@media (max-width: 1023px) {
  .PageDisplay__main {
    flex-direction: column;
  }

  .PageDisplay__left {
    flex: 0 0 55vh;
    border-right: none;
    border-bottom: 1px solid rgba(244, 246, 251, 0.08);
  }

  .PageDisplay__right {
    flex: 1;
    grid-template-rows: none;
    grid-template-columns: repeat(2, 1fr);
    padding: 3vh 4vw;
  }
}

// === 多 resource grid layout ===
.PageDisplay__multi {
  flex: 1;
  display: grid;
  gap: clamp(8px, 1.4vh, 24px);
  padding: 3vh 3vw;
  min-height: 100vh;
}

.PageDisplay__multi--two {
  grid-template-columns: 1fr 1fr;
}

.PageDisplay__multi--auto {
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
}

.PageDisplay__cell {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  background-color: rgba(244, 246, 251, 0.04);
  border: 1px solid rgba(244, 246, 251, 0.1);
  border-radius: 20px;
  padding: clamp(16px, 2.6vh, 32px) clamp(16px, 2.4vw, 28px);
  gap: clamp(6px, 1vh, 14px);
  text-align: center;
  min-height: 0;
}

.PageDisplay__cellRoom {
  font-size: clamp(28px, 3.6vw, 64px);
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #ffd166;
  text-shadow: 0 0 24px rgba(255, 209, 102, 0.4);
}

.PageDisplay__cellProvider {
  font-size: clamp(18px, 2vw, 32px);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 0.04em;
  margin-top: -4px;
}

.PageDisplay__cellEyebrow {
  font-size: clamp(14px, 1.4vw, 22px);
  font-weight: 500;
  letter-spacing: 0.18em;
  color: rgba(244, 246, 251, 0.55);
  text-transform: uppercase;
}

.PageDisplay__cellCustomer {
  font-size: clamp(20px, 2.2vw, 36px);
  font-weight: 600;
  color: #a9c4ff;
  letter-spacing: 0.04em;
}

.PageDisplay__cellBigWrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.PageDisplay__cellBig {
  font-size: clamp(100px, 12vw, 220px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.02em;
  color: #ffffff;
  text-shadow: 0 0 40px rgba(120, 180, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.PageDisplay__cellBig--animate {
  animation: pageDisplayCallNext 0.6s ease-out;
}

.PageDisplay__cellPlaceholder {
  font-size: clamp(30px, 4vw, 60px);
  color: rgba(244, 246, 251, 0.35);
  font-weight: 500;
}

.PageDisplay__cellGoto {
  font-size: clamp(16px, 1.6vw, 26px);
  font-weight: 600;
  color: rgba(244, 246, 251, 0.85);
  letter-spacing: 0.04em;
}

.PageDisplay__cellStats {
  display: flex;
  gap: clamp(8px, 1.2vw, 18px);
  margin-top: clamp(4px, 0.8vh, 10px);
}

.PageDisplay__cellStat {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: rgba(244, 246, 251, 0.06);
  border: 1px solid rgba(244, 246, 251, 0.1);
  border-radius: 10px;
  padding: 6px 14px;
  min-width: 110px;
}

.PageDisplay__cellStatLabel {
  font-size: clamp(11px, 0.9vw, 14px);
  font-weight: 500;
  color: rgba(244, 246, 251, 0.55);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.PageDisplay__cellStatValue {
  font-size: clamp(20px, 2.2vw, 36px);
  font-weight: 700;
  color: #f4f6fb;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 767px) {
  .PageDisplay__multi--two,
  .PageDisplay__multi--auto {
    grid-template-columns: 1fr;
  }

  .PageDisplay__cell {
    padding: 14px 16px;
  }
}
</style>
