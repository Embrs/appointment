<script setup lang="ts">
// PageBook — 顧客預約步驟器
// 步驟：service → (resource?) → date → slot → info → confirm
definePageMeta({ layout: 'front-desk' });

const { t } = useI18n();
const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ''));
const initialServiceId = computed(() => String(route.query.serviceId ?? ''));

const sessionStore = StoreCustomerSession();

const loading = ref(true);
const merchant = ref<PublicMerchantItem | null>(null);
const services = ref<PublicServiceItem[]>([]);
const resources = ref<PublicResourceItem[]>([]);

const slots = ref<AvailabilitySlot[]>([]);
const slotsLoading = ref(false);
const timezone = ref('Asia/Taipei');

// 步驟狀態
type StepName = 'service' | 'resource' | 'date' | 'slot' | 'info';
const stepOrder = computed<StepName[]>(() => {
  const needRes = selectedService.value?.bookingMode === 'RESOURCE';
  return needRes
    ? ['service', 'resource', 'date', 'slot', 'info']
    : ['service', 'date', 'slot', 'info'];
});
const currentStep = ref<StepName>('service');
const stepIndex = computed(() => stepOrder.value.indexOf(currentStep.value));

const form = reactive({
  serviceId: '',
  resourceId: '',
  date: '',
  startAt: '',
  endAt: '',
  lastName: '',
  title: 'MR' as CustomerTitleType,
  phone: '',
  note: ''
});

const selectedService = computed(() =>
  services.value.find((s) => s.id === form.serviceId) ?? null
);

const selectedResource = computed(() =>
  resources.value.find((r) => r.id === form.resourceId) ?? null
);

const availableResources = computed(() => {
  if (!selectedService.value) return [];
  const ids = selectedService.value.resourceIds;
  return resources.value.filter((r) => ids.includes(r.id));
});

// 載入 merchant
const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetPublicMerchant({ slug: slug.value });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '商家不存在');
      return;
    }
    merchant.value = res.data.merchant;
    services.value = res.data.services.filter((s) => s.bookingMode !== 'QUEUE');
    resources.value = res.data.resources;
    timezone.value = res.data.merchant.timezone;
    // URL 帶 serviceId：直接預選並推進
    if (initialServiceId.value) {
      const s = services.value.find((x) => x.id === initialServiceId.value);
      if (s) {
        form.serviceId = s.id;
        currentStep.value = s.bookingMode === 'RESOURCE' ? 'resource' : 'date';
        if (s.bookingMode !== 'RESOURCE') {
          form.date = TodayStr(1);
          await ApiLoadSlots();
        }
      }
    }
    // 預填三元組
    if (sessionStore.triplet) {
      form.lastName = sessionStore.triplet.lastName;
      form.title = sessionStore.triplet.title;
      form.phone = sessionStore.triplet.phone;
    }
  } finally {
    loading.value = false;
  }
};

const TodayStr = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return $dayjs(d).format('YYYY-MM-DD');
};

const ApiLoadSlots = async () => {
  if (!selectedService.value || !form.date) return;
  if (selectedService.value.bookingMode === 'RESOURCE' && !form.resourceId) return;
  slotsLoading.value = true;
  slots.value = [];
  form.startAt = '';
  form.endAt = '';
  try {
    const res = await $api.GetAvailability({
      slug: slug.value,
      serviceId: form.serviceId,
      resourceId: selectedService.value.bookingMode === 'RESOURCE' ? form.resourceId : undefined,
      date: form.date
    });
    if (res.status.code === $enum.apiStatus.success) {
      slots.value = res.data.slots;
      timezone.value = res.data.timezone;
    } else {
      ElMessage.error(res.status.message?.zh_tw || '查詢時段失敗');
    }
  } finally {
    slotsLoading.value = false;
  }
};

const ClickPickService = (id: string) => {
  form.serviceId = id;
  form.resourceId = '';
  form.startAt = '';
  slots.value = [];
  const needRes = selectedService.value?.bookingMode === 'RESOURCE';
  currentStep.value = needRes ? 'resource' : 'date';
  if (!needRes && !form.date) form.date = TodayStr(1);
  if (!needRes) ApiLoadSlots();
};

