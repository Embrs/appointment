<script setup lang="ts">
// OpenDrawerAppointmentInfo — 商家後台預約詳情抽屜（操作中樞）
// 整合四個狀態操作：取消預約、標記未到、標記完成、修改預約
// 規範：
//   - CONFIRMED 未到時間：顯示「取消預約」「修改預約」
//   - CONFIRMED 已過時間：四顆按鈕全顯示
//   - 已結案（CANCELED / COMPLETED / NO_SHOW）：footer 不顯示任何操作
//   - 任一操作 API 成功 → emit done=true，父頁面 ApiLoad 重新載入

type Props = {
  params: DrawerAppointmentInfoParams;
  resolve: (value: { done: boolean; canceled?: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const { t } = useI18n();

const submitting = ref(false);
const appointment = ref<AppointmentItem>(props.params.appointment);

const dateLabel = computed(() =>
  $dayjs(new Date(appointment.value.startAt)).tz(props.params.timezone).format('YYYY-MM-DD HH:mm')
);
const endLabel = computed(() =>
  $dayjs(new Date(appointment.value.endAt)).tz(props.params.timezone).format('HH:mm')
);
const statusLabel = computed(() => t(`appointment.status.${appointment.value.status}`, appointment.value.status));
const titleLabel = computed(() => t(`appointment.customerTitle.${appointment.value.customerTitle}`, ''));

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false, canceled = false) => {
  props.resolve({ done, canceled });
  emit('on-close');
};

const isConfirmed = computed(() => appointment.value.status === 'CONFIRMED');
const isPastStart = computed(
  () => new Date(appointment.value.startAt).getTime() <= Date.now()
);
const canCancel = computed(() => isConfirmed.value);
const canReschedule = computed(() => isConfirmed.value);
const canMarkDone = computed(() => isConfirmed.value && isPastStart.value);
const hasActions = computed(() => canCancel.value || canReschedule.value || canMarkDone.value);

const ClickCancel = async () => {
  const result = await $open.DialogCancelReason({});
  if (!result.done) return;

  submitting.value = true;
  try {
    const res = await $api.CancelAppointment({ id: appointment.value.id, reason: result.reason });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '取消失敗');
      return;
    }
    ElMessage.success('已取消預約');
    EmitClose(true, true);
  } finally {
    submitting.value = false;
  }
};

const ClickComplete = async () => {
  try {
    await ElMessageBox.confirm(t('appointment.confirm.complete'), t('appointment.actions.complete'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'success'
    });
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const res = await $api.CompleteAppointment({ id: appointment.value.id });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '標記失敗');
      return;
    }
    ElMessage.success('已標記為完成');
    EmitClose(true);
  } finally {
    submitting.value = false;
  }
};

const ClickNoShow = async () => {
  try {
    await ElMessageBox.confirm(t('appointment.confirm.noShow'), t('appointment.actions.noShow'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    });
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const res = await $api.NoShowAppointment({ id: appointment.value.id });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '標記失敗');
      return;
    }
    ElMessage.success('已標記為未到');
    EmitClose(true);
  } finally {
    submitting.value = false;
  }
};

const ClickReschedule = async () => {
  const result = await $open.DialogAppointmentReschedule({
    appointment: appointment.value,
    slug: props.params.slug,
    timezone: props.params.timezone
  });
  if (result.done) EmitClose(true);
};
</script>

