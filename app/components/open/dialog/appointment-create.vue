<script setup lang="ts">
// OpenDialogAppointmentCreate — 商家代客建立預約
// 步驟簡化版：選服務 → 選資源 → 選日期 → 選 slot → 填三元組 + note → 送出
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogAppointmentCreateParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const submitting = ref(false);
const services = ref<ServiceItem[]>([]);
const resources = ref<ResourceItem[]>([]);
const slots = ref<AvailabilitySlot[]>([]);
const timezone = ref('Asia/Taipei');
const loadingSlots = ref(false);

const form = reactive({
  serviceId: '',
  resourceId: '',
  date: $dayjs().format('YYYY-MM-DD'),
  startAt: '',
  lastName: '',
  title: 'MR' as CustomerTitleType,
  phone: '',
  note: ''
});

const selectedService = computed(() =>
  services.value.find((s) => s.id === form.serviceId) ?? null
);

const needResource = computed(() => selectedService.value?.bookingMode === 'RESOURCE');

const availableResources = computed(() => {
  if (!selectedService.value) return [];
  const ids = selectedService.value.resourceIds;
  return resources.value.filter((r) => ids.includes(r.id) && r.isActive);
});

const titleOptions = [
  { value: 'MR', label: '先生' },
  { value: 'MRS', label: '女士' },
  { value: 'MISS', label: '小姐' },
  { value: 'MX', label: '客人' }
] as const;

const formRef = ref<FormInstance | null>(null);
const rules: FormRules = {
  serviceId: [{ required: true, message: '請選擇服務', trigger: 'change' }],
  date: [{ required: true, message: '請選擇日期', trigger: 'change' }],
  startAt: [{ required: true, message: '請選擇時段', trigger: 'change' }],
  lastName: [{ required: true, message: '請填姓氏', trigger: 'blur' }],
  title: [{ required: true, message: '請選稱謂', trigger: 'change' }],
  phone: [
    { required: true, message: '請填手機', trigger: 'blur' },
    { pattern: /^[0-9+\s-]{6,20}$/, message: '手機格式錯誤', trigger: 'blur' }
  ]
};

const ApiLoadServices = async () => {
  const res = await $api.GetServiceList();
  if (res.status.code === $enum.apiStatus.success) {
    services.value = res.data.items.filter((s) => s.isActive && s.bookingMode !== 'QUEUE');
  }
};

const ApiLoadResources = async () => {
  const res = await $api.GetResourceList();
  if (res.status.code === $enum.apiStatus.success) {
    resources.value = res.data.items;
  }
};

const ApiLoadSlots = async () => {
  if (!selectedService.value) return;
  if (needResource.value && !form.resourceId) return;
  if (!form.date) return;
  loadingSlots.value = true;
  slots.value = [];
  form.startAt = '';
  try {
    const res = await $api.GetAvailability({
      slug: props.params.slug,
      serviceId: form.serviceId,
      resourceId: needResource.value ? form.resourceId : undefined,
      date: form.date
    });
    if (res.status.code === $enum.apiStatus.success) {
      slots.value = res.data.slots;
      timezone.value = res.data.timezone;
    }
  } finally {
    loadingSlots.value = false;
  }
};

watch(() => form.serviceId, () => {
  form.resourceId = '';
  form.startAt = '';
  slots.value = [];
  if (!needResource.value) ApiLoadSlots();
});

watch([() => form.resourceId, () => form.date], () => {
  ApiLoadSlots();
});

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const SaveFlow = async () => {
  submitting.value = true;
  try {
    const res = await $api.CreateAppointment({
      serviceId: form.serviceId,
      resourceId: needResource.value ? form.resourceId : undefined,
      startAt: form.startAt,
      customer: {
        lastName: form.lastName.trim(),
        title: form.title,
        phone: form.phone.replace(/[\s-]/g, '')
      },
      note: form.note.trim() || undefined
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '建立失敗');
      return;
    }
    ElMessage.success('已建立預約');
    EmitClose(true);
  } finally {
    submitting.value = false;
  }
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (needResource.value && !form.resourceId) {
    ElMessage.warning('請選擇資源');
    return;
  }
  await SaveFlow();
};

