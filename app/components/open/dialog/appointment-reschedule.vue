<script setup lang="ts">
// OpenDialogAppointmentReschedule — 商家修改既有預約的時間 / 資源
// 規範：
//   - 不通知顧客（純後台操作）
//   - 一般模式走 BizSlotPicker（availability 公開 API）
//   - 啟用「過號補登」(force) 時改 ElTimePicker 自由輸入，後端跳過排班檢查，仍阻擋雙開
//   - 模式守衛：TIME_SLOT / TIME_CAPACITY 不顯示資源；RESOURCE 必選；RESOURCE_OPTIONAL 含「不指定」
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogAppointmentRescheduleParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const { t } = useI18n();
const slotReason = UseSlotReason();

const submitting = ref(false);
const resources = ref<ResourceItem[]>([]);
const slots = ref<AvailabilitySlot[]>([]);
const loadingSlots = ref(false);

const appointment = computed(() => props.params.appointment);
const service = computed(() => appointment.value.service);
const timezone = ref(props.params.timezone || 'Asia/Taipei');

// '__any__' sentinel 對應 RESOURCE_OPTIONAL「不指定」
const ANY_RESOURCE = '__any__';

const initialDate = $dayjs(new Date(appointment.value.startAt)).tz(timezone.value).format('YYYY-MM-DD');
const initialTime = $dayjs(new Date(appointment.value.startAt)).tz(timezone.value).format('HH:mm');

const form = reactive({
  date: initialDate,
  startAt: appointment.value.startAt,
  /** 自由輸入時段（force=true 時用），格式 HH:mm */
  freeTime: initialTime,
  /** RESOURCE 模式下的 id 或 RESOURCE_OPTIONAL 的 id 或 '__any__' */
  resourceId: appointment.value.resource?.id ?? (
    service.value.bookingMode === 'RESOURCE_OPTIONAL' ? ANY_RESOURCE : ''
  ),
  force: false
});

const needResource = computed(
  () => service.value.bookingMode === 'RESOURCE' || service.value.bookingMode === 'RESOURCE_OPTIONAL'
);
const isResourceOptional = computed(() => service.value.bookingMode === 'RESOURCE_OPTIONAL');

const apiResourceId = computed(() =>
  needResource.value && form.resourceId && form.resourceId !== ANY_RESOURCE
    ? form.resourceId
    : undefined
);

const availableResources = computed(() => {
  if (!needResource.value) return [];
  // 全部 active 資源；綁定關係仍由後端驗證（GetResourceList 沒有 service-resource 綁定關係）
  return resources.value.filter((r) => r.isActive);
});

const formRef = ref<FormInstance | null>(null);
const rules: FormRules = {
  date: [{ required: true, message: '請選擇日期', trigger: 'change' }],
  startAt: [{ required: true, message: '請選擇時段', trigger: 'change' }]
};

const ApiLoadResources = async () => {
  const res = await $api.GetResourceList();
  if (res.status.code === $enum.apiStatus.success) {
    resources.value = res.data.items;
  }
};

const ApiLoadSlots = async () => {
  if (!form.date) return;
  if (form.force) {
    // force 模式：不打 availability，使用自由 ElTimePicker；確保 form.startAt 與 freeTime 同步
    SyncFreeTimeToStartAt();
    return;
  }
  if (needResource.value && service.value.bookingMode === 'RESOURCE' && !form.resourceId) return;

  loadingSlots.value = true;
  slots.value = [];
  try {
    const res = await $api.GetAvailability({
      slug: props.params.slug,
      serviceId: service.value.id,
      resourceId: apiResourceId.value,
      date: form.date
    });
    if (res.status.code === $enum.apiStatus.success) {
      slots.value = res.data.slots;
      timezone.value = res.data.timezone;
      // 若 form.startAt 在新 slot 列表中已不可用，清空
      const target = slots.value.find((s) => s.startAt === form.startAt);
      if (!target || target.reason || target.remaining <= 0) {
        form.startAt = '';
      }
    }
  } finally {
    loadingSlots.value = false;
  }
};

const SyncFreeTimeToStartAt = () => {
  if (!form.date || !form.freeTime) {
    form.startAt = '';
    return;
  }
  // 將 date + freeTime + tz 組成 ISO UTC
  const iso = $dayjs.tz(`${form.date} ${form.freeTime}`, timezone.value).toDate().toISOString();
  form.startAt = iso;
};

watch(() => form.date, () => {
  ApiLoadSlots();
});
watch(() => form.resourceId, () => {
  if (!form.force) ApiLoadSlots();
});
watch(() => form.freeTime, () => {
  if (form.force) SyncFreeTimeToStartAt();
});
watch(() => form.force, (next) => {
  if (next) {
    SyncFreeTimeToStartAt();
  } else {
    ApiLoadSlots();
  }
});

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({ done });
  emit('on-close');
};

