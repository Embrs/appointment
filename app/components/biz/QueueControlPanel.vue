<script setup lang="ts">
// BizQueueControlPanel — 商家叫號控制面板
// service 綁定多個 resource 時依 resource 渲染子卡並列、各子卡持有獨立的 currentServing / WAITING / tabs / 叫下一號 / 現場登記；
// service 未綁 resource（resources=[{id:null,...}]）時退化成單卡 UX（迴歸保護）

interface QueueControlPanelProps {
  service: QueueTodayServiceItem;
  /** @deprecated 多 resource / 多 CALLED 並列後不再依賴單一 servingTicketId；保留向後相容 */
  servingTicketId?: string;
  /** 商家 id：用於 localStorage 持久化 segmented control 選中的 resource */
  merchantId?: string;
  /** 商家 self 資料（含 providerModeEnabled / providerLabel）；用於 Provider 副標 i18n 解析 */
  merchant?: SelfMerchantFull | null;
  /** 卡片頂層動作 loading（叫下一號 / 現場登記） */
  loading?: boolean;
}

const props = withDefaults(defineProps<QueueControlPanelProps>(), {
  servingTicketId: '',
  merchantId: '',
  merchant: null,
  loading: false
});

type Emit = {
  'click-call-next': [serviceId: string, resourceId: string | null];
  'click-done': [ticketId: string];
  'click-skip': [ticketId: string];
  'click-walk-in': [serviceId: string, resourceId: string | null, resourceName: string | null];
};
const emit = defineEmits<Emit>();

const { t } = useI18n();
const queueStore = StoreQueueRealtime();
const merchantRef = computed(() => props.merchant);
const { FormatProviderDisplay } = UseProviderLabel(merchantRef);

type TabId = 'waiting' | 'called' | 'history';
type ResourceKey = string; // resource.id ?? '__null__'

// 防呆：後端理應總是回 resources，缺漏時走 fallback 單元素
const ResourceList = computed<QueueTodayResourceItem[]>(() => {
  const list = props.service.resources;
  if (Array.isArray(list) && list.length > 0) return list;
  return [
    {
      id: null,
      name: null,
      displayOrder: null,
      isActive: null,
      lastTicketNumber: props.service.lastTicketNumber,
      lastCalledNumber: props.service.lastCalledNumber,
      tickets: props.service.tickets
    }
  ];
});

const KeyOf = (r: QueueTodayResourceItem): ResourceKey => r.id ?? '__null__';

const HasResourceBinding = computed(() =>
  ResourceList.value.some((r) => r.id !== null)
);

const ShowOperatingControl = computed(
  () => ResourceList.value.length >= 2 && HasResourceBinding.value
);

const StorageKey = computed(() =>
  props.merchantId
    ? `queueOperatingResource:${props.merchantId}:${props.service.serviceId}`
    : ''
);

const operatingResourceId = ref<string | null>(null);
const resourceCardRefs = ref<Record<string, HTMLElement | null>>({});
const justFocusedKey = ref<string | null>(null);

const ReadStoredResourceId = (): string | null => {
  if (typeof window === 'undefined' || !StorageKey.value) return null;
  try {
    return window.localStorage.getItem(StorageKey.value);
  } catch {
    return null;
  }
};

const WriteStoredResourceId = (id: string | null) => {
  if (typeof window === 'undefined' || !StorageKey.value) return;
  try {
    if (id === null) window.localStorage.removeItem(StorageKey.value);
    else window.localStorage.setItem(StorageKey.value, id);
  } catch {
    // localStorage 不可用時靜默失敗
  }
};

const ResolveInitialResourceId = (): string | null => {
  const list = ResourceList.value;
  const activeBound = list.filter((r) => r.id !== null);
  if (activeBound.length === 0) return null;
  const stored = ReadStoredResourceId();
  if (stored && activeBound.some((r) => r.id === stored)) return stored;
  return activeBound[0]!.id;
};

onMounted(() => {
  const initial = ResolveInitialResourceId();
  operatingResourceId.value = initial;
  if (initial) WriteStoredResourceId(initial);
});

// 監聽 resources 變化：若選中的 resource 已不存在/停用 → fallback 到第一個 active；同步寫回 localStorage
watch(
  () => ResourceList.value.map((r) => r.id ?? '__null__').join(','),
  () => {
    const validIds = new Set(
      ResourceList.value.filter((r) => r.id !== null).map((r) => r.id as string)
    );
    if (operatingResourceId.value && !validIds.has(operatingResourceId.value)) {
      const fallback = ResolveInitialResourceId();
      operatingResourceId.value = fallback;
      WriteStoredResourceId(fallback);
    }
  }
);

