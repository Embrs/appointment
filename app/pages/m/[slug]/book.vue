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
  .PageBook__loading(v-if="loading") …
  template(v-else)
    .PageBook__steps
      .PageBook__step(
        v-for="(s, i) of stepOrder"
        :key="s"
        :class="{ 'is-active': s === currentStep, 'is-done': i < stepIndex }"
      )
        .PageBook__step-num {{ i + 1 }}
        .PageBook__step-label {{ $t(`booking.steps.${s}`) }}

    .PageBook__panel
      //- Step: service
      template(v-if="currentStep === 'service'")
        h3.PageBook__panel-title 選擇服務
        .PageBook__service-grid
          BizServiceCard(
            v-for="s in services"
            :key="s.id"
            :service="s"
            @click-book="ClickPickService"
          )

      //- Step: resource
      template(v-else-if="currentStep === 'resource'")
        h3.PageBook__panel-title 選擇資源
        BizResourcePicker(
          :model-value="form.resourceId"
          :resources="availableResources"
          @update:model-value="ClickPickResource"
        )
        .PageBook__nav
          ElButton(@click="ClickBack") 上一步

      //- Step: date
      template(v-else-if="currentStep === 'date'")
        h3.PageBook__panel-title 選擇日期
        BizDatePickerStrip(
          v-model="form.date"
          :days="14"
          :start-offset="0"
        )
        .PageBook__nav
          ElButton(@click="ClickBack") 上一步
          ElButton(type="primary" @click="ClickNextFromDate") 下一步

      //- Step: slot
      template(v-else-if="currentStep === 'slot'")
        h3.PageBook__panel-title 選擇時段
        BizDatePickerStrip(
          v-model="form.date"
          :days="14"
          :start-offset="0"
        )
        .PageBook__slot-block
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
        h3.PageBook__panel-title 填寫聯絡資訊
        ElForm(label-position="top")
          ElFormItem(label="姓氏" required)
            ElInput(v-model="form.lastName" maxlength="20" placeholder="例：王")
          ElFormItem(label="稱謂" required)
            ElSelect(v-model="form.title" style="width: 100%;")
              ElOption(v-for="opt in titleOptions" :key="opt.value" :label="opt.label" :value="opt.value")
          ElFormItem(label="手機號碼" required)
            ElInput(v-model="form.phone" maxlength="20" inputmode="numeric" placeholder="0912345678")
          ElFormItem(label="備註（選填）")
            ElInput(v-model="form.note" type="textarea" :rows="2" maxlength="200" show-word-limit)
        .PageBook__nav
          ElButton(@click="ClickBack") 上一步
          ElButton(type="primary" :disabled="!isFormValid" @click="ConfirmFlow") 預約確認
</template>

<style lang="scss" scoped>
.PageBook {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageBook__loading {
  padding: 32px;
  text-align: center;
  color: #909399;
}

.PageBook__steps {
  display: flex;
  gap: 4px;
  background: #fff;
  padding: 8px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  overflow-x: auto;
}

.PageBook__step {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: #909399;
  border-radius: 4px;
  min-width: 80px;
}

.PageBook__step.is-active {
  color: #409eff;
  background: #ecf5ff;
  font-weight: 600;
}

.PageBook__step.is-done {
  color: #67c23a;
}

.PageBook__step-num {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: currentColor;
  color: #fff !important; // override inline color for badge text
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.PageBook__panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.PageBook__panel-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.PageBook__service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.PageBook__slot-block {
  margin-top: 4px;
}

.PageBook__nav {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.PageBook__nav > * {
  flex: 1;
}
</style>