const buildResourceIdPayload = (): string | null | undefined => {
  if (!needResource.value) return undefined;
  if (isResourceOptional.value) {
    if (form.resourceId === ANY_RESOURCE) return null;
    return form.resourceId || null;
  }
  return form.resourceId || undefined;
};

const SaveFlow = async () => {
  submitting.value = true;
  try {
    const res = await $api.RescheduleAppointment({
      id: appointment.value.id,
      startAt: form.startAt,
      resourceId: buildResourceIdPayload(),
      force: form.force || undefined
    });
    if (res.status.code !== $enum.apiStatus.success) {
      const msg = res.status.message?.zh_tw || '修改失敗';
      // 命中 MSG_PAST_SLOT（後端 zh_tw：「已過期的時段不可預約」）時提示開啟 force
      if (!form.force && /已過期/.test(msg)) {
        const hint = t('appointment.reschedule.forcePromptOnPastSlot');
        ElMessage.warning(`${msg}｜${hint}`);
      } else {
        ElMessage.error(msg);
      }
      return;
    }
    ElMessage.success(t('appointment.reschedule.success'));
    EmitClose(true);
  } finally {
    submitting.value = false;
  }
};

const ClickSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  if (!form.startAt) {
    ElMessage.warning(t('appointment.reschedule.fields.timeRequired'));
    return;
  }
  if (needResource.value && service.value.bookingMode === 'RESOURCE' && (!form.resourceId || form.resourceId === ANY_RESOURCE)) {
    ElMessage.warning(t('appointment.reschedule.fields.resourceRequired'));
    return;
  }
  await SaveFlow();
};

const fmtSlotTime = (iso: string) => $dayjs(new Date(iso)).tz(timezone.value).format('HH:mm');

const slotEmptyHint = computed(() => {
  if (form.force) return '';
  if (loadingSlots.value) return '';
  if (slots.value.length > 0) return '';
  if (needResource.value && service.value.bookingMode === 'RESOURCE' && !form.resourceId) return '請先選擇資源';
  if (!form.date) return '請先選擇日期';
  return '本日無可預約時段，請改選其他日期或啟用過號補登';
});

const SlotClass = (s: AvailabilitySlot) => ({
  'is-active': s.startAt === form.startAt,
  'is-unavailable': !!s.reason || s.remaining <= 0,
  [`is-reason-${s.reason || 'taken'}`]: !!s.reason
});

const SlotIsDisabled = (s: AvailabilitySlot) => !!s.reason || s.remaining <= 0;
const SlotLabel = (s: AvailabilitySlot) => {
  const time = fmtSlotTime(s.startAt);
  if (!s.reason) return time;
  return `${time} · ${slotReason.GetReasonLabel(s.reason)}`;
};
const SlotTooltip = (s: AvailabilitySlot) => s.reason ? slotReason.GetReasonTooltip(s.reason) : '';

const originLabel = computed(() => {
  const s = appointment.value.startAt;
  const e = appointment.value.endAt;
  const datePart = $dayjs(new Date(s)).tz(timezone.value).format('YYYY-MM-DD');
  const startPart = $dayjs(new Date(s)).tz(timezone.value).format('HH:mm');
  const endPart = $dayjs(new Date(e)).tz(timezone.value).format('HH:mm');
  const resource = appointment.value.resource ? ` ｜ ${appointment.value.resource.name}` : '';
  return `${datePart} ${startPart} ~ ${endPart} ｜ ${service.value.name}${resource}`;
});

onMounted(async () => {
  if (needResource.value) {
    await ApiLoadResources();
  }
  await ApiLoadSlots();
});
</script>

