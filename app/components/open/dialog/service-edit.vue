<script setup lang="ts">
// OpenDialogServiceEdit — 服務新增 / 編輯
// bookingMode 切換時，capacityPerSlot / resourceIds 等欄位動態顯示
// 商家啟用 providerModeEnabled 時額外顯示「需指定服務人員」開關 + Provider 多選
import type { FormInstance, FormRules } from 'element-plus';
import { resolveProviderLabel } from '~shared/i18n/provider-label';

type Props = {
  params: DialogServiceEditParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const isCreate = computed(() => props.params.mode === 'create');
const title = computed(() => isCreate.value ? '新增服務' : '編輯服務');

const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const resourceOptions = ref<ResourceItem[]>([]);
const providerOptions = ref<ProviderItem[]>([]);
const merchant = ref<SelfMerchantFull | null>(null);

const initial = props.params.service;
const form = reactive({
  name: initial?.name ?? '',
  description: initial?.description ?? '',
  bookingMode: (initial?.bookingMode ?? 'TIME_SLOT') as BookingModeType,
  durationMinutes: initial?.durationMinutes ?? 30,
  slotIntervalMinutes: initial?.slotIntervalMinutes ?? 30,
  capacityPerSlot: initial?.capacityPerSlot ?? 1,
  priceCents: typeof initial?.priceCents === 'number' ? initial.priceCents : 0,
  isActive: initial?.isActive ?? true,
  displayOrder: initial?.displayOrder ?? 0,
  resourceIds: initial?.resourceIds ?? [],
  providerIds: initial?.providerIds ?? [],
  requiresProvider: initial?.requiresProvider ?? false,
  /** QUEUE 服務的平均服務時長（分鐘）；空字串表示留空 → 後端 null（fallback durationMinutes） */
  avgServiceMinutes: typeof initial?.avgServiceMinutes === 'number' ? String(initial.avgServiceMinutes) : ''
});

const { t, locale } = useI18n();

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
const providerModeEnabled = computed(() => merchant.value?.providerModeEnabled === true);
const showProviderFields = computed(() => providerModeEnabled.value && form.bookingMode !== 'QUEUE');

const showDurationFields = computed(() => form.bookingMode !== 'QUEUE');
const showAvgServiceMinutes = computed(() => form.bookingMode === 'QUEUE');
const showCapacity = computed(() => form.bookingMode === 'TIME_CAPACITY');
const showResource = computed(
  () =>
    form.bookingMode === 'RESOURCE' ||
    form.bookingMode === 'RESOURCE_OPTIONAL' ||
    form.bookingMode === 'QUEUE'
);
const resourceLabel = computed(() => {
  if (form.bookingMode === 'QUEUE') return t('service.edit.queueResourcesLabel');
  return t('admin.services.resourcesLabel');
});
const resourceHint = computed(() => {
  if (form.bookingMode === 'RESOURCE') return t('admin.bookingMode.helperResource');
  if (form.bookingMode === 'RESOURCE_OPTIONAL') return t('admin.bookingMode.helperResourceOptional');
  if (form.bookingMode === 'QUEUE') return t('service.edit.queueResourcesHint');
  return '';
});

const rules: FormRules = {
  name: [
    { required: true, message: '請輸入服務名稱', trigger: 'blur' },
    { max: 60, message: '名稱請在 60 字以內', trigger: 'blur' }
  ],
  bookingMode: [{ required: true, message: '請選擇預約模式', trigger: 'change' }]
};

const ApiLoadResources = async () => {
  const res = await $api.GetResourceList();
  if (res.status.code !== $enum.apiStatus.success) return;
  resourceOptions.value = res.data.items.filter((r) => r.isActive);
};

const ApiLoadProviders = async () => {
  const res = await $api.GetProviderList();
  if (res.status.code !== $enum.apiStatus.success) return;
  providerOptions.value = res.data.items.filter((p) => p.isActive);
};

const ApiLoadMerchant = async () => {
  const res = await $api.GetSelfMerchant();
  if (res.status.code === $enum.apiStatus.success) merchant.value = res.data.merchant;
};

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const BuildPayload = () => {
  const base = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    bookingMode: form.bookingMode,
    isActive: form.isActive,
    displayOrder: Number(form.displayOrder) || 0
  };
  // Provider 欄位（非 QUEUE 且商家啟用 Provider 制時帶入）
  const providerExtra: Record<string, unknown> = showProviderFields.value
    ? {
        requiresProvider: form.requiresProvider,
        providerIds: [...form.providerIds]
      }
    : {};
  if (form.bookingMode === 'QUEUE') {
    // 空字串視為 null（沿用 durationMinutes）；數字字串轉為整數
    const trimmed = String(form.avgServiceMinutes).trim();
    const avgServiceMinutes = trimmed === '' ? null : Number(trimmed);
    return { ...base, avgServiceMinutes, resourceIds: [...form.resourceIds] };
  }
  const extra: Record<string, unknown> = {
    durationMinutes: Number(form.durationMinutes),
    slotIntervalMinutes: Number(form.slotIntervalMinutes)
  };
  if (form.bookingMode === 'TIME_CAPACITY') {
    extra.capacityPerSlot = Number(form.capacityPerSlot);
  }
  if (
    form.bookingMode === 'RESOURCE' ||
    form.bookingMode === 'RESOURCE_OPTIONAL'
  ) {
    extra.resourceIds = [...form.resourceIds];
  }
  if (typeof form.priceCents === 'number' && form.priceCents > 0) {
    extra.priceCents = form.priceCents;
  }
  return { ...base, ...extra, ...providerExtra };
};

