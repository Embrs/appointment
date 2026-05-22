<script setup lang="ts">
// BizQueueCheckInPanel — 商家報到台（啟用 Provider 制商家才渲染）
// 每張 WAITING 票一張卡片：顯示姓名 / 號碼 / 服務 / Provider 副標 + 診間下拉 + 確認報到
// 「確認報到」不改派：純前端 splice 移除（本地 dismissedTicketIds Set）；改派：呼叫 AssignResourceQueue
import { UseProviderLabel } from '~/composables/app/use-provider-label';

interface QueueCheckInPanelProps {
  /** 商家當日總覽（含每服務的 resources + tickets） */
  today: GetQueueTodayRes | null;
  /** 自 GetSelfMerchant 取得；用於 useProviderLabel 自訂稱呼解析 */
  merchant: SelfMerchantFull | null;
  /** 確認 / 改派操作 loading */
  loading?: boolean;
}

const props = withDefaults(defineProps<QueueCheckInPanelProps>(), {
  loading: false
});

type Emit = {
  /** 改派成功（或 no-op）後通知父層重抓 today（讓 ServiceMap 同步） */
  'after-assign': [ticketId: string];
  /** 純前端確認（無改派）後通知父層（不需重抓，但父層可記錄已報到） */
  'after-dismiss': [ticketId: string];
};
const emit = defineEmits<Emit>();

const { t } = useI18n();
const merchantRef = computed(() => props.merchant);
const { FormatProviderDisplay } = UseProviderLabel(merchantRef);

/** 本地記錄已「確認報到」過的票 id，避免重複出現 */
const dismissedTicketIds = ref(new Set<string>());

/** 員工尚未送出時、各卡選中的 resourceId（key = ticketId） */
const pendingResourceId = ref<Record<string, string | null>>({});

/** 處理中 ticketId 集合，避免重複送出 */
const inflightIds = ref(new Set<string>());

interface CheckInItem {
  ticketId: string;
  serviceId: string;
  serviceName: string;
  ticketNumber: number;
  customerLastName: string;
  customerTitle: CustomerTitleType;
  currentResourceId: string | null;
  providerName: string | null;
  takenAt: string;
  /** 該 ticket service 已綁的 active resource，含每個 resource 當前排定 Provider */
  resourceOptions: Array<{ id: string; name: string; providerName: string | null }>;
}

const Items = computed<CheckInItem[]>(() => {
  const out: CheckInItem[] = [];
  for (const s of props.today?.services ?? []) {
    // 該 service 內 active resource 的下拉 options（含每個 resource 當下 Provider 名稱）
    const options = s.resources
      .filter((r) => r.id !== null && r.isActive !== false)
      .map((r) => ({
        id: r.id as string,
        name: r.name ?? '',
        providerName: r.provider?.name ?? null
      }));
    for (const r of s.resources) {
      for (const t of r.tickets) {
        if (t.status !== 'WAITING') continue;
        if (dismissedTicketIds.value.has(t.id)) continue;
        out.push({
          ticketId: t.id,
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          ticketNumber: t.ticketNumber,
          customerLastName: t.customerLastName,
          customerTitle: t.customerTitle,
          currentResourceId: r.id,
          providerName: t.providerName ?? null,
          takenAt: t.takenAt,
          resourceOptions: options
        });
      }
    }
  }
  // takenAt 升序（最早抽號的先報到）
  return out.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
});

const TitleLabel = (title: CustomerTitleType): string => {
  const map: Record<CustomerTitleType, string> = {
    MR: t('appointment.customerTitle.MR'),
    MRS: t('appointment.customerTitle.MRS'),
    MISS: t('appointment.customerTitle.MISS'),
    MX: t('appointment.customerTitle.MX')
  };
  return map[title] ?? '';
};

/** 取卡片下拉「目前選中」的 resourceId（fallback 為 ticket 當前 resourceId） */
const SelectedResourceIdOf = (item: CheckInItem): string | null => {
  const pending = pendingResourceId.value[item.ticketId];
  if (pending !== undefined) return pending;
  return item.currentResourceId;
};

const SetPendingResource = (ticketId: string, resourceId: string | null) => {
  pendingResourceId.value = { ...pendingResourceId.value, [ticketId]: resourceId };
};

const ClickConfirm = async (item: CheckInItem) => {
  if (inflightIds.value.has(item.ticketId)) return;
  const target = SelectedResourceIdOf(item);

  // 情境 A：不改派 → 純前端移除
  if (target === item.currentResourceId) {
    dismissedTicketIds.value.add(item.ticketId);
    ElMessage.success(t('queue.checkIn.confirmed'));
    emit('after-dismiss', item.ticketId);
    return;
  }

  // 情境 B：改派 → 呼叫 API
  if (!target) {
    ElMessage.warning(t('queue.checkIn.assignedRoom'));
    return;
  }
  inflightIds.value.add(item.ticketId);
  try {
    const res = await $api.AssignResourceQueue({ id: item.ticketId, resourceId: target });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || t('queue.checkIn.assignFailed'));
      return;
    }
    const fromName =
      item.resourceOptions.find((o) => o.id === item.currentResourceId)?.name ?? '';
    const toName = res.data.toResourceName ?? '';
    if (fromName && toName && fromName !== toName) {
      ElMessage.success(t('queue.checkIn.reassigned', { from: fromName, to: toName }));
    } else {
      ElMessage.success(t('queue.checkIn.confirmed'));
    }
    dismissedTicketIds.value.add(item.ticketId);
    emit('after-assign', item.ticketId);
  } finally {
    inflightIds.value.delete(item.ticketId);
  }
};
</script>

