<script setup lang="ts">
// OpenDialogServiceEdit — 服務新增 / 編輯
// bookingMode 切換時，capacityPerSlot / resourceIds 等欄位動態顯示
import type { FormInstance, FormRules } from 'element-plus';

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
  resourceIds: initial?.resourceIds ?? []
});

const showDurationFields = computed(() => form.bookingMode !== 'QUEUE');
const showCapacity = computed(() => form.bookingMode === 'TIME_CAPACITY');
const showResource = computed(() => form.bookingMode === 'RESOURCE');

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
  if (form.bookingMode === 'QUEUE') {
    return base;
  }
  const extra: Record<string, unknown> = {
    durationMinutes: Number(form.durationMinutes),
    slotIntervalMinutes: Number(form.slotIntervalMinutes)
  };
  if (form.bookingMode === 'TIME_CAPACITY') {
    extra.capacityPerSlot = Number(form.capacityPerSlot);
  }
  if (form.bookingMode === 'RESOURCE') {
    extra.resourceIds = [...form.resourceIds];
  }
  if (typeof form.priceCents === 'number' && form.priceCents > 0) {
    extra.priceCents = form.priceCents;
  }
  return { ...base, ...extra };
};

const SaveFlow = async () => {
  if (form.bookingMode === 'RESOURCE' && form.resourceIds.length === 0) {
    ElMessage.error('RESOURCE 模式需綁定至少一個資源');
    return;
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
            ElOption(label="TIME_SLOT 固定時段" value="TIME_SLOT")
            ElOption(label="TIME_CAPACITY 時段+人數" value="TIME_CAPACITY")
            ElOption(label="RESOURCE 指定資源" value="RESOURCE")
            ElOption(label="QUEUE 號碼牌排隊" value="QUEUE")
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
        ElFormItem(v-if="showCapacity" label="每時段容量")
          ElInput(
            v-model="form.capacityPerSlot"
            type="number"
            inputmode="numeric"
            maxlength="3"
            min="1"
            max="999"
          )
        ElFormItem(v-if="showResource" label="綁定資源")
          ElCheckboxGroup(v-model="form.resourceIds")
            ElCheckbox(
              v-for="r in resourceOptions"
              :key="r.id"
              :value="r.id"
              :label="r.id"
            ) {{ r.name }}
          p.OpenDialogServiceEdit__hint(v-if="resourceOptions.length === 0")
            | 請先到「資源」頁建立至少一個資源
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

.OpenDialogServiceEdit__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px 20px;
  border-top: 1px solid #ebeef5;
}
</style>