const SaveFlow = async () => {
  const requiresResource =
    form.bookingMode === 'RESOURCE' || form.bookingMode === 'RESOURCE_OPTIONAL';
  if (requiresResource && form.resourceIds.length === 0) {
    ElMessage.error('RESOURCE / RESOURCE_OPTIONAL 模式需綁定至少一個資源');
    return;
  }
  if (showProviderFields.value && form.requiresProvider && form.providerIds.length === 0) {
    ElMessage.error(t('service.edit.providersEmptyError', { label: providerLabel.value }));
    return;
  }

  // 切換 requiresProvider 時提示既有預約不受影響
  const requiresProviderChanged =
    !isCreate.value && initial && initial.requiresProvider !== form.requiresProvider;
  if (requiresProviderChanged) {
    try {
      await ElMessageBox.confirm(
        t('admin.dialog.requiresProviderToggleBody', { label: providerLabel.value }),
        t('admin.dialog.requiresProviderToggleTitle', { label: providerLabel.value }),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          type: 'warning'
        }
      );
    } catch {
      return;
    }
  }

  const payload = BuildPayload();
  submitting.value = true;
  try {
    const res = isCreate.value
      ? await $api.CreateService(payload as CreateServiceParams)
      : await $api.UpdateService({ id: initial!.id, ...payload });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '操作失敗');
      return;
    }
    ElMessage.success(isCreate.value ? '已新增服務' : '已更新服務');
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
  ApiLoadResources();
  ApiLoadMerchant();
  ApiLoadProviders();
});
</script>

