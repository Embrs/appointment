<script setup lang="ts">
// OpenDialogBookingSuccess — 預約成功通知

type Props = {
  params: DialogBookingSuccessParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const dateLabel = computed(() =>
  $dayjs(new Date(props.params.startAt)).tz(props.params.timezone).format('YYYY-MM-DD HH:mm')
);

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = () => {
  props.resolve({ done: true });
  emit('on-close');
};
</script>

<template lang="pug">
.OpenDialogBookingSuccess
  .OpenDialogBookingSuccess__mask(v-motion-fade)
  .OpenDialogBookingSuccess__content(v-motion-roll-bottom)
    .OpenDialogBookingSuccess__icon ✓
    .OpenDialogBookingSuccess__title 預約成功
    .OpenDialogBookingSuccess__body
      .OpenDialogBookingSuccess__row {{ params.serviceName }}
      .OpenDialogBookingSuccess__row {{ dateLabel }}
      .OpenDialogBookingSuccess__hint 請記下日期與時段；如需取消，可至「我的預約」操作
    .OpenDialogBookingSuccess__footer
      ElButton(type="primary" @click="EmitClose") 知道了
</template>

<style lang="scss" scoped>
.OpenDialogBookingSuccess {
  @include fixed("fill");
  @include center;
}

.OpenDialogBookingSuccess__mask {
  @include absolute("fill");
  background: rgb(0 0 0 / 50%);
}

.OpenDialogBookingSuccess__content {
  position: relative;
  z-index: 1;
  width: min(360px, calc(100vw - 32px));
  background: #fff;
  border-radius: 12px;
  padding: 24px 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.OpenDialogBookingSuccess__icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #67c23a;
  color: #fff;
  border-radius: 50%;
  font-size: 28px;
  font-weight: 700;
}

.OpenDialogBookingSuccess__title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.OpenDialogBookingSuccess__body {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.OpenDialogBookingSuccess__row {
  font-size: 14px;
  color: #606266;
}

.OpenDialogBookingSuccess__hint {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.OpenDialogBookingSuccess__footer {
  margin-top: 8px;
  width: 100%;
}

.OpenDialogBookingSuccess__footer .el-button {
  width: 100%;
}
</style>
