<script setup lang="ts">
// BizBookingCard — 顧客側單筆預約卡片
// 規範：startAt 用商家 tz 顯示；CANCELED 顯示理由與發起方

interface BookingCardProps {
  appointment: LookupAppointmentItem;
  timezone: string;
  /** 顯示取消按鈕（未取消且未過期） */
  cancellable?: boolean;
}

const props = withDefaults(defineProps<BookingCardProps>(), {
  cancellable: true
});

type Emit = {
  'click-cancel': [id: string];
};
const emit = defineEmits<Emit>();

const { t } = useI18n();

const fmtDate = (iso: string) => $dayjs(new Date(iso)).tz(props.timezone).format('YYYY-MM-DD');
const fmtTime = (iso: string) => $dayjs(new Date(iso)).tz(props.timezone).format('HH:mm');

const statusLabel = computed(() => t(`booking.status.${props.appointment.status}`, props.appointment.status));

const cancelerLabel = computed(() => {
  const by = props.appointment.canceledBy;
  if (!by) return '';
  return t(`booking.canceledBy.${by}`, '');
});

const showCancelBtn = computed(() => {
  if (!props.cancellable) return false;
  if (props.appointment.status !== 'CONFIRMED') return false;
  if (new Date(props.appointment.startAt).getTime() <= Date.now()) return false;
  return true;
});
</script>

<template lang="pug">
.BizBookingCard(:class="`is-${appointment.status.toLowerCase()}`")
  .BizBookingCard__head
    .BizBookingCard__service {{ appointment.service.name }}
    .BizBookingCard__status {{ statusLabel }}
  .BizBookingCard__row
    span.BizBookingCard__label {{ $t('booking.fields.date') }}
    span.BizBookingCard__value {{ fmtDate(appointment.startAt) }} {{ fmtTime(appointment.startAt) }} ~ {{ fmtTime(appointment.endAt) }}
  .BizBookingCard__row(v-if="appointment.resource")
    span.BizBookingCard__label {{ $t('booking.fields.resource') }}
    span.BizBookingCard__value {{ appointment.resource.name }}
  .BizBookingCard__row(v-if="appointment.provider")
    span.BizBookingCard__label {{ $t('booking.steps.provider', { label: '' }).trim() || '服務人員' }}
    span.BizBookingCard__value
      | {{ appointment.provider.name }}
      span(v-if="!appointment.provider.isActive") {{ $t('appointment.fields.providerInactiveSuffix') }}
  .BizBookingCard__row(v-if="appointment.note")
    span.BizBookingCard__label {{ $t('booking.fields.note') }}
    span.BizBookingCard__value {{ appointment.note }}
  .BizBookingCard__cancel-block(v-if="appointment.status === 'CANCELED'")
    .BizBookingCard__cancel-by {{ cancelerLabel }}
    .BizBookingCard__cancel-reason(v-if="appointment.cancelReason") ｜{{ appointment.cancelReason }}
  .BizBookingCard__actions(v-if="showCancelBtn")
    ElButton(
      type="danger"
      plain
      size="small"
      @click="emit('click-cancel', appointment.id)"
    ) {{ $t('booking.actions.cancel') }}
</template>

<style lang="scss" scoped>
.BizBookingCard {
  background: #fff;
  border-radius: 8px;
  padding: 14px 16px;
  border: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.BizBookingCard.is-canceled {
  background: #fafafa;
  opacity: 0.85;
}

.BizBookingCard__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f2f5;
  padding-bottom: 8px;
  margin-bottom: 4px;
}

.BizBookingCard__service {
  font-size: 16px;
  font-weight: 600;
}

.BizBookingCard__status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #ecf5ff;
  color: #409eff;
}

.is-canceled .BizBookingCard__status {
  background: #fef0f0;
  color: #f56c6c;
}

.is-completed .BizBookingCard__status {
  background: #f0f9eb;
  color: #67c23a;
}

.BizBookingCard__row {
  display: flex;
  gap: 12px;
  font-size: 13px;
}

.BizBookingCard__label {
  color: #909399;
  flex: 0 0 48px;
}

.BizBookingCard__value {
  color: #303133;
  flex: 1;
}

.BizBookingCard__cancel-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 4px;
  font-size: 12px;
  color: #f56c6c;
}

.BizBookingCard__actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
