<script setup lang="ts">
// OpenDrawerBookingConfirm — 預約確認抽屜（最後一步）
// 規範：彙整服務/資源/時段/三元組，等使用者按「確認預約」才呼叫 API

type Props = {
  params: DrawerBookingConfirmParams;
  resolve: (value: { done: boolean; appointmentId?: string; limitExceeded?: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const { t } = useI18n();
const submitting = ref(false);
const errorMsg = ref('');

const LIMIT_EXCEEDED_TEXT = computed(() => t('booking.messages.limitExceeded'));

const TITLE_KEYS: Record<CustomerTitleType, string> = {
  MR: 'titleMr',
  MRS: 'titleMrs',
  MISS: 'titleMiss',
  MX: 'titleMx'
};
const titleLabel = computed(() => {
  const key = TITLE_KEYS[props.params.customer.title];
  return key ? t(`booking.customer.${key}`) : '';
});

const dateLabel = computed(() =>
  $dayjs(new Date(props.params.startAt)).tz(props.params.timezone).format('YYYY-MM-DD (dddd)')
);

const timeLabel = computed(() => {
  const start = $dayjs(new Date(props.params.startAt)).tz(props.params.timezone).format('HH:mm');
  const end = $dayjs(new Date(props.params.endAt)).tz(props.params.timezone).format('HH:mm');
  return `${start} - ${end}`;
});

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false, appointmentId?: string, limitExceeded = false) => {
  props.resolve({ done, appointmentId, limitExceeded });
  emit('on-close');
};

const ClickConfirm = async () => {
  errorMsg.value = '';
  submitting.value = true;
  try {
    const res = await $api.CreatePublicAppointment({
      slug: props.params.slug,
      serviceId: props.params.serviceId,
      resourceId: props.params.resourceId,
      startAt: props.params.startAt,
      customer: props.params.customer,
      note: props.params.note
    });
    if (res.status.code !== $enum.apiStatus.success) {
      const msg = res.status.message?.zh_tw || '';
      // 達顧客預約上限：交由 book.vue 顯示 alert 並引導至我的預約
      if (res.status.code === 409 && msg === LIMIT_EXCEEDED_TEXT.value) {
        EmitClose(false, undefined, true);
        return;
      }
      errorMsg.value = msg || t('booking.submitFailed');
      return;
    }
    EmitClose(true, res.data.id);
  } finally {
    submitting.value = false;
  }
};
</script>

<template lang="pug">
.OpenDrawerBookingConfirm
  .OpenDrawerBookingConfirm__mask(v-motion-fade @click="EmitClose(false)")
  .OpenDrawerBookingConfirm__panel(v-motion-slide-bottom)
    .OpenDrawerBookingConfirm__header
      span.OpenDrawerBookingConfirm__title {{ $t('booking.actions.confirmBooking') }}
      button.OpenDrawerBookingConfirm__close(type="button" :disabled="submitting" @click="EmitClose(false)") ✕
    .OpenDrawerBookingConfirm__body
      .OpenDrawerBookingConfirm__row
        span.OpenDrawerBookingConfirm__label {{ $t('booking.fields.service') }}
        span.OpenDrawerBookingConfirm__value {{ params.serviceName }}
      .OpenDrawerBookingConfirm__row(v-if="params.resourceName")
        span.OpenDrawerBookingConfirm__label {{ $t('booking.fields.resource') }}
        span.OpenDrawerBookingConfirm__value {{ params.resourceName }}
      .OpenDrawerBookingConfirm__row
        span.OpenDrawerBookingConfirm__label {{ $t('booking.fields.date') }}
        span.OpenDrawerBookingConfirm__value {{ dateLabel }}
      .OpenDrawerBookingConfirm__row
        span.OpenDrawerBookingConfirm__label {{ $t('booking.fields.time') }}
        span.OpenDrawerBookingConfirm__value {{ timeLabel }}
      .OpenDrawerBookingConfirm__divider
      .OpenDrawerBookingConfirm__row
        span.OpenDrawerBookingConfirm__label {{ $t('booking.customer.lastName') }}
        span.OpenDrawerBookingConfirm__value {{ params.customer.lastName }} {{ titleLabel }}
      .OpenDrawerBookingConfirm__row
        span.OpenDrawerBookingConfirm__label {{ $t('booking.customer.phone') }}
        span.OpenDrawerBookingConfirm__value {{ params.customer.phone }}
      .OpenDrawerBookingConfirm__row(v-if="params.note")
        span.OpenDrawerBookingConfirm__label {{ $t('booking.fields.note') }}
        span.OpenDrawerBookingConfirm__value {{ params.note }}
      .OpenDrawerBookingConfirm__error(v-if="errorMsg") {{ errorMsg }}
    .OpenDrawerBookingConfirm__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") {{ $t('booking.actions.reviseBooking') }}
      ElButton(type="primary" :loading="submitting" @click="ClickConfirm") {{ $t('booking.actions.confirmBooking') }}
</template>

<style lang="scss" scoped>
.OpenDrawerBookingConfirm {
  @include fixed("fill");

  @include rwd-pc {
    @include center;
  }
}

.OpenDrawerBookingConfirm__mask {
  @include absolute("fill");
  background: rgb(0 0 0 / 45%);
}

.OpenDrawerBookingConfirm__panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 12px 12px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 80vh;

  @include rwd-pc {
    position: relative;
    bottom: auto;
    left: auto;
    right: auto;
    width: min(480px, calc(100vw - 32px));
    max-height: min(640px, calc(100vh - 32px));
    border-radius: 12px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 18%);
  }
}

.OpenDrawerBookingConfirm__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDrawerBookingConfirm__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDrawerBookingConfirm__close {
  background: transparent;
  border: 0;
  font-size: 18px;
  cursor: pointer;
  color: #909399;
}

.OpenDrawerBookingConfirm__body {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}

.OpenDrawerBookingConfirm__row {
  display: flex;
  padding: 10px 0;
  font-size: 14px;
}

.OpenDrawerBookingConfirm__label {
  flex: 0 0 64px;
  color: #909399;
}

.OpenDrawerBookingConfirm__value {
  flex: 1;
  color: #303133;
  font-weight: 500;
}

.OpenDrawerBookingConfirm__divider {
  height: 1px;
  background: #ebeef5;
  margin: 8px 0;
}

.OpenDrawerBookingConfirm__error {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fef0f0;
  color: #f56c6c;
  border-radius: 4px;
  font-size: 13px;
}

.OpenDrawerBookingConfirm__footer {
  display: flex;
  gap: 8px;
  padding: 12px 20px 20px;
  border-top: 1px solid #ebeef5;
}

.OpenDrawerBookingConfirm__footer > * {
  flex: 1;
}
</style>