<template lang="pug">
.OpenDialogServiceEdit
  .OpenDialogServiceEdit__mask(v-motion-fade)
  .OpenDialogServiceEdit__content(v-motion-roll-bottom)
    .OpenDialogServiceEdit__header
      span.OpenDialogServiceEdit__title {{ title }}
      button.OpenDialogServiceEdit__close(
        type="button"
        :disabled="submitting"
        @click="EmitClose(false)"
      ) ✕
    .OpenDialogServiceEdit__body
      ElForm(
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="ClickSubmit"
      )
        ElFormItem(label="服務名稱" prop="name")
          ElInput(v-model="form.name" maxlength="60" placeholder="例如：拔牙、團體課")
        ElFormItem(label="描述")
          ElInput(
            v-model="form.description"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
          )
        ElFormItem(label="預約模式" prop="bookingMode")
          ElSelect(
            v-model="form.bookingMode"
            value-on-clear=""
            placeholder="選擇預約模式"
          )
            ElOption(:label="t('admin.bookingMode.TIME_SLOT')" value="TIME_SLOT")
            ElOption(:label="t('admin.bookingMode.TIME_CAPACITY')" value="TIME_CAPACITY")
            ElOption(:label="t('admin.bookingMode.RESOURCE')" value="RESOURCE")
            ElOption(:label="t('admin.bookingMode.RESOURCE_OPTIONAL')" value="RESOURCE_OPTIONAL")
            ElOption(:label="t('admin.bookingMode.QUEUE')" value="QUEUE")
        template(v-if="showDurationFields")
          ElFormItem(label="服務時長（分鐘）")
            ElInput(
              v-model="form.durationMinutes"
              type="number"
              inputmode="numeric"
              maxlength="4"
              min="5"
              max="720"
            )
          ElFormItem(label="時段間隔（分鐘）")
            ElInput(
              v-model="form.slotIntervalMinutes"
              type="number"
              inputmode="numeric"
              maxlength="4"
              min="5"
              max="720"
            )
        ElFormItem(v-if="showAvgServiceMinutes" :label="$t('admin.services.avgServiceMinutes.label')")
          ElInput(
            v-model="form.avgServiceMinutes"
            type="number"
            inputmode="numeric"
            maxlength="4"
            min="0"
            :placeholder="$t('admin.services.avgServiceMinutes.placeholder')"
          )
          p.OpenDialogServiceEdit__hint--info {{ $t('admin.services.avgServiceMinutes.help') }}
        ElFormItem(v-if="showCapacity" label="每時段容量")
          ElInput(
            v-model="form.capacityPerSlot"
            type="number"
            inputmode="numeric"
            maxlength="3"
            min="1"
            max="999"
          )
        ElFormItem(v-if="showResource" :label="resourceLabel")
          ElCheckboxGroup(v-model="form.resourceIds")
            ElCheckbox(
              v-for="r in resourceOptions"
              :key="r.id"
              :value="r.id"
              :label="r.id"
            ) {{ r.name }}
          p.OpenDialogServiceEdit__hint(v-if="resourceOptions.length === 0")
            | 請先到「資源」頁建立至少一個資源
          p.OpenDialogServiceEdit__hint--info(v-else) {{ resourceHint }}
        template(v-if="showProviderFields")
          ElFormItem(:label="$t('service.edit.requiresProviderLabel', { label: providerLabel })")
            ElSwitch(v-model="form.requiresProvider")
            p.OpenDialogServiceEdit__hint--info {{ $t('service.edit.requiresProviderHint', { label: providerLabel }) }}
          ElFormItem(
            v-if="form.requiresProvider || form.providerIds.length > 0"
            :label="$t('service.edit.providersLabel', { label: providerLabel })"
          )
            ElCheckboxGroup(v-model="form.providerIds")
              ElCheckbox(
                v-for="p in providerOptions"
                :key="p.id"
                :value="p.id"
                :label="p.id"
              ) {{ p.name }}{{ p.title ? `（${p.title}）` : '' }}
            p.OpenDialogServiceEdit__hint(v-if="providerOptions.length === 0")
              | 請先到「服務人員」頁建立至少一位
            p.OpenDialogServiceEdit__hint--info(v-else) {{ $t('service.edit.providersHint', { label: providerLabel }) }}
        ElFormItem(label="價格（分；0 表示不顯示）")
          ElInput(
            v-model="form.priceCents"
            type="number"
            inputmode="numeric"
            maxlength="9"
            min="0"
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
    .OpenDialogServiceEdit__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") 取消
      ElButton(
        type="primary"
        :loading="submitting"
        @click="ClickSubmit"
      ) {{ isCreate ? '建立' : '儲存' }}
</template>

<style lang="scss" scoped>
.OpenDialogServiceEdit {
  @include fixed("fill");
  @include center;
}

.OpenDialogServiceEdit__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogServiceEdit__content {
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

.OpenDialogServiceEdit__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogServiceEdit__title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.OpenDialogServiceEdit__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogServiceEdit__close:hover {
  color: #f56c6c;
}

.OpenDialogServiceEdit__body {
  padding: 20px;
  overflow-y: auto;
}

.OpenDialogServiceEdit__hint {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #e6a23c;
}

.OpenDialogServiceEdit__hint--info {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #909399;
}

.OpenDialogServiceEdit__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
