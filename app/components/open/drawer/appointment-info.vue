<script setup lang="ts">
// OpenDrawerAppointmentInfo — 商家後台預約詳情抽屜
// 含「商家取消」按鈕（必須填理由 → 開另一個 dialog）

type Props = {
  params: DrawerAppointmentInfoParams;
  resolve: (value: { done: boolean; canceled?: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const cancelling = ref(false);
const appointment = ref<AppointmentItem>(props.params.appointment);

const titleLabel = (t: string) => ({ MR: '先生', MRS: '女士', MISS: '小姐', MX: '客人' } as Record<string, string>)[t] ?? '';
const dateLabel = computed(() =>
  $dayjs(new Date(appointment.value.startAt)).tz(props.params.timezone).format('YYYY-MM-DD HH:mm')
);
const endLabel = computed(() =>
  $dayjs(new Date(appointment.value.endAt)).tz(props.params.timezone).format('HH:mm')
);

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false, canceled = false) => {
  props.resolve({ done, canceled });
  emit('on-close');
};

const ClickCancel = async () => {
  const result = await $open.DialogCancelReason({});
  if (!result.done) return;

  cancelling.value = true;
  try {
    const res = await $api.CancelAppointment({ id: appointment.value.id, reason: result.reason });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '取消失敗');
      return;
    }
    ElMessage.success('已取消預約');
    EmitClose(true, true);
  } finally {
    cancelling.value = false;
  }
};

const canCancel = computed(() => appointment.value.status === 'CONFIRMED');
</script>

<template lang="pug">
.OpenDrawerAppointmentInfo
  .OpenDrawerAppointmentInfo__mask(v-motion-fade @click="EmitClose(false)")
  .OpenDrawerAppointmentInfo__panel(v-motion-slide-right)
    .OpenDrawerAppointmentInfo__header
      span.OpenDrawerAppointmentInfo__title 預約詳情
      button.OpenDrawerAppointmentInfo__close(type="button" :disabled="cancelling" @click="EmitClose(false)") ✕
    .OpenDrawerAppointmentInfo__body
      .OpenDrawerAppointmentInfo__row
        span.OpenDrawerAppointmentInfo__label 狀態
        span.OpenDrawerAppointmentInfo__value {{ appointment.status }}
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
        span.OpenDrawerAppointmentInfo__value {{ appointment.customerLastName }}{{ titleLabel(appointment.customerTitle) }}
      .OpenDrawerAppointmentInfo__row
        span.OpenDrawerAppointmentInfo__label 手機
        span.OpenDrawerAppointmentInfo__value {{ appointment.customerPhone }}
      .OpenDrawerAppointmentInfo__row(v-if="appointment.note")
        span.OpenDrawerAppointmentInfo__label 備註
        span.OpenDrawerAppointmentInfo__value {{ appointment.note }}
      .OpenDrawerAppointmentInfo__row(v-if="appointment.cancelReason")
        span.OpenDrawerAppointmentInfo__label 取消理由
        span.OpenDrawerAppointmentInfo__value {{ appointment.cancelReason }}
    .OpenDrawerAppointmentInfo__footer(v-if="canCancel")
      ElButton(
        type="danger"
        plain
        :loading="cancelling"
        @click="ClickCancel"
      ) 商家取消
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
  padding: 12px 20px 20px;
  border-top: 1px solid #ebeef5;
}

.OpenDrawerAppointmentInfo__footer .el-button {
  width: 100%;
}
</style>