const ClickQueueFromBook = (_serviceId: string) => {
  navigateTo(`/m/${slug.value}/queue`);
};

const ClickPickResource = (id: string) => {
  form.resourceId = id;
  if (!form.date) form.date = TodayStr(1);
  currentStep.value = 'date';
  ApiLoadSlots();
};

watch(() => form.date, () => {
  if (currentStep.value === 'date' || currentStep.value === 'slot') ApiLoadSlots();
});

const ClickNextFromDate = () => {
  if (!form.date) { ElMessage.warning(t('validation.selectDate')); return; }
  currentStep.value = 'slot';
};

const ClickPickSlot = (slot: AvailabilitySlot) => {
  form.startAt = slot.startAt;
  form.endAt = slot.endAt;
  currentStep.value = 'info';
};

const ClickBack = () => {
  const i = stepIndex.value;
  if (i > 0) currentStep.value = stepOrder.value[i - 1]!;
};

const ConfirmFlow = async () => {
  if (!isFormValid.value) {
    ElMessage.warning(t('validation.completeFields'));
    return;
  }
  // 持久化三元組
  sessionStore.SetTriplet({
    lastName: form.lastName.trim(),
    title: form.title,
    phone: form.phone.replace(/[\s-]/g, '')
  });

  const result = await $open.DrawerBookingConfirm({
    slug: slug.value,
    serviceId: form.serviceId,
    serviceName: selectedService.value!.name,
    resourceId: selectedService.value!.bookingMode === 'RESOURCE' ? form.resourceId : undefined,
    resourceName: selectedResource.value?.name,
    startAt: form.startAt,
    endAt: form.endAt,
    timezone: timezone.value,
    customer: sessionStore.triplet!,
    note: form.note.trim() || undefined
  });

  if (result.done) {
    await $open.DialogBookingSuccess({
      serviceName: selectedService.value!.name,
      startAt: form.startAt,
      timezone: timezone.value
    });
    navigateTo(`/m/${slug.value}/my-bookings`);
  }
};

const isFormValid = computed(() =>
  !!form.lastName.trim() &&
  !!form.title &&
  /^[0-9+\s-]{6,20}$/.test(form.phone)
);

const titleOptions = computed(() => [
  { value: 'MR' as const, label: t('booking.customer.titleMr') },
  { value: 'MRS' as const, label: t('booking.customer.titleMrs') },
  { value: 'MISS' as const, label: t('booking.customer.titleMiss') },
  { value: 'MX' as const, label: t('booking.customer.titleMx') }
]);

onMounted(ApiLoad);
</script>

