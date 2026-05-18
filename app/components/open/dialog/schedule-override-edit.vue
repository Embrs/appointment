<script setup lang="ts">
// OpenDialogScheduleOverrideEdit — 特定日期覆寫新增
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogScheduleOverrideEditParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const form = reactive({
  date: '',
  isClosed: true,
  startTime: '09:00',
  endTime: '18:00',
  note: ''
});

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const rules: FormRules = {
  date: [{ required: true, message: '請選擇日期', trigger: 'change' }]
};

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const SaveFlow = async () => {
  if (!form.isClosed) {
    if (!HHMM.test(form.startTime) || !HHMM.test(form.endTime)) {
      ElMessage.error('時間格式錯誤');
      return;
    }
    if (form.startTime >= form.endTime) {
      ElMessage.error('起始時間需早於結束時間');
      return;
    }
  }
  submitting.value = true;
  try {
    const payload: CreateScheduleOverrideParams = {
      scope: props.params.scope,
      resourceId: props.params.resourceId ?? null,
      date: form.date,
      isClosed: form.isClosed,
      note: form.note.trim() || undefined
    };
    if (!form.isClosed) {
      payload.startTime = form.startTime;
      payload.endTime = form.endTime;
    }
    const res = await $api.CreateScheduleOverride(payload);
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '操作失敗');
      return;
    }
    ElMessage.success('已儲存覆寫');
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
.OpenDialogScheduleOverrideEdit
  .OpenDialogScheduleOverrideEdit__mask(v-motion-fade)
  .OpenDialogScheduleOverrideEdit__content(v-motion-roll-bottom)
    .OpenDialogScheduleOverrideEdit__header
      span.OpenDialogScheduleOverrideEdit__title 特定日期覆寫
      button.OpenDialogScheduleOverrideEdit__close(
        type="button"
        :disabled="submitting"
        @click="EmitClose(false)"
      ) ✕
    .OpenDialogScheduleOverrideEdit__body
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
        ElFormItem(label="當日休息")
          ElSwitch(v-model="form.isClosed")
        template(v-if="!form.isClosed")
          ElFormItem(label="開放起始")
            ElInput(
              v-model="form.startTime"
              maxlength="5"
              placeholder="HH:mm"
            )
          ElFormItem(label="開放結束")
            ElInput(
              v-model="form.endTime"
              maxlength="5"
              placeholder="HH:mm"
            )
        ElFormItem(label="備註")
          ElInput(
            v-model="form.note"
            maxlength="200"
            show-word-limit
            type="textarea"
            :rows="2"
          )
    .OpenDialogScheduleOverrideEdit__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") 取消
      ElButton(
        type="primary"
        :loading="submitting"
        @click="ClickSubmit"
      ) 儲存
</template>

<style lang="scss" scoped>
.OpenDialogScheduleOverrideEdit {
  @include fixed("fill");
  @include center;
}

.OpenDialogScheduleOverrideEdit__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogScheduleOverrideEdit__content {
  position: relative;
  z-index: 1;
  width: min(420px, calc(100vw - 32px));
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
}

.OpenDialogScheduleOverrideEdit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogScheduleOverrideEdit__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogScheduleOverrideEdit__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogScheduleOverrideEdit__body {
  padding: 20px;
}

.OpenDialogScheduleOverrideEdit__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
