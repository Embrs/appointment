<script setup lang="ts">
// OpenDialogScheduleRuleEdit — 新增單筆每週時段段落
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogScheduleRuleEditParams;
  resolve: (value: { done: boolean; rule?: { weekday: number; startTime: string; endTime: string } }) => void;
  level: number;
};
const props = defineProps<Props>();

const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

const formRef = ref<FormInstance | null>(null);
const form = reactive({
  weekday: props.params.weekday ?? 1,
  startTime: '09:00',
  endTime: '12:00'
});

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const rules: FormRules = {
  startTime: [
    { required: true, message: '請輸入起始時間', trigger: 'blur' },
    { pattern: HHMM, message: 'HH:mm 格式', trigger: 'blur' }
  ],
  endTime: [
    { required: true, message: '請輸入結束時間', trigger: 'blur' },
    { pattern: HHMM, message: 'HH:mm 格式', trigger: 'blur' }
  ]
};

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false, rule?: { weekday: number; startTime: string; endTime: string }) => {
  props.resolve({ done, rule });
  emit('on-close');
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (form.startTime >= form.endTime) {
    ElMessage.error('起始時間需早於結束時間');
    return;
  }
  EmitClose(true, {
    weekday: Number(form.weekday),
    startTime: form.startTime,
    endTime: form.endTime
  });
};
</script>

<template lang="pug">
.OpenDialogScheduleRuleEdit
  .OpenDialogScheduleRuleEdit__mask(v-motion-fade)
  .OpenDialogScheduleRuleEdit__content(v-motion-roll-bottom)
    .OpenDialogScheduleRuleEdit__header
      span.OpenDialogScheduleRuleEdit__title 新增時段
      button.OpenDialogScheduleRuleEdit__close(
        type="button"
        @click="EmitClose(false)"
      ) ✕
    .OpenDialogScheduleRuleEdit__body
      ElForm(
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="ClickSubmit"
      )
        ElFormItem(label="星期")
          ElSelect(v-model="form.weekday" value-on-clear="")
            ElOption(
              v-for="(label, idx) in WEEKDAY_LABELS"
              :key="idx"
              :label="label"
              :value="idx"
            )
        ElFormItem(label="起始時間" prop="startTime")
          ElInput(
            v-model="form.startTime"
            placeholder="HH:mm"
            maxlength="5"
            inputmode="numeric"
          )
        ElFormItem(label="結束時間" prop="endTime")
          ElInput(
            v-model="form.endTime"
            placeholder="HH:mm"
            maxlength="5"
            inputmode="numeric"
          )
    .OpenDialogScheduleRuleEdit__footer
      ElButton(@click="EmitClose(false)") 取消
      ElButton(type="primary" @click="ClickSubmit") 加入
</template>

<style lang="scss" scoped>
.OpenDialogScheduleRuleEdit {
  @include fixed("fill");
  @include center;
}

.OpenDialogScheduleRuleEdit__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogScheduleRuleEdit__content {
  position: relative;
  z-index: 1;
  width: min(360px, calc(100vw - 32px));
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
}

.OpenDialogScheduleRuleEdit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogScheduleRuleEdit__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogScheduleRuleEdit__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogScheduleRuleEdit__body {
  padding: 20px;
}

.OpenDialogScheduleRuleEdit__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