<template lang="pug">
.BizQueueCheckInPanel(data-testid="queue-check-in-panel")
  .BizQueueCheckInPanel__header
    h2.BizQueueCheckInPanel__title {{ $t('queue.checkIn.title') }}
    span.BizQueueCheckInPanel__count(
      v-if="Items.length > 0"
      data-testid="queue-check-in-count"
    ) {{ Items.length }}

  .BizQueueCheckInPanel__empty(
    v-if="Items.length === 0"
    data-testid="queue-check-in-empty"
  ) {{ $t('queue.checkIn.empty') }}

  .BizQueueCheckInPanel__list(v-else)
    .BizQueueCheckInPanel__card(
      v-for="item of Items"
      :key="item.ticketId"
      data-testid="queue-check-in-card"
    )
      .BizQueueCheckInPanel__head
        .BizQueueCheckInPanel__number {{ String(item.ticketNumber).padStart(2, '0') }}
        .BizQueueCheckInPanel__customer
          .BizQueueCheckInPanel__name {{ item.customerLastName }} {{ TitleLabel(item.customerTitle) }}
          .BizQueueCheckInPanel__service {{ item.serviceName }}
        .BizQueueCheckInPanel__provider(
          v-if="FormatProviderDisplay(item.providerName)"
          data-testid="queue-check-in-provider"
        ) {{ FormatProviderDisplay(item.providerName) }}
        .BizQueueCheckInPanel__providerEmpty(
          v-else
          data-testid="queue-check-in-provider-empty"
        ) {{ $t('queue.checkIn.unassignedProvider') }}

      .BizQueueCheckInPanel__assign
        ElSelect(
          :model-value="SelectedResourceIdOf(item)"
          :placeholder="$t('queue.checkIn.assignedRoom')"
          :data-testid="`queue-check-in-resource-${item.ticketId}`"
          :disabled="loading || inflightIds.has(item.ticketId)"
          @update:model-value="(v) => SetPendingResource(item.ticketId, v)"
        )
          ElOption(
            v-for="opt of item.resourceOptions"
            :key="opt.id"
            :value="opt.id"
            :label="opt.providerName ? `${opt.name} - ${opt.providerName}` : opt.name"
          )

        ElButton.BizQueueCheckInPanel__confirm(
          type="primary"
          size="default"
          :loading="inflightIds.has(item.ticketId)"
          :disabled="loading || item.resourceOptions.length === 0"
          :data-testid="`queue-check-in-confirm-${item.ticketId}`"
          @click="ClickConfirm(item)"
        ) {{ $t('queue.checkIn.confirm') }}
</template>

<style lang="scss" scoped>
.BizQueueCheckInPanel {
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.BizQueueCheckInPanel__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.BizQueueCheckInPanel__title {
  font-size: 18px;
  font-weight: 600;
  color: $primary;
  margin: 0;
}

.BizQueueCheckInPanel__count {
  background-color: rgba(0, 173, 169, 0.12);
  color: $secondary;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
}

.BizQueueCheckInPanel__empty {
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  padding: 24px 12px;
  font-size: 14px;
}

.BizQueueCheckInPanel__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.BizQueueCheckInPanel__card {
  background-color: rgba(53, 77, 123, 0.04);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.BizQueueCheckInPanel__head {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 14px;
  row-gap: 4px;
  align-items: center;
}

.BizQueueCheckInPanel__number {
  font-size: 32px;
  font-weight: 700;
  color: $primary;
  line-height: 1;
  grid-row: span 2;
}

.BizQueueCheckInPanel__customer {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.BizQueueCheckInPanel__name {
  font-size: 16px;
  font-weight: 600;
  color: $primary;
}

.BizQueueCheckInPanel__service {
  font-size: 12px;
  color: rgba(69, 69, 69, 0.6);
}

.BizQueueCheckInPanel__provider {
  grid-column: span 2;
  font-size: 13px;
  font-weight: 500;
  color: $secondary;
}

.BizQueueCheckInPanel__providerEmpty {
  grid-column: span 2;
  font-size: 12px;
  color: rgba(69, 69, 69, 0.4);
  font-style: italic;
}

.BizQueueCheckInPanel__assign {
  display: flex;
  align-items: center;
  gap: 10px;
}

.BizQueueCheckInPanel__assign :deep(.el-select) {
  flex: 1;
}

.BizQueueCheckInPanel__confirm {
  flex-shrink: 0;
}

@media (max-width: 599px) {
  .BizQueueCheckInPanel__list {
    grid-template-columns: 1fr;
  }
  .BizQueueCheckInPanel__assign {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