<template lang="pug">
.OpenDrawerAppointmentInfo
  .OpenDrawerAppointmentInfo__mask(v-motion-fade @click="EmitClose(false)")
  .OpenDrawerAppointmentInfo__panel(v-motion-slide-right)
    .OpenDrawerAppointmentInfo__header
      span.OpenDrawerAppointmentInfo__title 預約詳情
      button.OpenDrawerAppointmentInfo__close(type="button" :disabled="submitting" @click="EmitClose(false)") ✕
    .OpenDrawerAppointmentInfo__body
      .OpenDrawerAppointmentInfo__row
        span.OpenDrawerAppointmentInfo__label 狀態
        span.OpenDrawerAppointmentInfo__value {{ statusLabel }}
      .OpenDrawerAppointmentInfo__row
        span.OpenDrawerAppointmentInfo__label 服務
        span.OpenDrawerAppointmentInfo__value {{ appointment.service.name }}
      .OpenDrawerAppointmentInfo__row(v-if="appointment.resource")
        span.OpenDrawerAppointmentInfo__label 資源
        span.OpenDrawerAppointmentInfo__value {{ appointment.resource.name }}
      .OpenDrawerAppointmentInfo__row
        span.OpenDrawerAppointmentInfo__label 時間
        span.OpenDrawerAppointmentInfo__value {{ dateLabel }} ~ {{ endLabel }}
      .OpenDrawerAppointmentInfo__divider
      .OpenDrawerAppointmentInfo__row
        span.OpenDrawerAppointmentInfo__label 顧客
        span.OpenDrawerAppointmentInfo__value {{ appointment.customerLastName }}{{ titleLabel }}
      .OpenDrawerAppointmentInfo__row
        span.OpenDrawerAppointmentInfo__label 手機
        span.OpenDrawerAppointmentInfo__value {{ appointment.customerPhone }}
      .OpenDrawerAppointmentInfo__row(v-if="appointment.note")
        span.OpenDrawerAppointmentInfo__label 備註
        span.OpenDrawerAppointmentInfo__value {{ appointment.note }}
      .OpenDrawerAppointmentInfo__row(v-if="appointment.cancelReason")
        span.OpenDrawerAppointmentInfo__label 取消理由
        span.OpenDrawerAppointmentInfo__value {{ appointment.cancelReason }}
    .OpenDrawerAppointmentInfo__footer(v-if="hasActions")
      ElButton.OpenDrawerAppointmentInfo__btn(
        v-if="canCancel"
        type="danger"
        plain
        :loading="submitting"
        @click="ClickCancel"
      ) {{ $t('appointment.actions.cancel') }}
      ElButton.OpenDrawerAppointmentInfo__btn(
        v-if="canMarkDone"
        type="warning"
        plain
        :loading="submitting"
        @click="ClickNoShow"
      ) {{ $t('appointment.actions.noShow') }}
      ElButton.OpenDrawerAppointmentInfo__btn(
        v-if="canMarkDone"
        type="success"
        plain
        :loading="submitting"
        @click="ClickComplete"
      ) {{ $t('appointment.actions.complete') }}
      ElButton.OpenDrawerAppointmentInfo__btn(
        v-if="canReschedule"
        type="primary"
        :loading="submitting"
        @click="ClickReschedule"
      ) {{ $t('appointment.actions.reschedule') }}
</template>

<style lang="scss" scoped>
.OpenDrawerAppointmentInfo {
  @include fixed("fill");
}

.OpenDrawerAppointmentInfo__mask {
  @include absolute("fill");
  background: rgb(0 0 0 / 45%);
}

.OpenDrawerAppointmentInfo__panel {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: min(420px, 100vw);
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 16px rgb(0 0 0 / 10%);
}

.OpenDrawerAppointmentInfo__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDrawerAppointmentInfo__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDrawerAppointmentInfo__close {
  background: transparent;
  border: 0;
  font-size: 18px;
  cursor: pointer;
  color: #909399;
}

.OpenDrawerAppointmentInfo__body {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}

.OpenDrawerAppointmentInfo__row {
  display: flex;
  padding: 8px 0;
  font-size: 14px;
}

.OpenDrawerAppointmentInfo__label {
  flex: 0 0 80px;
  color: #909399;
}

.OpenDrawerAppointmentInfo__value {
  flex: 1;
  color: #303133;
}

.OpenDrawerAppointmentInfo__divider {
  height: 1px;
  background: #ebeef5;
  margin: 8px 0;
}

.OpenDrawerAppointmentInfo__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 20px 20px;
  border-top: 1px solid #ebeef5;
}

.OpenDrawerAppointmentInfo__btn {
  flex: 1 1 calc(50% - 4px);
  min-width: 0;
  margin: 0 !important;
}

@media (min-width: 480px) {
  .OpenDrawerAppointmentInfo__btn {
    flex: 1 1 0;
  }
}
</style>
