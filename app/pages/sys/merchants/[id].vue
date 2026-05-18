<script setup lang="ts">
// PageSysMerchantsDetail — 平台後台：商家詳情 / 編輯 / 狀態切換
import type { FormInstance, FormRules } from 'element-plus';

definePageMeta({
  layout: 'back-desk',
  middleware: ['admin']
});

const route = useRoute();
const router = useRouter();
const useAsk = UseAsk();
const merchantId = computed(() => String(route.params.id ?? ''));

const loading = ref(true);
const saving = ref(false);
const merchant = ref<SysMerchantFull | null>(null);
const owner = ref<SysMerchantOwner | null>(null);

const formRef = ref<FormInstance | null>(null);
const form = reactive({
  name: '',
  slug: '',
  description: '',
  contactPhone: '',
  contactEmail: '',
  timezone: 'Asia/Taipei',
  address: ''
});

const rules: FormRules = {
  name: [
    { required: true, message: '請輸入商家名稱', trigger: 'blur' },
    { max: 60, message: '最多 60 字', trigger: 'blur' }
  ],
  slug: [
    { required: true, message: '請輸入 slug', trigger: 'blur' },
    { pattern: /^[a-z0-9-]{3,50}$/, message: '只允許小寫英數與短橫線，3-50 字', trigger: 'blur' }
  ],
  description: [{ max: 1000, message: '最多 1000 字', trigger: 'blur' }],
  contactPhone: [{ max: 40, message: '最多 40 字', trigger: 'blur' }],
  contactEmail: [{ type: 'email', message: 'Email 格式錯誤', trigger: 'blur' }],
  address: [{ max: 200, message: '最多 200 字', trigger: 'blur' }]
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.SysGetMerchantDetail({ id: merchantId.value });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '載入失敗');
      return;
    }
    merchant.value = res.data.merchant;
    owner.value = res.data.ownerUser;
    Object.assign(form, {
      name: merchant.value.name,
      slug: merchant.value.slug,
      description: merchant.value.description,
      contactPhone: merchant.value.contactPhone,
      contactEmail: merchant.value.contactEmail,
      timezone: merchant.value.timezone,
      address: merchant.value.address
    });
  } finally {
    loading.value = false;
  }
};

const SaveFlow = async () => {
  if (!merchant.value) return;
  saving.value = true;
  try {
    const res = await $api.SysUpdateMerchant({
      id: merchant.value.id,
      name: form.name,
      slug: form.slug,
      description: form.description,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
      timezone: form.timezone,
      address: form.address || undefined
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '儲存失敗');
      return;
    }
    ElMessage.success('已儲存');
    ApiLoad();
  } finally {
    saving.value = false;
  }
};

const ClickSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  await SaveFlow();
};

const ClickApprove = async () => {
  if (!merchant.value) return;
  const res = await $open.DialogMerchantApprove({
    mode: 'approve',
    merchantId: merchant.value.id,
    merchantName: merchant.value.name
  });
  if (res.done) ApiLoad();
};

const ClickReject = async () => {
  if (!merchant.value) return;
  const res = await $open.DialogMerchantApprove({
    mode: 'reject',
    merchantId: merchant.value.id,
    merchantName: merchant.value.name
  });
  if (res.done) ApiLoad();
};

const ClickSuspend = async () => {
  if (!merchant.value) return;
  const ok = await useAsk.Any(`確定要停用「${merchant.value.name}」嗎？`, '停用商家', '取消', '確認停用', 'warning');
  if (!ok) return;
  const res = await $api.SysSuspendMerchant({ id: merchant.value.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '操作失敗');
    return;
  }
  ElMessage.success('已停用');
  ApiLoad();
};

const ClickActivate = async () => {
  if (!merchant.value) return;
  const ok = await useAsk.Any(`確定要啟用「${merchant.value.name}」嗎？`, '啟用商家', '取消', '確認啟用', 'warning');
  if (!ok) return;
  const res = await $api.SysActivateMerchant({ id: merchant.value.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '操作失敗');
    return;
  }
  ElMessage.success('已啟用');
  ApiLoad();
};

const StatusLabel = (s: MerchantStatusType): string => {
  switch (s) {
    case 'PENDING': return '待審核';
    case 'ACTIVE': return '在線';
    case 'SUSPENDED': return '停用';
    case 'REJECTED': return '已拒絕';
    default: return s;
  }
};