const ClickOperatingResource = (id: string) => {
  operatingResourceId.value = id;
  WriteStoredResourceId(id);
  justFocusedKey.value = id;
  nextTick(() => {
    const el = resourceCardRefs.value[id];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setTimeout(() => {
      if (justFocusedKey.value === id) justFocusedKey.value = null;
    }, 1000);
  });
};

// 各子卡的 tab 與 search state，按 ResourceKey 分群
const tabState = reactive<Record<ResourceKey, TabId>>({});
const searchState = reactive<Record<ResourceKey, string>>({});

const GetTab = (key: ResourceKey): TabId => tabState[key] ?? 'waiting';
const SetTab = (key: ResourceKey, tab: TabId) => {
  tabState[key] = tab;
};
const GetSearch = (key: ResourceKey): string => searchState[key] ?? '';
const SetSearch = (key: ResourceKey, val: string) => {
  searchState[key] = val;
};

// 全 component 共用的 row 級 inflight（ticket id 全域唯一）
const inflightDoneIds = ref(new Set<string>());
const inflightSkipIds = ref(new Set<string>());

watch(
  () => props.service.tickets.map((tk) => `${tk.id}:${tk.status}`).join('|'),
  () => {
    const calledIds = new Set(
      props.service.tickets.filter((tk) => tk.status === 'CALLED').map((tk) => tk.id)
    );
    for (const id of [...inflightDoneIds.value]) {
      if (!calledIds.has(id)) inflightDoneIds.value.delete(id);
    }
    for (const id of [...inflightSkipIds.value]) {
      if (!calledIds.has(id)) inflightSkipIds.value.delete(id);
    }
  }
);

const ServingTicketsOf = (r: QueueTodayResourceItem) =>
  r.tickets.filter((tk) => tk.status === 'CALLED').sort((a, b) => a.ticketNumber - b.ticketNumber);

const TabCountsOf = (r: QueueTodayResourceItem) => ({
  waiting: r.tickets.filter((tk) => tk.status === 'WAITING').length,
  called: r.tickets.filter((tk) => tk.status === 'CALLED').length,
  history: r.tickets.filter((tk) => tk.status === 'DONE' || tk.status === 'SKIPPED').length
});

const Tabs = computed<Array<{ id: TabId; label: string }>>(() => [
  { id: 'waiting', label: t('admin.queue.tabs.waiting') },
  { id: 'called', label: t('admin.queue.tabs.called') },
  { id: 'history', label: t('admin.queue.tabs.history') }
]);

// 純數字長度 ≤ 4：同時匹配 ticketNumber（raw + padStart 兩種形式）與 phone 末 4 碼
// 純數字長度 > 4：只匹配 phone 末 4 碼
// 非純數字：匹配 customerLastName 包含
const MatchTicket = (ticket: QueueTodayTicketItem, query: string): boolean => {
  const q = query.trim();
  if (!q) return true;
  const isDigits = /^\d+$/.test(q);
  if (isDigits) {
    const phoneTail = ticket.customerPhone ? ticket.customerPhone.slice(-4) : '';
    if (q.length <= 4) {
      const raw = String(ticket.ticketNumber);
      const padded = raw.padStart(2, '0');
      const numberMatch = raw.includes(q) || padded.includes(q);
      const phoneMatch = phoneTail.includes(q);
      return numberMatch || phoneMatch;
    }
    return phoneTail.includes(q);
  }
  return (ticket.customerLastName ?? '').includes(q);
};

const FilteredTicketsOf = (r: QueueTodayResourceItem, key: ResourceKey) => {
  const tab = GetTab(key);
  const search = GetSearch(key);
  const byTab = r.tickets.filter((tk) => {
    if (tab === 'waiting') return tk.status === 'WAITING';
    if (tab === 'called') return tk.status === 'CALLED';
    return tk.status === 'DONE' || tk.status === 'SKIPPED';
  });
  return byTab
    .filter((tk) => MatchTicket(tk, search))
    .sort((a, b) => a.ticketNumber - b.ticketNumber);
};

const HasSearchOf = (key: ResourceKey) => GetSearch(key).trim().length > 0;