const fmtSlotTime = (iso: string) => $dayjs(new Date(iso)).tz(timezone.value).format('HH:mm');

onMounted(() => {
  ApiLoadServices();
  ApiLoadResources();
});
</script>

<template lang="pug">
.OpenDialogAppointmentCreate
  .OpenDialogAppointmentCreate__mask(v-motion-fade)
  .OpenDialogAppointmentCreate__content(v-motion-roll-bottom)
    .OpenDialogAppointmentCreate__header
      span.OpenDialogAppointmentCreate__title 代客建立預約
      button.OpenDialogAppointmentCreate__close(type="button" :disabled="submitting" @click="EmitClose(false)") ✕
    .OpenDialogAppointmentCreate__body
      ElForm(ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="ClickSubmit")
        ElFormItem(label="服務" prop="serviceId")
          ElSelect(
            v-model="form.serviceId"
            placeholder="選擇服務"
            clearable
            value-on-clear=""
            style="width: 100%;"
          )
            ElOption(v-for="s in services" :key="s.id" :label="s.name" :value="s.id")
        ElFormItem(v-if="needResource" label="資源" prop="resourceId")
          ElSelect(
            v-model="form.resourceId"
            placeholder="選擇資源"
            clearable
            value-on-clear=""
            style="width: 100%;"
          )
            ElOption(v-for="r in availableResources" :key="r.id" :label="r.name" :value="r.id")
        ElFormItem(label="日期" prop="date")
          ElDatePicker(
            v-model="form.date"
            value-format="YYYY-MM-DD"
            type="date"
            placeholder="選擇日期"
            style="width: 100%;"
          )
        ElFormItem(label="時段" prop="startAt")
          .OpenDialogAppointmentCreate__slots
            .OpenDialogAppointmentCreate__slots-empty(v-if="loadingSlots") 載入中…
            .OpenDialogAppointmentCreate__slots-empty(v-else-if="slots.length === 0") （請先選服務／資源／日期）
            button.OpenDialogAppointmentCreate__slot(
              v-for="s in slots"
              :key="s.startAt"
              type="button"
              :class="{ 'is-active': s.startAt === form.startAt, 'is-full': s.remaining <= 0 }"
              :disabled="s.remaining <= 0"
              @click="form.startAt = s.startAt"
            ) {{ fmtSlotTime(s.startAt) }}
        ElDivider 顧客資訊
        ElFormItem(label="姓氏" prop="lastName")
          ElInput(v-model="form.lastName" maxlength="20")
        ElFormItem(label="稱謂" prop="title")
          ElSelect(v-model="form.title" style="width: 100%;")
            ElOption(v-for="opt in titleOptions" :key="opt.value" :label="opt.label" :value="opt.value")
        ElFormItem(label="手機" prop="phone")
          ElInput(v-model="form.phone" maxlength="20" inputmode="numeric")
        ElFormItem(label="備註")
          ElInput(v-model="form.note" type="textarea" :rows="2" maxlength="200" show-word-limit)
    .OpenDialogAppointmentCreate__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") 取消
      ElButton(type="primary" :loading="submitting" @click="ClickSubmit") 建立
</template>

<style lang="scss" scoped>
.OpenDialogAppointmentCreate {
  @include fixed("fill");
  @include center;
}

.OpenDialogAppointmentCreate__mask {
  @include absolute("fill");
  background: rgb(0 0 0 / 50%);
}

.OpenDialogAppointmentCreate__content {
  position: relative;
  z-index: 1;
  width: min(520px, calc(100vw - 32px));
  max-height: 90vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

.OpenDialogAppointmentCreate__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogAppointmentCreate__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogAppointmentCreate__close {
  background: transparent;
  border: 0;
  font-size: 18px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogAppointmentCreate__body {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}

.OpenDialogAppointmentCreate__slots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.OpenDialogAppointmentCreate__slots-empty {
  font-size: 13px;
  color: #909399;
}

.OpenDialogAppointmentCreate__slot {
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.OpenDialogAppointmentCreate__slot.is-active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.OpenDialogAppointmentCreate__slot.is-full {
  background: #f5f7fa;
  color: #c0c4cc;
  cursor: not-allowed;
}

.OpenDialogAppointmentCreate__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid #ebeef5;
}
</style>
