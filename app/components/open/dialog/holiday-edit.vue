<script setup lang="ts">
// OpenDialogHolidayEdit — 休假日新增
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogHolidayEditParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const form = reactive({
  date: '',
  name: ''
});

const rules: FormRules = {
  date: [{ required: true, message: '請選擇日期', trigger: 'change' }],
  name: [
    { required: true, message: '請輸入名稱', trigger: 'blur' },
    { max: 60, message: '名稱請在 60 字以內', trigger: 'blur' }
  ]
};

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const SaveFlow = async () => {
  submitting.value = true;
  try {
    const res = await $api.CreateHoliday({ date: form.date, name: form.name.trim() });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '操作失敗');
      return;
    }
    ElMessage.success('已新增休假');
    EmitClose(true);
  } finally {
    submitting.value = false;
  }
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  await SaveFlow();
};
</script>

<template lang="pug">
.OpenDialogHolidayEdit
  .OpenDialogHolidayEdit__mask(v-motion-fade)
  .OpenDialogHolidayEdit__content(v-motion-roll-bottom)
    .OpenDialogHolidayEdit__header
      span.OpenDialogHolidayEdit__title 新增休假日
      button.OpenDialogHolidayEdit__close(
        type="button"
        :disabled="submitting"
        @click="EmitClose(false)"
      ) ✕
    .OpenDialogHolidayEdit__body
      ElForm(
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="ClickSubmit"
      )
        ElFormItem(label="日期" prop="date")
          ElDatePicker(
            v-model="form.date"
            value-format="YYYY-MM-DD"
            type="date"
            placeholder="選擇日期"
            style="width: 100%;"
          )
        ElFormItem(label="名稱" prop="name")
          ElInput(
            v-model="form.name"
            maxlength="60"
            placeholder="例如：春節、員工旅遊"
          )
    .OpenDialogHolidayEdit__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") 取消
      ElButton(
        type="primary"
        :loading="submitting"
        @click="ClickSubmit"
      ) 加入
</template>

<style lang="scss" scoped>
.OpenDialogHolidayEdit {
  @include fixed("fill");
  @include center;
}

.OpenDialogHolidayEdit__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogHolidayEdit__content {
  position: relative;
  z-index: 1;
  width: min(360px, calc(100vw - 32px));
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
}

.OpenDialogHolidayEdit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogHolidayEdit__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogHolidayEdit__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogHolidayEdit__body {
  padding: 20px;
}

.OpenDialogHolidayEdit__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