const GetTicketEtaText = (ticket: QueueTodayTicketItem): string => {
  if (ticket.status !== 'WAITING') return '';
  const live = queueStore.GetEtaForTicket(
    { ticketNumber: ticket.ticketNumber, status: ticket.status as 'WAITING' | 'CALLED' | 'DONE' | 'SKIPPED' },
    props.service.serviceId
  );
  const eta = live ?? ticket.estimatedWaitMinutes;
  if (eta === null || eta === undefined) return '';
  return t('queue.eta.aboutMinutesLater', { n: eta });
};

const ClickCallNext = (r: QueueTodayResourceItem) =>
  emit('click-call-next', props.service.serviceId, r.id);
const ClickWalkIn = (r: QueueTodayResourceItem) =>
  emit('click-walk-in', props.service.serviceId, r.id, r.name);

const ClickRowDone = (ticketId: string) => {
  if (inflightDoneIds.value.has(ticketId)) return;
  inflightDoneIds.value.add(ticketId);
  emit('click-done', ticketId);
};

const ClickRowSkip = (ticketId: string) => {
  if (inflightSkipIds.value.has(ticketId)) return;
  inflightSkipIds.value.add(ticketId);
  emit('click-skip', ticketId);
};

const ClearSearch = (key: ResourceKey) => SetSearch(key, '');

const StatusLabel = (status: string) => {
  switch (status) {
    case 'WAITING': return t('queue.status.WAITING');
    case 'CALLED': return t('queue.status.CALLED');
    case 'DONE': return t('queue.status.DONE');
    case 'SKIPPED': return t('queue.status.SKIPPED');
    default: return status;
  }
};

const TitleLabel = (title: string) => {
  switch (title) {
    case 'MR': return '先生';
    case 'MRS': return '女士';
    case 'MISS': return '小姐';
    case 'MX': return '貴賓';
    default: return '';
  }
};

const MaskPhone = (phone: string | null) => {
  if (phone === null) return '（未留電話）';
  if (!phone) return '';
  if (phone.length <= 4) return phone;
  return `••••${phone.slice(-4)}`;
};

const RegisterResourceRef = (key: string, el: Element | ComponentPublicInstance | null) => {
  resourceCardRefs.value[key] = el as HTMLElement | null;
};
</script>

