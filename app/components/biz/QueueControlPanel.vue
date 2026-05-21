<script setup lang="ts">
// BizQueueControlPanel — 商家叫號控制面板
// 顯示：服務名稱、當前服務中號碼、最新號碼、WAITING 票列表、叫下一號 / 完成 / 過號

interface QueueControlPanelProps {
  service: QueueTodayServiceItem;
  /** 服務中票 id（由 store.serviceMap 取得，可能 store 內最即時） */
  servingTicketId: string;
  /** 是否載入中 */
  loading?: boolean;
}

const props = withDefaults(defineProps<QueueControlPanelProps>(), {
  loading: false
});

type Emit = {
  'click-call-next': [serviceId: string];
  'click-done': [ticketId: string];
  'click-skip': [ticketId: string];
  'click-walk-in': [serviceId: string];
};
const emit = defineEmits<Emit>();

const WaitingTickets = computed(() =>
  props.service.tickets.filter((t) => t.status === 'WAITING')
);

const queueStore = StoreQueueRealtime();
const { t } = useI18n();

// 取每張 WAITING 票的即時 ETA：優先用 store 即時計算（隨 WS 推進），fallback 至 ticket.estimatedWaitMinutes
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

const CalledTickets = computed(() =>
  props.service.tickets.filter((t) => t.status === 'CALLED')
);

const ServingTicket = computed(() =>
  props.service.tickets.find((t) => t.id === props.servingTicketId && t.status === 'CALLED')
  ?? CalledTickets.value[CalledTickets.value.length - 1]
);

const ServingNumber = computed(() => ServingTicket.value?.ticketNumber ?? props.service.lastCalledNumber);

const ClickCallNext = () => emit('click-call-next', props.service.serviceId);
const ClickDone = (ticketId: string) => emit('click-done', ticketId);
const ClickSkip = (ticketId: string) => emit('click-skip', ticketId);
const ClickWalkIn = () => emit('click-walk-in', props.service.serviceId);

const StatusLabel = (status: string) => {
  switch (status) {
    case 'WAITING': return '等待中';
    case 'CALLED': return '服務中';
    case 'DONE': return '已完成';
    case 'SKIPPED': return '已過號';
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

// 與顧客「找回我的號碼」find 頁的「末 4 碼」對齊：商家現場唸「末 4 碼 1234 的顧客」、顧客 find 也用末 4 查
// 商家現場代建未留電話時為 null，顯示「未留電話」標記
const MaskPhone = (phone: string | null) => {
  if (phone === null) return '（未留電話）';
  if (!phone) return '';
  if (phone.length <= 4) return phone;
  return `••••${phone.slice(-4)}`;
};
</script>

<template lang="pug">
.BizQueueControlPanel
  .BizQueueControlPanel__head
    .BizQueueControlPanel__name {{ service.serviceName }}
    ElTag.BizQueueControlPanel__status(
      v-if="!service.isActive"
      type="info"
      effect="plain"
      size="small"
    ) 停用中

  BizQueueDisplay.BizQueueControlPanel__display(
    primary-label="服務中"
    :primary-number="ServingNumber"
    secondary-label="最後發出號碼"
    :secondary-number="service.lastTicketNumber"
    :highlight="!!ServingTicket"
    :hint="ServingTicket ? `服務中：${ServingTicket.customerLastName} ${TitleLabel(ServingTicket.customerTitle)}` : ''"
  )

  .BizQueueControlPanel__actions
    ElButton.BizQueueControlPanel__call-next(
      type="primary"
      size="large"
      :loading="loading"
      :disabled="WaitingTickets.length === 0"
      @click="ClickCallNext"
    ) 叫下一號
    template(v-if="ServingTicket")
      ElButton(
        type="success"
        size="large"
        :loading="loading"
        @click="ClickDone(ServingTicket?.id || '')"
      ) 完成
      ElButton(
        type="warning"
        size="large"
        :loading="loading"
        @click="ClickSkip(ServingTicket?.id || '')"
      ) 過號
    ElButton.BizQueueControlPanel__walk-in(
      size="large"
      :disabled="loading || !service.isActive"
      data-testid="queue-walk-in-entry"
      @click="ClickWalkIn"
    ) {{ $t('queue.walkIn.title') }}

  .BizQueueControlPanel__list
    .BizQueueControlPanel__list-title
      span 號碼列表
      span.BizQueueControlPanel__count {{ `（共 ${service.tickets.length} 張）` }}
    .BizQueueControlPanel__list-empty(v-if="service.tickets.length === 0") 今日尚無號碼
    .BizQueueControlPanel__row(
      v-for="t of service.tickets"
      :key="t.id"
      :class="`BizQueueControlPanel__row--${t.status.toLowerCase()}`"
    )
      .BizQueueControlPanel__row-number {{ String(t.ticketNumber).padStart(2, '0') }}
      .BizQueueControlPanel__row-customer
        span.BizQueueControlPanel__row-name {{ t.customerLastName }} {{ TitleLabel(t.customerTitle) }}
        span.BizQueueControlPanel__row-phone {{ MaskPhone(t.customerPhone) }}
      ElTag.BizQueueControlPanel__row-eta(
        v-if="t.status === 'WAITING' && GetTicketEtaText(t)"
        type="info"
        effect="plain"
        size="small"
        data-testid="queue-row-eta"
      ) {{ GetTicketEtaText(t) }}
      .BizQueueControlPanel__row-status {{ StatusLabel(t.status) }}
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

.BizQueueControlPanel__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.BizQueueControlPanel__call-next {
  flex: 1;
  min-width: 140px;
}

.BizQueueControlPanel__list {
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
}

.BizQueueControlPanel__list-title {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.BizQueueControlPanel__count {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

.BizQueueControlPanel__list-empty {
  text-align: center;
  padding: 16px;
  color: #c0c4cc;
  font-size: 13px;
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
  background: #fef0f0;
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
}

.BizQueueControlPanel__row-eta {
  font-variant-numeric: tabular-nums;
}
</style>
