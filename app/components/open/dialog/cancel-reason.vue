<script setup lang="ts">
// OpenDialogCancelReason — 商家取消預約填理由

type Props = {
  params: DialogCancelReasonParams;
  resolve: (value: { done: boolean; reason?: string }) => void;
  level: number;
};
const props = defineProps<Props>();

const reason = ref('');
const submitting = ref(false);

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done, reason: done ? reason.value.trim() : undefined });
  emit('on-close');
};

const ClickConfirm = () => {
  submitting.value = true;
  try {
    EmitClose(true);
  } finally {
    submitting.value = false;
  }
};
</script>

<template lang="pug">
.OpenDialogCancelReason
  .OpenDialogCancelReason__mask(v-motion-fade)
  .OpenDialogCancelReason__content(v-motion-roll-bottom)
    .OpenDialogCancelReason__header
      span.OpenDialogCancelReason__title 確認取消
      button.OpenDialogCancelReason__close(type="button" :disabled="submitting" @click="EmitClose(false)") ✕
    .OpenDialogCancelReason__body
      .OpenDialogCancelReason__hint 將取消此筆預約。可選填顧客可見的理由：
      ElInput(
        v-model="reason"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        placeholder="例：臨時休診（可選填）"
      )
    .OpenDialogCancelReason__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") 返回
      ElButton(
        type="danger"
        :loading="submitting"
        @click="ClickConfirm"
      ) 確認取消
</template>

<style lang="scss" scoped>
.OpenDialogCancelReason {
  @include fixed("fill");
  @include center;
}

.OpenDialogCancelReason__mask {
  @include absolute("fill");
  background: rgb(0 0 0 / 50%);
}

.OpenDialogCancelReason__content {
  position: relative;
  z-index: 1;
  width: min(400px, calc(100vw - 32px));
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

.OpenDialogCancelReason__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogCancelReason__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogCancelReason__close {
  background: transparent;
  border: 0;
  font-size: 18px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogCancelReason__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.OpenDialogCancelReason__hint {
  font-size: 13px;
  color: #606266;
}

.OpenDialogCancelReason__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid #ebeef5;
}
</style>