<template lang="pug">
.OpenDialogAppointmentReschedule
  .OpenDialogAppointmentReschedule__mask(v-motion-fade)
  .OpenDialogAppointmentReschedule__content(v-motion-roll-bottom)
    .OpenDialogAppointmentReschedule__header
      span.OpenDialogAppointmentReschedule__title {{ $t('appointment.reschedule.title') }}
      button.OpenDialogAppointmentReschedule__close(type="button" :disabled="submitting" @click="EmitClose(false)") ✕
    .OpenDialogAppointmentReschedule__body
      .OpenDialogAppointmentReschedule__origin
        span.OpenDialogAppointmentReschedule__originLabel {{ $t('appointment.reschedule.origin') }}
        span.OpenDialogAppointmentReschedule__originValue {{ originLabel }}
      ElForm(ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="ClickSubmit")
        ElFormItem(:label="$t('appointment.reschedule.fields.date')" prop="date")
          ElDatePicker(
            v-model="form.date"
            value-format="YYYY-MM-DD"
            type="date"
            :placeholder="$t('appointment.reschedule.fields.date')"
            style="width: 100%;"
          )
        ElFormItem(v-if="needResource" :label="$t('appointment.reschedule.fields.resource')")
          ElSelect(
            v-model="form.resourceId"
            :placeholder="$t('appointment.reschedule.fields.resource')"
            style="width: 100%;"
          )
            ElOption(
              v-if="isResourceOptional"
              :label="$t('appointment.reschedule.fields.resourceAny')"
              :value="ANY_RESOURCE"
            )
            ElOption(v-for="r in availableResources" :key="r.id" :label="r.name" :value="r.id")
        ElFormItem(:label="$t('appointment.reschedule.fields.time')" prop="startAt")
          //- force=false：BizSlotPicker
          .OpenDialogAppointmentReschedule__slots(v-if="!form.force && slots.length > 0 && !loadingSlots")
            ElTooltip(
              v-for="s in slots"
              :key="s.startAt"
              :content="SlotTooltip(s)"
              :disabled="!SlotTooltip(s)"
              placement="top"
            )
              button.OpenDialogAppointmentReschedule__slot(
                type="button"
                :class="SlotClass(s)"
                :disabled="SlotIsDisabled(s)"
                @click="form.startAt = s.startAt"
              ) {{ SlotLabel(s) }}
          .OpenDialogAppointmentReschedule__slotsHint(v-else-if="!form.force && loadingSlots")
            span.OpenDialogAppointmentReschedule__slotsHintIcon ⏳
            span {{ $t('appointment.reschedule.loadingSlots') }}
          .OpenDialogAppointmentReschedule__slotsHint.is-empty(v-else-if="!form.force")
            span.OpenDialogAppointmentReschedule__slotsHintIcon ⬆
            span {{ slotEmptyHint }}
          //- force=true：ElTimePicker 自由輸入
          ElTimePicker(
            v-if="form.force"
            v-model="form.freeTime"
            format="HH:mm"
            value-format="HH:mm"
            :placeholder="$t('appointment.reschedule.fields.timePlaceholder')"
            style="width: 100%;"
          )
        ElFormItem
          ElCheckbox(v-model="form.force")
            span {{ $t('appointment.reschedule.fields.force') }}
          .OpenDialogAppointmentReschedule__forceHint(v-if="form.force") {{ $t('appointment.reschedule.forceHint') }}
    .OpenDialogAppointmentReschedule__footer
      ElButton(:disabled="submitting" @click="EmitClose(false)") {{ $t('appointment.reschedule.actions.cancel') }}
      ElButton(type="primary" :loading="submitting" @click="ClickSubmit") {{ $t('appointment.reschedule.actions.confirm') }}
</template>

<style lang="scss" scoped>
.OpenDialogAppointmentReschedule {
  @include fixed("fill");
  @include center;
}

.OpenDialogAppointmentReschedule__mask {
  @include absolute("fill");
  background: rgb(0 0 0 / 50%);
}

.OpenDialogAppointmentReschedule__content {
  position: relative;
  z-index: 1;
  width: min(520px, calc(100vw - 32px));
  max-height: 90vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

.OpenDialogAppointmentReschedule__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogAppointmentReschedule__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogAppointmentReschedule__close {
  background: transparent;
  border: 0;
  font-size: 18px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogAppointmentReschedule__body {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}

.OpenDialogAppointmentReschedule__origin {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #f5f7fa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.OpenDialogAppointmentReschedule__originLabel {
  font-size: 12px;
  color: #909399;
}

.OpenDialogAppointmentReschedule__originValue {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.OpenDialogAppointmentReschedule__slots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.OpenDialogAppointmentReschedule__slot {
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.OpenDialogAppointmentReschedule__slot:not(:disabled):hover {
  border-color: #409eff;
  color: #409eff;
}

.OpenDialogAppointmentReschedule__slot.is-active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.OpenDialogAppointmentReschedule__slot.is-unavailable {
  background: #f5f7fa;
  color: #c0c4cc;
  border-color: #e4e7ed;
  cursor: not-allowed;
  text-decoration: line-through;
}

.OpenDialogAppointmentReschedule__slot.is-reason-past {
  background: #f5f7fa;
  color: #c0c4cc;
}

.OpenDialogAppointmentReschedule__slot.is-reason-taken,
.OpenDialogAppointmentReschedule__slot.is-reason-capacity {
  background: #fef0f0;
  color: #f56c6c;
  border-color: #fbc4c4;
}

.OpenDialogAppointmentReschedule__slotsHint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 13px;
  color: #606266;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  line-height: 1.5;
}

.OpenDialogAppointmentReschedule__slotsHint.is-empty {
  background: #fef6ec;
  border-color: #f5dab1;
  color: #b88230;
}

.OpenDialogAppointmentReschedule__slotsHintIcon {
  font-size: 16px;
  flex-shrink: 0;
}

.OpenDialogAppointmentReschedule__forceHint {
  margin-top: 6px;
  padding: 8px 10px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 6px;
  color: #ad6800;
  font-size: 12px;
  line-height: 1.5;
}

.OpenDialogAppointmentReschedule__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid #ebeef5;
}

@media (max-width: 480px) {
  .OpenDialogAppointmentReschedule__content {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 32px);
  }

  .OpenDialogAppointmentReschedule__footer .el-button {
    flex: 1;
  }
}
</style>
