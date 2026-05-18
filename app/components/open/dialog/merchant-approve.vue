<script setup lang="ts">
// OpenDialogMerchantApprove — 商家「審核通過 / 拒絕」二合一確認彈窗
// approve：純確認；reject：可選填 reason
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogMerchantApproveParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const form = reactive({
  reason: ''
});

const rules: FormRules = {
  reason: [
    { max: 200, message: '理由請在 200 字以內', trigger: 'blur' }
  ]
};

const isApprove = computed(() => props.params.mode === 'approve');
const title = computed(() => isApprove.value ? '審核通過商家' : '拒絕商家申請');
const confirmText = computed(() => isApprove.value ? '確認通過' : '確認拒絕');
const confirmType = computed<'primary' | 'danger'>(() => isApprove.value ? 'primary' : 'danger');

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const ApiSubmit = async () => {
  if (isApprove.value) {
    return await $api.SysApproveMerchant({ id: props.params.merchantId });
  }
  return await $api.SysRejectMerchant({
    id: props.params.merchantId,
    reason: form.reason.trim() || undefined
  });
};

const ApproveFlow = async () => {
  submitting.value = true;
  try {
    const res = await ApiSubmit();
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '操作失敗');
      return;
    }
    ElMessage.success(isApprove.value ? '已通過審核' : '已拒絕申請');
    EmitClose(true);
  } finally {
    submitting.value = false;
  }
};

const ClickConfirm = async () => {
  if (!isApprove.value) {
    const valid = await formRef.value?.validate().catch(() => false);
    if (!valid) return;
  }
  await ApproveFlow();
};
</script>

<template lang="pug">
.OpenDialogMerchantApprove
  .OpenDialogMerchantApprove__mask(v-motion-fade)
  .OpenDialogMerchantApprove__content(v-motion-roll-bottom)
    .OpenDialogMerchantApprove__header
      span.OpenDialogMerchantApprove__title {{ title }}
      button.OpenDialogMerchantApprove__close(
        type="button"
        :disabled="submitting"
        @click="EmitClose(false)"
      ) ✕
    .OpenDialogMerchantApprove__body
      p.OpenDialogMerchantApprove__desc
        | 商家：
        strong {{ props.params.merchantName }}
      template(v-if="isApprove")
        p.OpenDialogMerchantApprove__hint 通過後商家成員即可登入；確定要通過審核嗎？
      template(v-else)
        ElForm(
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
        )
          ElFormItem(label="拒絕理由（選填，最多 200 字）" prop="reason")
            ElInput(
              v-model="form.reason"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="例如：登記資料不全"
            )
    .OpenDialogMerchantApprove__footer
      ElButton(
        :disabled="submitting"
        @click="EmitClose(false)"
      ) 取消
      ElButton(
        :type="confirmType"
        :loading="submitting"
        @click="ClickConfirm"
      ) {{ confirmText }}
</template>

<style lang="scss" scoped>
.OpenDialogMerchantApprove {
  @include fixed("fill");
  @include center;
}

.OpenDialogMerchantApprove__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogMerchantApprove__content {
  position: relative;
  z-index: 1;
  width: min(420px, calc(100vw - 32px));
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
}

.OpenDialogMerchantApprove__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogMerchantApprove__title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.OpenDialogMerchantApprove__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogMerchantApprove__close:hover {
  color: #f56c6c;
}

.OpenDialogMerchantApprove__body {
  padding: 20px;
}

.OpenDialogMerchantApprove__desc {
  margin: 0 0 12px 0;
  color: #606266;
  font-size: 14px;
}

.OpenDialogMerchantApprove__hint {
  margin: 0;
  color: #909399;
  font-size: 13px;
}

.OpenDialogMerchantApprove__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
