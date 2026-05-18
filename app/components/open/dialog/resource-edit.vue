<script setup lang="ts">
// OpenDialogResourceEdit — 資源新增 / 編輯
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogResourceEditParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const isCreate = computed(() => props.params.mode === 'create');
const title = computed(() => isCreate.value ? '新增資源' : '編輯資源');

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const initial = props.params.resource;
const form = reactive({
  name: initial?.name ?? '',
  description: initial?.description ?? '',
  isActive: initial?.isActive ?? true,
  displayOrder: initial?.displayOrder ?? 0
});

const rules: FormRules = {
  name: [
    { required: true, message: '請輸入資源名稱', trigger: 'blur' },
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
  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    isActive: form.isActive,
    displayOrder: Number(form.displayOrder) || 0
  };
  submitting.value = true;
  try {
    const res = isCreate.value
      ? await $api.CreateResource(payload)
      : await $api.UpdateResource({ id: initial!.id, ...payload });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '操作失敗');
      return;
    }
    ElMessage.success(isCreate.value ? '已新增資源' : '已更新資源');
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
.OpenDialogResourceEdit
  .OpenDialogResourceEdit__mask(v-motion-fade)
  .OpenDialogResourceEdit__content(v-motion-roll-bottom)
    .OpenDialogResourceEdit__header
      span.OpenDialogResourceEdit__title {{ title }}
      button.OpenDialogResourceEdit__close(
        type="button"
        :disabled="submitting"
        @click="EmitClose(false)"
      ) ✕
    .OpenDialogResourceEdit__body
      ElForm(
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="ClickSubmit"
      )
        ElFormItem(label="資源名稱" prop="name")
          ElInput(v-model="form.name" maxlength="60" placeholder="例如：王醫師、A 包廂")
        ElFormItem(label="描述")
          ElInput(
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
          )
        ElFormItem(label="顯示順序")
          ElInput(
            v-model="form.displayOrder"
            type="number"
            inputmode="numeric"
            maxlength="4"
            min="0"
          )
        ElFormItem(label="啟用")
          ElSwitch(v-model="form.isActive")
    .OpenDialogResourceEdit__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") 取消
      ElButton(
        type="primary"
        :loading="submitting"
        @click="ClickSubmit"
      ) {{ isCreate ? '建立' : '儲存' }}
</template>

<style lang="scss" scoped>
.OpenDialogResourceEdit {
  @include fixed("fill");
  @include center;
}

.OpenDialogResourceEdit__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogResourceEdit__content {
  position: relative;
  z-index: 1;
  width: min(440px, calc(100vw - 32px));
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
}

.OpenDialogResourceEdit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogResourceEdit__title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.OpenDialogResourceEdit__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogResourceEdit__close:hover {
  color: #f56c6c;
}

.OpenDialogResourceEdit__body {
  padding: 20px;
}

.OpenDialogResourceEdit__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
