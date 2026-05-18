<script setup lang="ts">
// OpenDialogCustomerForm — 顧客三元組表單（用於預約最後一步、查詢頁、my-bookings 補三元組）
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogCustomerFormParams;
  resolve: (value: { done: boolean; triplet?: { lastName: string; title: CustomerTitleType; phone: string } }) => void;
  level: number;
};
const props = defineProps<Props>();

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);

const initial = props.params.initial;
const form = reactive({
  lastName: initial?.lastName ?? '',
  title: (initial?.title ?? 'MR') as CustomerTitleType,
  phone: initial?.phone ?? ''
});

const rules: FormRules = {
  lastName: [
    { required: true, message: '請填寫姓氏', trigger: 'blur' },
    { max: 20, message: '姓氏請在 20 字以內', trigger: 'blur' }
  ],
  title: [{ required: true, message: '請選擇稱謂', trigger: 'change' }],
  phone: [
    { required: true, message: '請填寫手機號碼', trigger: 'blur' },
    { pattern: /^[0-9+\s-]{6,20}$/, message: '手機號碼格式錯誤', trigger: 'blur' }
  ]
};

const titleOptions = [
  { value: 'MR' as const, label: '先生' },
  { value: 'MRS' as const, label: '女士' },
  { value: 'MISS' as const, label: '小姐' },
  { value: 'MX' as const, label: '客人' }
];

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const triplet = {
      lastName: form.lastName.trim(),
      title: form.title,
      phone: form.phone.replace(/[\s-]/g, '')
    };
    props.resolve({ done: true, triplet });
    emit('on-close');
  } finally {
    submitting.value = false;
  }
};
</script>

<template lang="pug">
.OpenDialogCustomerForm
  .OpenDialogCustomerForm__mask(v-motion-fade)
  .OpenDialogCustomerForm__content(v-motion-roll-bottom)
    .OpenDialogCustomerForm__header
      span.OpenDialogCustomerForm__title {{ params.title || '填寫聯絡資訊' }}
      button.OpenDialogCustomerForm__close(type="button" :disabled="submitting" @click="EmitClose(false)") ✕
    .OpenDialogCustomerForm__body
      ElForm(ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="ClickSubmit")
        ElFormItem(label="姓氏" prop="lastName")
          ElInput(v-model="form.lastName" maxlength="20" placeholder="例：王")
        ElFormItem(label="稱謂" prop="title")
          ElSelect(v-model="form.title" placeholder="選擇稱謂" style="width: 100%;")
            ElOption(v-for="opt in titleOptions" :key="opt.value" :label="opt.label" :value="opt.value")
        ElFormItem(label="手機號碼" prop="phone")
          ElInput(
            v-model="form.phone"
            maxlength="20"
            inputmode="numeric"
            placeholder="例：0912345678"
          )
    .OpenDialogCustomerForm__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") 取消
      ElButton(type="primary" :loading="submitting" @click="ClickSubmit") {{ params.submitLabel || '確認' }}
</template>

<style lang="scss" scoped>
.OpenDialogCustomerForm {
  @include fixed("fill");
  @include center;
}

.OpenDialogCustomerForm__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogCustomerForm__content {
  position: relative;
  z-index: 1;
  width: min(400px, calc(100vw - 32px));
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.OpenDialogCustomerForm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogCustomerForm__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogCustomerForm__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogCustomerForm__body {
  padding: 20px;
}

.OpenDialogCustomerForm__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid #ebeef5;
}
</style>
