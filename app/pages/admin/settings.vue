<script setup lang="ts">
// PageAdminSettings — 商家資訊、外觀（logo / cover）、取消政策
// OWNER-only：STAFF 訪問時顯示無權限
import type { FormInstance, FormRules } from 'element-plus';

definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const storeSelf = StoreSelf();
const isOwner = computed(() => storeSelf.role === 'OWNER');

const formRef = ref<FormInstance | null>(null);
const merchant = ref<SelfMerchantFull | null>(null);
const loading = ref(true);
const saving = ref(false);

const form = reactive({
  name: '',
  slug: '',
  description: '',
  logoUrl: '',
  coverUrl: '',
  contactPhone: '',
  contactEmail: '',
  timezone: 'Asia/Taipei',
  address: '',
  cancelMode: 'free' as 'free' | 'cutoff',
  cutoffHours: 2
});

const SLUG_PATTERN = /^[a-z0-9-]{3,50}$/;

const rules: FormRules = {
  name: [
    { required: true, message: '請輸入商家名稱', trigger: 'blur' },
    { max: 60, message: '名稱請在 60 字以內', trigger: 'blur' }
  ],
  slug: [
    { required: true, message: '請輸入網址 slug', trigger: 'blur' },
    { pattern: SLUG_PATTERN, message: '3-50 字、僅小寫英數與 -', trigger: 'blur' }
  ],
  contactEmail: [
    { type: 'email', message: 'Email 格式錯誤', trigger: 'blur' }
  ]
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetSelfMerchant();
    if (res.status.code !== $enum.apiStatus.success) return;
    const m = res.data.merchant;
    merchant.value = m;
    form.name = m.name;
    form.slug = m.slug;
    form.description = m.description || '';
    form.logoUrl = m.logoUrl || '';
    form.coverUrl = m.coverUrl || '';
    form.contactPhone = m.contactPhone || '';
    form.contactEmail = m.contactEmail || '';
    form.timezone = m.timezone || 'Asia/Taipei';
    form.address = m.address || '';
    const policy = m.cancelPolicy || { mode: 'free' };
    form.cancelMode = (policy.mode as 'free' | 'cutoff') ?? 'free';
    form.cutoffHours = (policy.hoursBeforeCannotCancel as number) ?? 2;
  } finally {
    loading.value = false;
  }
};

const SaveFlow = async () => {
  if (!merchant.value) return;
  saving.value = true;
  try {
    const cancelPolicy: CancelPolicy = form.cancelMode === 'free'
      ? { mode: 'free' }
      : { mode: 'cutoff', hoursBeforeCannotCancel: Number(form.cutoffHours) || 1 };
    const res = await $api.UpdateSelfMerchant({
      id: merchant.value.id,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      logoUrl: form.logoUrl,
      coverUrl: form.coverUrl,
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim(),
      timezone: form.timezone,
      address: form.address.trim(),
      cancelPolicy
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '儲存失敗');
      return;
    }
    ElMessage.success('已儲存');
    merchant.value = res.data.merchant;
  } finally {
    saving.value = false;
  }
};

const ClickSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  await SaveFlow();
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminSettings
  BizPageHeader(title="商家設定" subtitle="基本資訊、外觀與取消政策")
  .PageAdminSettings__noPermission(v-if="!isOwner")
    | 此頁僅限 OWNER 操作；目前帳號為 STAFF。
  template(v-else)
    ElForm(
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="PageAdminSettings__form"
    )
      .PageAdminSettings__section
        h2.PageAdminSettings__section-title 基本資訊
        ElFormItem(label="商家名稱" prop="name")
          ElInput(v-model="form.name" maxlength="60")
        ElFormItem(label="網址 slug" prop="slug")
          ElInput(
            v-model="form.slug"
            maxlength="50"
            placeholder="lowercase 英數與 -"
          )
          .PageAdminSettings__slug-hint 顧客連結：{{ '/m/' + (form.slug || 'your-slug') }}
        ElFormItem(label="描述")
          ElInput(
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
          )
        ElFormItem(label="聯絡電話")
          ElInput(v-model="form.contactPhone" maxlength="40")
        ElFormItem(label="聯絡 Email" prop="contactEmail")
          ElInput(v-model="form.contactEmail" maxlength="120")
        ElFormItem(label="時區")
          ElInput(v-model="form.timezone" maxlength="60")
        ElFormItem(label="地址")
          ElInput(v-model="form.address" maxlength="200")
      .PageAdminSettings__section
        h2.PageAdminSettings__section-title 外觀
        .PageAdminSettings__images
          .PageAdminSettings__image-col
            ElFormItem(label="Logo")
              BizImageUploader(
                v-model="form.logoUrl"
                kind="logo"
                width="160px"
                height="160px"
              )
          .PageAdminSettings__image-col
            ElFormItem(label="封面圖")
              BizImageUploader(
                v-model="form.coverUrl"
                kind="cover"
                width="320px"
                height="180px"
              )
      .PageAdminSettings__section
        h2.PageAdminSettings__section-title 取消政策
        ElFormItem(label="取消模式")
          ElRadioGroup(v-model="form.cancelMode")
            ElRadio(value="free") 顧客可隨時取消
            ElRadio(value="cutoff") 預約前 N 小時起不可取消
        ElFormItem(v-if="form.cancelMode === 'cutoff'" label="N 小時")
          ElInput(
            v-model="form.cutoffHours"
            type="number"
            inputmode="numeric"
            maxlength="3"
            min="1"
            max="168"
          )
      .PageAdminSettings__actions
        ElButton(
          type="primary"
          :loading="saving"
          @click="ClickSave"
        ) 儲存
</template>

<style lang="scss" scoped>
.PageAdminSettings {
  max-width: 800px;
}

.PageAdminSettings__noPermission {
  background-color: $white;
  padding: 24px;
  border-radius: 14px;
  border: 1px solid rgba(235, 139, 45, 0.25);
  color: $tertiary;
  font-size: 14px;
  text-align: center;
}

.PageAdminSettings__form {
  background-color: $white;
  padding: 24px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -10px rgba(31, 42, 68, 0.08);
}

.PageAdminSettings__section {
  margin-bottom: 28px;
}

.PageAdminSettings__section:last-of-type {
  margin-bottom: 16px;
}

.PageAdminSettings__section-title {
  margin: 0 0 14px 0;
  font-size: 15px;
  font-weight: 700;
  color: $primary;
  border-bottom: 1px solid rgba(53, 77, 123, 0.08);
  padding-bottom: 8px;
}

.PageAdminSettings__images {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.PageAdminSettings__slug-hint {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(69, 69, 69, 0.55);
}

.PageAdminSettings__actions {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(53, 77, 123, 0.08);
  padding-top: 14px;
}
</style>
