<script setup lang="ts">
// OpenDialogStaffEdit — 商家成員新增 / 編輯（OWNER 操作）
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogStaffEditParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const isCreate = computed(() => props.params.mode === 'create');
const title = computed(() => isCreate.value ? '新增成員' : '編輯成員');

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const form = reactive({
  email: props.params.user?.email ?? '',
  name: props.params.user?.name ?? '',
  password: '',
  role: (props.params.user?.role ?? 'STAFF') as 'OWNER' | 'STAFF'
});

const PasswordValidator = (
  _rule: unknown,
  value: string,
  callback: (err?: Error) => void
) => {
  if (!value) {
    if (isCreate.value) return callback(new Error('請輸入密碼'));
    return callback();
  }
  if (value.length < 8) return callback(new Error('密碼至少 8 碼'));
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return callback(new Error('密碼須含字母與數字'));
  }
  callback();
};

const rules: FormRules = {
  email: [
    { required: true, message: '請輸入 Email', trigger: 'blur' },
    { type: 'email', message: 'Email 格式錯誤', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '請輸入姓名', trigger: 'blur' },
    { max: 40, message: '姓名請在 40 字以內', trigger: 'blur' }
  ],
  password: [{ validator: PasswordValidator, trigger: 'blur' }],
  role: [{ required: true, message: '請選擇角色', trigger: 'change' }]
};

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const ApiSubmit = async () => {
  if (isCreate.value) {
    return $api.CreateStaff({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      name: form.name.trim(),
      role: form.role
    });
  }
  return $api.UpdateStaff({
    id: props.params.user!.id,
    name: form.name.trim(),
    password: form.password || undefined,
    role: form.role
  });
};

const SaveFlow = async () => {
  submitting.value = true;
  try {
    const res = await ApiSubmit();
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '操作失敗');
      return;
    }
    ElMessage.success(isCreate.value ? '已新增成員' : '已更新成員');
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
.OpenDialogStaffEdit
  .OpenDialogStaffEdit__mask(v-motion-fade)
  .OpenDialogStaffEdit__content(v-motion-roll-bottom)
    .OpenDialogStaffEdit__header
      span.OpenDialogStaffEdit__title {{ title }}
      button.OpenDialogStaffEdit__close(
        type="button"
        :disabled="submitting"
        @click="EmitClose(false)"
      ) ✕
    .OpenDialogStaffEdit__body
      ElForm(
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="ClickSubmit"
      )
        ElFormItem(label="Email" prop="email")
          ElInput(
            v-model="form.email"
            type="email"
            maxlength="120"
            :disabled="!isCreate"
          )
        ElFormItem(label="姓名" prop="name")
          ElInput(v-model="form.name" maxlength="40")
        ElFormItem(
          :label="isCreate ? '密碼' : '新密碼（留空表示不變）'"
          prop="password"
        )
          ElInput(
            v-model="form.password"
            type="password"
            maxlength="64"
            show-password
            :placeholder="isCreate ? '至少 8 碼含字母與數字' : '不修改請留空'"
          )
        ElFormItem(label="角色" prop="role")
          ElSelect(v-model="form.role" value-on-clear="")
            ElOption(label="OWNER 擁有者" value="OWNER")
            ElOption(label="STAFF 員工" value="STAFF")
    .OpenDialogStaffEdit__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") 取消
      ElButton(
        type="primary"
        :loading="submitting"
        @click="ClickSubmit"
      ) {{ isCreate ? '建立' : '儲存' }}
</template>

<style lang="scss" scoped>
.OpenDialogStaffEdit {
  @include fixed("fill");
  @include center;
}

.OpenDialogStaffEdit__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogStaffEdit__content {
  position: relative;
  z-index: 1;
  width: min(440px, calc(100vw - 32px));
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
}

.OpenDialogStaffEdit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogStaffEdit__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogStaffEdit__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogStaffEdit__body {
  padding: 20px;
}

.OpenDialogStaffEdit__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
