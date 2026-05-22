<script setup lang="ts">
// OpenDialogProviderEdit — 服務人員新增 / 編輯
import type { FormInstance, FormRules } from 'element-plus';
import { resolveProviderLabel } from '~shared/i18n/provider-label';

type Props = {
  params: DialogProviderEditParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const { t, locale } = useI18n();
const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);

const isCreate = computed(() => props.params.mode === 'create');
const initial = props.params.provider;

// 動態稱呼：商家自訂 label fallback i18n 預設
const merchant = ref<SelfMerchantFull | null>(null);
const resolveLocale = (): 'zh' | 'en' | 'ja' => {
  const l = locale.value;
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('ja')) return 'ja';
  return 'zh';
};
const providerLabel = computed(() => {
  if (!merchant.value) return resolveLocale() === 'zh' ? '服務人員' : resolveLocale() === 'en' ? 'Provider' : 'スタッフ';
  return resolveProviderLabel(merchant.value, resolveLocale());
});

const title = computed(() =>
  isCreate.value
    ? t('admin.dialog.providerEditCreate', { label: providerLabel.value })
    : t('admin.dialog.providerEditEdit', { label: providerLabel.value })
);

const form = reactive({
  name: initial?.name ?? '',
  title: initial?.title ?? '',
  bio: initial?.bio ?? '',
  avatarUrl: initial?.avatarUrl ?? '',
  isActive: initial?.isActive ?? true,
  displayOrder: initial?.displayOrder ?? 0
});

const rules: FormRules = {
  name: [
    { required: true, message: t('validation.nameRequired'), trigger: 'blur' },
    { max: 60, message: t('validation.maxLength', { n: 60 }), trigger: 'blur' }
  ]
};

const ApiLoadMerchant = async () => {
  const res = await $api.GetSelfMerchant();
  if (res.status.code === $enum.apiStatus.success) {
    merchant.value = res.data.merchant;
  }
};

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const BuildPayload = () => ({
  name: form.name.trim(),
  title: form.title.trim() || null,
  bio: form.bio.trim() || null,
  avatarUrl: form.avatarUrl.trim() || null,
  isActive: form.isActive,
  displayOrder: Number(form.displayOrder) || 0
});

const SaveFlow = async () => {
  const payload = BuildPayload();
  submitting.value = true;
  try {
    const res = isCreate.value
      ? await $api.CreateProvider(payload as CreateProviderParams)
      : await $api.UpdateProvider({ id: initial!.id, ...payload });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || t('common.operationFailed'));
      return;
    }
    ElMessage.success(isCreate.value ? t('common.createSuccess') : t('common.updateSuccess'));

    // 啟用精靈：剛建立第一位後引導去排班頁
    if (isCreate.value && props.params.onCreatedGotoSchedule) {
      EmitClose(true);
      ElMessageBox.confirm(
        t('admin.dialog.providerCreatedBody', { label: providerLabel.value }),
        t('admin.dialog.providerCreatedTitle', { label: providerLabel.value }),
        {
          confirmButtonText: t('admin.dialog.providerCreatedGoSchedule'),
          cancelButtonText: t('common.cancel'),
          type: 'success'
        }
      ).then(() => {
        navigateTo('/admin/schedule?tab=weekly');
      }).catch(() => {
        // 使用者點取消，留在 providers 頁
      });
      return;
    }

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

onMounted(() => {
  ApiLoadMerchant();
});
</script>

<template lang="pug">
.OpenDialogProviderEdit
  .OpenDialogProviderEdit__mask(v-motion-fade)
  .OpenDialogProviderEdit__content(v-motion-roll-bottom)
    .OpenDialogProviderEdit__header
      span.OpenDialogProviderEdit__title {{ title }}
      button.OpenDialogProviderEdit__close(
        type="button"
        :disabled="submitting"
        @click="EmitClose(false)"
      ) ✕
    .OpenDialogProviderEdit__body
      ElForm(
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="ClickSubmit"
      )
        ElFormItem(:label="$t('provider.fields.avatar')")
          BizImageUploader(
            v-model="form.avatarUrl"
            kind="provider-avatar"
            width="120px"
            height="120px"
          )
        ElFormItem(:label="$t('provider.fields.name')" prop="name")
          ElInput(
            v-model="form.name"
            maxlength="60"
            :placeholder="$t('provider.placeholders.name')"
          )
        ElFormItem(:label="$t('provider.fields.title')")
          ElInput(
            v-model="form.title"
            maxlength="60"
            :placeholder="$t('provider.placeholders.title')"
          )
        ElFormItem(:label="$t('provider.fields.bio')")
          ElInput(
            v-model="form.bio"
            type="textarea"
            :rows="4"
            maxlength="2000"
            show-word-limit
            :placeholder="$t('provider.placeholders.bio')"
          )
        ElFormItem(:label="$t('provider.fields.displayOrder')")
          ElInput(
            v-model="form.displayOrder"
            type="number"
            inputmode="numeric"
            maxlength="4"
            min="0"
          )
        ElFormItem(:label="$t('provider.fields.isActive')")
          ElSwitch(v-model="form.isActive")
    .OpenDialogProviderEdit__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") {{ $t('common.cancel') }}
      ElButton(
        type="primary"
        :loading="submitting"
        @click="ClickSubmit"
      ) {{ isCreate ? $t('common.create') : $t('common.save') }}
</template>

<style lang="scss" scoped>
.OpenDialogProviderEdit {
  @include fixed("fill");
  @include center;
}

.OpenDialogProviderEdit__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogProviderEdit__content {
  position: relative;
  z-index: 1;
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
}

.OpenDialogProviderEdit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogProviderEdit__title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.OpenDialogProviderEdit__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogProviderEdit__close:hover {
  color: #f56c6c;
}

.OpenDialogProviderEdit__body {
  padding: 20px;
  overflow-y: auto;
}

.OpenDialogProviderEdit__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