<template lang="pug">
.BizQueueControlPanel(:class="{ 'BizQueueControlPanel--multi-resource': ShowOperatingControl }")
  .BizQueueControlPanel__head
    .BizQueueControlPanel__name {{ service.serviceName }}
    ElTag.BizQueueControlPanel__status(
      v-if="!service.isActive"
      type="info"
      effect="plain"
      size="small"
    ) 停用中

  .BizQueueControlPanel__operating(v-if="ShowOperatingControl")
    span.BizQueueControlPanel__operating-label {{ $t('admin.queue.operatingRoom.label') }}
    .BizQueueControlPanel__operating-segments(role="tablist")
      button.BizQueueControlPanel__operating-segment(
        v-for="r of ResourceList"
        v-show="r.id !== null"
        :key="`seg-${KeyOf(r)}`"
        type="button"
        role="tab"
        :aria-selected="operatingResourceId === r.id"
        :class="{ 'BizQueueControlPanel__operating-segment--active': operatingResourceId === r.id }"
        :data-testid="`queue-operating-seg-${r.id}`"
        @click="ClickOperatingResource(r.id ?? '')"
      ) {{ r.name }}

  .BizQueueControlPanel__resources(
    :class="{ 'BizQueueControlPanel__resources--single-null': ResourceList.length === 1 && ResourceList[0].id === null }"
  )
    .BizQueueControlPanel__resource(
      v-for="r of ResourceList"
      :key="`res-${KeyOf(r)}`"
      :ref="(el) => RegisterResourceRef(KeyOf(r), el)"
      :class="{ 'BizQueueControlPanel__resource--active': ShowOperatingControl && operatingResourceId === r.id, 'BizQueueControlPanel__resource--just-focused': ShowOperatingControl && justFocusedKey === r.id }"
      :data-testid="`queue-resource-card-${r.id ?? 'null'}`"
    )
      .BizQueueControlPanel__resource-head(v-if="r.id !== null")
        span.BizQueueControlPanel__resource-name {{ r.name }}
        ElTag.BizQueueControlPanel__resource-inactive(
          v-if="r.isActive === false"
          type="info"
          effect="plain"
          size="small"
        ) 停用中

      BizQueueDisplay.BizQueueControlPanel__display(
        primary-label="服務中"
        :primary-number="r.lastCalledNumber"
        secondary-label="最後發出號碼"
        :secondary-number="r.lastTicketNumber"
        :highlight="ServingTicketsOf(r).length > 0"
        :hint="ServingTicketsOf(r).length > 0 ? `服務中：共 ${ServingTicketsOf(r).length} 位顧客` : ''"
      )

      .BizQueueControlPanel__actions
        ElButton.BizQueueControlPanel__call-next(
          type="primary"
          size="large"
          :loading="loading"
          :disabled="TabCountsOf(r).waiting === 0"
          :data-testid="`queue-call-next-btn-${r.id ?? 'null'}`"
          @click="ClickCallNext(r)"
        ) 叫下一號
        ElButton.BizQueueControlPanel__walk-in(
          size="large"
          :disabled="loading || !service.isActive"
          :data-testid="`queue-walk-in-entry-${r.id ?? 'null'}`"
          @click="ClickWalkIn(r)"
        ) {{ $t('queue.walkIn.title') }}

      .BizQueueControlPanel__serving
        .BizQueueControlPanel__serving-title 服務中
          span.BizQueueControlPanel__serving-count(v-if="ServingTicketsOf(r).length > 0") {{ $t('admin.queue.tabs.countSuffix', { n: ServingTicketsOf(r).length }) }}
        .BizQueueControlPanel__serving-empty(
          v-if="ServingTicketsOf(r).length === 0"
          data-testid="queue-serving-empty"
        ) {{ $t('admin.queue.serving.empty') }}
        .BizQueueControlPanel__serving-row(
          v-for="ticket of ServingTicketsOf(r)"
          :key="ticket.id"
          data-testid="queue-serving-row"
        )
          .BizQueueControlPanel__serving-row-number {{ String(ticket.ticketNumber).padStart(2, '0') }}
          .BizQueueControlPanel__serving-row-customer
            span.BizQueueControlPanel__serving-row-name {{ ticket.customerLastName }} {{ TitleLabel(ticket.customerTitle) }}
            span.BizQueueControlPanel__serving-row-phone {{ MaskPhone(ticket.customerPhone) }}
            span.BizQueueControlPanel__providerLabel(
              v-if="FormatProviderDisplay(ticket.providerName)"
              data-testid="queue-row-provider"
            ) {{ FormatProviderDisplay(ticket.providerName) }}
          .BizQueueControlPanel__serving-row-actions
            ElButton(
              size="small"
              type="success"
              :loading="inflightDoneIds.has(ticket.id)"
              :disabled="inflightSkipIds.has(ticket.id)"
              data-testid="queue-row-done-btn"
              @click="ClickRowDone(ticket.id)"
            ) {{ $t('queue.page.markDone') }}
            ElButton(
              size="small"
              type="warning"
              :loading="inflightSkipIds.has(ticket.id)"
              :disabled="inflightDoneIds.has(ticket.id)"
              data-testid="queue-row-skip-btn"
              @click="ClickRowSkip(ticket.id)"
            ) {{ $t('queue.page.markSkip') }}

      .BizQueueControlPanel__list
        .BizQueueControlPanel__list-toolbar
          .BizQueueControlPanel__tabs(role="tablist")
            button.BizQueueControlPanel__tab(
              v-for="tab of Tabs"
              :key="tab.id"
              type="button"
              role="tab"
              :aria-selected="GetTab(KeyOf(r)) === tab.id"
              :class="{ 'BizQueueControlPanel__tab--active': GetTab(KeyOf(r)) === tab.id }"
              :data-testid="`queue-tab-${tab.id}`"
              @click="SetTab(KeyOf(r), tab.id)"
            )
              span {{ tab.label }}
              span.BizQueueControlPanel__tab-count {{ $t('admin.queue.tabs.countSuffix', { n: TabCountsOf(r)[tab.id] }) }}
          ElInput.BizQueueControlPanel__search(
            :model-value="GetSearch(KeyOf(r))"
            size="default"
            clearable
            :placeholder="$t('admin.queue.search.placeholder')"
            data-testid="queue-search-input"
            @update:model-value="(val) => SetSearch(KeyOf(r), val)"
          )

        .BizQueueControlPanel__list-empty(
          v-if="FilteredTicketsOf(r, KeyOf(r)).length === 0"
          data-testid="queue-list-empty"
        )
          template(v-if="HasSearchOf(KeyOf(r))")
            span {{ $t('admin.queue.search.empty') }}
            ElButton(
              link
              type="primary"
              size="small"
              data-testid="queue-search-clear"
              @click="ClearSearch(KeyOf(r))"
            ) {{ $t('admin.queue.search.clear') }}
          span(v-else) 今日尚無號碼
        .BizQueueControlPanel__list-body(v-else)
          .BizQueueControlPanel__row(
            v-for="ticket of FilteredTicketsOf(r, KeyOf(r))"
            :key="ticket.id"
            :class="`BizQueueControlPanel__row--${ticket.status.toLowerCase()}`"
          )
            .BizQueueControlPanel__row-number {{ String(ticket.ticketNumber).padStart(2, '0') }}
            .BizQueueControlPanel__row-customer
              span.BizQueueControlPanel__row-name {{ ticket.customerLastName }} {{ TitleLabel(ticket.customerTitle) }}
              span.BizQueueControlPanel__row-phone {{ MaskPhone(ticket.customerPhone) }}
              span.BizQueueControlPanel__providerLabel(
                v-if="FormatProviderDisplay(ticket.providerName)"
                data-testid="queue-row-provider"
              ) {{ FormatProviderDisplay(ticket.providerName) }}
            ElTag.BizQueueControlPanel__row-eta(
              v-if="ticket.status === 'WAITING' && GetTicketEtaText(ticket)"
              type="info"
              effect="plain"
              size="small"
              data-testid="queue-row-eta"
            ) {{ GetTicketEtaText(ticket) }}
            .BizQueueControlPanel__row-status {{ StatusLabel(ticket.status) }}