<template lang="pug">
.PageBook
  .PageBook__loading(v-if="loading") 載入中…
  template(v-else)
    //- 步驟條
    .PageBook__steps
      .PageBook__step(
        v-for="(s, i) of stepOrder"
        :key="s"
        :class="{ 'PageBook__step--active': s === currentStep, 'PageBook__step--done': i < stepIndex }"
      )
        .PageBook__stepNum
          span.PageBook__stepNumInner
            template(v-if="i < stepIndex") ✓
            template(v-else) {{ i + 1 }}
        .PageBook__stepLabel {{ $t(`booking.steps.${s}`) }}

    //- 內容面板
    .PageBook__panel
      //- Step: service
      template(v-if="currentStep === 'service'")
        h3.PageBook__panelTitle 選擇服務
        .PageBook__serviceGrid
          BizServiceCard(
            v-for="s in services"
            :key="s.id"
            :service="s"
            @click-book="ClickPickService"
            @click-queue="ClickQueueFromBook"
          )

      //- Step: resource
      template(v-else-if="currentStep === 'resource'")
        h3.PageBook__panelTitle 選擇資源
        BizResourcePicker(
          :model-value="form.resourceId"
          :resources="availableResources"
          @update:model-value="ClickPickResource"
        )
        .PageBook__nav
          ElButton(@click="ClickBack") 上一步

      //- Step: date
      template(v-else-if="currentStep === 'date'")
        h3.PageBook__panelTitle 選擇日期
        BizDatePickerCalendar(v-model="form.date")
        .PageBook__nav
          ElButton(@click="ClickBack") 上一步
          ElButton(type="primary" @click="ClickNextFromDate") 下一步

      //- Step: slot
      template(v-else-if="currentStep === 'slot'")
        h3.PageBook__panelTitle 選擇時段
        BizDatePickerCalendar(v-model="form.date")
        .PageBook__slotBlock
          BizSlotPicker(
            :model-value="form.startAt"
            :slots="slots"
            :timezone="timezone"
            :loading="slotsLoading"
            @update:model-value="(iso) => { const s = slots.find(x => x.startAt === iso); if (s) ClickPickSlot(s); }"
          )
        .PageBook__nav
          ElButton(@click="ClickBack") 上一步

      //- Step: info
      template(v-else-if="currentStep === 'info'")
        h3.PageBook__panelTitle 填寫聯絡資訊
        ElForm(label-position="top")
          ElFormItem(label="姓氏" required)
            ElInput(v-model="form.lastName" maxlength="20" size="large" placeholder="例：王")
          ElFormItem(label="稱謂" required)
            ElSelect(v-model="form.title" size="large" style="width: 100%;")
              ElOption(v-for="opt in titleOptions" :key="opt.value" :label="opt.label" :value="opt.value")
          ElFormItem(label="手機號碼" required)
            ElInput(v-model="form.phone" maxlength="20" inputmode="numeric" size="large" placeholder="0912345678")
          ElFormItem(label="備註（選填）")
            ElInput(v-model="form.note" type="textarea" :rows="2" maxlength="200" show-word-limit)
        .PageBook__nav
          ElButton(size="large" @click="ClickBack") 上一步
          ElButton(type="primary" size="large" :disabled="!isFormValid" @click="ConfirmFlow") 預約確認
</template>

<style lang="scss" scoped>
.PageBook {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageBook__loading {
  padding: 32px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}

// 步驟條 ----
.PageBook__steps {
  display: flex;
  gap: 4px;
  background-color: $white;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  overflow-x: auto;
}

.PageBook__step {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12.5px;
  color: rgba(69, 69, 69, 0.5);
  border-radius: 8px;
  min-width: 90px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.PageBook__step--active {
  color: $primary;
  background-color: rgba(53, 77, 123, 0.08);
  font-weight: 600;
}

.PageBook__step--done {
  color: $secondary;
}

.PageBook__stepNum {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: currentColor;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.PageBook__stepNumInner {
  color: $white;
  line-height: 1;
}

.PageBook__step:not(.PageBook__step--active):not(.PageBook__step--done) .PageBook__stepNum {
  background-color: rgba(53, 77, 123, 0.18);
}

// 內容面板 ----
.PageBook__panel {
  background-color: $white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -8px rgba(31, 42, 68, 0.1);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.PageBook__panelTitle {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
  position: relative;
  padding-left: 12px;
}

.PageBook__panelTitle::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, $primary, $secondary);
}

.PageBook__serviceGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.PageBook__slotBlock {
  margin-top: 4px;
}

.PageBook__nav {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.PageBook__nav > * {
  flex: 1;
}

:deep(.el-input__wrapper),
:deep(.el-select .el-select__wrapper),
:deep(.el-textarea__inner) {
  border-radius: 10px;
}

@media (max-width: 640px) {
  .PageBook__steps {
    gap: 6px;
  }

  .PageBook__step {
    flex: 0 0 auto;
    min-width: 0;
    padding: 6px 10px;
    font-size: 12px;
  }

  .PageBook__step--active {
    flex: 1 1 auto;
  }

  .PageBook__stepLabel {
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .PageBook__step:not(.PageBook__step--active) .PageBook__stepLabel {
    display: none;
  }
}
</style>