const StatusTagType = (s: MerchantStatusType): 'warning' | 'success' | 'info' | 'danger' => {
  switch (s) {
    case 'PENDING': return 'warning';
    case 'ACTIVE': return 'success';
    case 'SUSPENDED': return 'info';
    case 'REJECTED': return 'danger';
    default: return 'info';
  }
};

const RejectReason = computed(() => {
  if (!merchant.value) return '';
  const policy = merchant.value.cancelPolicy;
  if (policy && typeof policy === 'object' && 'rejectReason' in policy) {
    const reason = (policy as { rejectReason?: unknown }).rejectReason;
    return typeof reason === 'string' ? reason : '';
  }
  return '';
});

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageSysMerchantsDetail(v-loading="loading")
  .PageSysMerchantsDetail__header
    ElButton(link @click="router.push('/sys/merchants')") ‹ 返回列表
    template(v-if="merchant")
      h1.PageSysMerchantsDetail__title {{ merchant.name }}
      ElTag(:type="StatusTagType(merchant.status)" size="small") {{ StatusLabel(merchant.status) }}
  template(v-if="merchant")
    .PageSysMerchantsDetail__actions
      template(v-if="merchant.status === 'PENDING'")
        ElButton(type="primary" @click="ClickApprove") 審核通過
        ElButton(type="danger" plain @click="ClickReject") 拒絕
      template(v-else-if="merchant.status === 'ACTIVE'")
        NuxtLink(:to="`/sys/impersonate/${merchant.id}`")
          ElButton(type="primary") 進入該商家後台
        ElButton(type="warning" plain @click="ClickSuspend") 停用
      template(v-else-if="merchant.status === 'SUSPENDED'")
        ElButton(type="success" plain @click="ClickActivate") 啟用
    .PageSysMerchantsDetail__section
      h2.PageSysMerchantsDetail__section-title OWNER 帳號
      ElDescriptions(:column="2" border)
        ElDescriptionsItem(label="姓名") {{ owner?.name || '—' }}
        ElDescriptionsItem(label="Email") {{ owner?.email || '—' }}
        ElDescriptionsItem(label="啟用中") {{ owner?.isActive ? '是' : '否' }}
        ElDescriptionsItem(label="角色") {{ owner?.role || '—' }}
    .PageSysMerchantsDetail__section(v-if="merchant.status === 'REJECTED' && RejectReason")
      h2.PageSysMerchantsDetail__section-title 拒絕理由
      p.PageSysMerchantsDetail__reject {{ RejectReason }}
    .PageSysMerchantsDetail__section
      h2.PageSysMerchantsDetail__section-title 商家基本資料
      ElForm(
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        label-position="top"
      )
        ElFormItem(label="商家名稱" prop="name")
          ElInput(v-model="form.name" maxlength="60")
        ElFormItem(label="網址 slug" prop="slug")
          ElInput(v-model="form.slug" maxlength="50")
        ElFormItem(label="描述" prop="description")
          ElInput(
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
          )
        ElFormItem(label="聯絡電話" prop="contactPhone")
          ElInput(v-model="form.contactPhone" maxlength="40" inputmode="numeric")
        ElFormItem(label="聯絡 Email" prop="contactEmail")
          ElInput(v-model="form.contactEmail" maxlength="120")
        ElFormItem(label="時區")
          ElInput(v-model="form.timezone" maxlength="60")
        ElFormItem(label="地址" prop="address")
          ElInput(v-model="form.address" maxlength="200")
        ElButton(
          type="primary"
          :loading="saving"
          @click="ClickSave"
        ) 儲存變更
</template>

<style lang="scss" scoped>
.PageSysMerchantsDetail {
  padding: 8px;
}

.PageSysMerchantsDetail__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.PageSysMerchantsDetail__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.PageSysMerchantsDetail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.PageSysMerchantsDetail__section {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}

.PageSysMerchantsDetail__section-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.PageSysMerchantsDetail__reject {
  margin: 0;
  padding: 8px 12px;
  background-color: #fef0f0;
  color: #f56c6c;
  border-radius: 4px;
  font-size: 14px;
}
</style>