</template>

<style lang="scss" scoped>
.BizQueueControlPanel {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.BizQueueControlPanel__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.BizQueueControlPanel__name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}

// ===== Segmented control「目前操作」=====
.BizQueueControlPanel__operating {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
  flex-wrap: wrap;
}

.BizQueueControlPanel__operating-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  flex-shrink: 0;
}

.BizQueueControlPanel__operating-segments {
  display: inline-flex;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
  overflow-x: auto;
  flex-wrap: nowrap;
  max-width: 100%;
}

.BizQueueControlPanel__operating-segment {
  appearance: none;
  border: none;
  background: transparent;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  white-space: nowrap;
  min-height: 32px;
  transition: background 0.15s ease;
}

.BizQueueControlPanel__operating-segment:hover {
  background: rgb(0 0 0 / 4%);
}

.BizQueueControlPanel__operating-segment--active {
  background: #fff;
  color: #303133;
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
}

// ===== Resources 子卡容器（多 resource 並列；單 resource null fallback 退化外觀）=====
.BizQueueControlPanel__resources {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

// 多於一個 resource 時走子卡格線
.BizQueueControlPanel__resources:not(.BizQueueControlPanel__resources--single-null) {
  // 子卡橫排（≥ 1280px 寬容器自動 2~N 欄）
  // 注意：父層 .PageAdminQueue__grid 已決定 service 卡片寬，這裡子卡再切分內部
  grid-template-columns: 1fr;
}

@media (min-width: 1280px) {
  .BizQueueControlPanel__resources:not(.BizQueueControlPanel__resources--single-null) {
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  }
}

@media (min-width: 768px) and (max-width: 1279px) {
  .BizQueueControlPanel__resources:not(.BizQueueControlPanel__resources--single-null) {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }
}

.BizQueueControlPanel__resource {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-radius: 10px;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

// 多 resource 子卡套外框；single null（無 resource binding）保留原版單卡無框視覺
.BizQueueControlPanel__resources:not(.BizQueueControlPanel__resources--single-null) .BizQueueControlPanel__resource {
  background: #fafbfc;
  padding: 12px;
  border: 1px solid #ebeef5;
}

.BizQueueControlPanel__resource--active {
  background: #f0f9ff !important;
  border-color: #b3d8ff !important;
}

.BizQueueControlPanel__resource--just-focused {
  animation: bizQueueResourceFocus 1s ease-in-out;
}

@keyframes bizQueueResourceFocus {
  0% { box-shadow: 0 0 0 0 rgb(64 158 255 / 50%); }
  50% { box-shadow: 0 0 0 6px rgb(64 158 255 / 0%); }
  100% { box-shadow: 0 0 0 0 rgb(64 158 255 / 0%); }
}

.BizQueueControlPanel__resource-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.BizQueueControlPanel__resource-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}

// ===== 頂層動作（叫下一號、現場登記）=====
.BizQueueControlPanel__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.BizQueueControlPanel__call-next {
  flex: 1;
  min-width: 140px;
  min-height: 44px;
}

.BizQueueControlPanel__walk-in {
  min-height: 44px;
}

// ===== 服務中區（多 CALLED 並列）=====
.BizQueueControlPanel__serving {
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.BizQueueControlPanel__serving-title {
  font-size: 14px;
  color: #606266;
  font-weight: 600;
}

.BizQueueControlPanel__serving-count {
  margin-left: 6px;
  font-size: 12px;
  color: #909399;
  font-weight: 400;
}

.BizQueueControlPanel__serving-empty {
  font-size: 13px;
  color: #909399;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  text-align: center;
}

.BizQueueControlPanel__serving-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fef0f0;
  border-radius: 8px;
}

.BizQueueControlPanel__serving-row-number {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  color: #f56c6c;
}

.BizQueueControlPanel__serving-row-customer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.BizQueueControlPanel__serving-row-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.BizQueueControlPanel__serving-row-phone {
  font-size: 12px;
  color: #909399;
}

.BizQueueControlPanel__serving-row-actions {
  display: inline-flex;
  gap: 6px;
  flex-shrink: 0;
}

// ===== 列表 toolbar（tabs 與搜尋）=====
.BizQueueControlPanel__list {
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.BizQueueControlPanel__list-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.BizQueueControlPanel__tabs {
  display: inline-flex;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.BizQueueControlPanel__tab {
  appearance: none;
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: background 0.15s ease;
  min-height: 32px;
}

.BizQueueControlPanel__tab:hover {
  background: rgb(0 0 0 / 4%);
}

.BizQueueControlPanel__tab--active {
  background: #fff;
  color: #303133;
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
}

.BizQueueControlPanel__tab-count {
  font-size: 12px;
  color: #909399;
  font-variant-numeric: tabular-nums;
}

.BizQueueControlPanel__search {
  flex: 1;
  min-width: 180px;
}

// ===== 列表本體（捲動界線）=====
.BizQueueControlPanel__list-body {
  max-height: min(60vh, 480px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.BizQueueControlPanel__list-empty {
  text-align: center;
  padding: 24px 16px;
  color: #c0c4cc;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.BizQueueControlPanel__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed #ebeef5;
}

.BizQueueControlPanel__row:last-child {
  border-bottom: none;
}

.BizQueueControlPanel__row--called {
  background: #fff7f7;
  margin: 0 -8px;
  padding: 8px;
  border-radius: 6px;
}

.BizQueueControlPanel__row--done {
  opacity: 0.4;
}

.BizQueueControlPanel__row--skipped {
  opacity: 0.5;
  color: #c0c4cc;
}

.BizQueueControlPanel__row-number {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  color: #303133;
}

.BizQueueControlPanel__row--called .BizQueueControlPanel__row-number {
  color: #f56c6c;
}

.BizQueueControlPanel__row-customer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.BizQueueControlPanel__row-name {
  font-size: 14px;
  color: #303133;
}

.BizQueueControlPanel__row-phone {
  font-size: 12px;
  color: #909399;
}

.BizQueueControlPanel__row-status {
  font-size: 12px;
  color: #606266;
  flex-shrink: 0;
}

.BizQueueControlPanel__row-eta {
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

// ===== RWD：< 768px 手機 =====
@media (max-width: 767px) {
  .BizQueueControlPanel__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .BizQueueControlPanel__call-next {
    width: 100%;
  }

  .BizQueueControlPanel__walk-in {
    width: 100%;
  }

  .BizQueueControlPanel__serving-row {
    flex-wrap: wrap;
  }

  .BizQueueControlPanel__serving-row-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .BizQueueControlPanel__list-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .BizQueueControlPanel__tabs {
    overflow-x: auto;
  }

  .BizQueueControlPanel__search {
    width: 100%;
  }

  .BizQueueControlPanel__row {
    flex-wrap: wrap;
    row-gap: 4px;
  }

  .BizQueueControlPanel__row-phone {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    background: rgb(144 147 153 / 10%);
    border-radius: 4px;
    font-size: 11px;
    margin-top: 4px;
    align-self: flex-start;
  }
}

.BizQueueControlPanel__providerLabel {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  color: $secondary;
  margin-top: 2px;
}
</style>
