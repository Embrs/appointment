<script setup lang="ts">
// PageLookup — 顧客以三元組查詢預約
definePageMeta({ layout: 'front-desk' });

const { t } = useI18n();
const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ''));
const sessionStore = StoreCustomerSession();

const submitting = ref(false);
const queried = ref(false);
const appointments = ref<LookupAppointmentItem[]>([]);
const timezone = ref('Asia/Taipei');
const merchantName = ref('');

const form = reactive({
  lastName: sessionStore.triplet?.lastName ?? '',
  title: (sessionStore.triplet?.title ?? 'MR') as CustomerTitleType,
  phone: sessionStore.triplet?.phone ?? ''
});

const titleOptions = computed(() => [
  { value: 'MR' as const, label: t('booking.customer.titleMr') },
  { value: 'MRS' as const, label: t('booking.customer.titleMrs') },
  { value: 'MISS' as const, label: t('booking.customer.titleMiss') },
  { value: 'MX' as const, label: t('booking.customer.titleMx') }
]);

const isFormValid = computed(() =>
  !!form.lastName.trim() &&
  !!form.title &&
  /^[0-9+\s-]{6,20}$/.test(form.phone)
);

const QueryFlow = async () => {
  if (!isFormValid.value) {
    ElMessage.warning(t('validation.completeTriplet'));
    return;
  }
  submitting.value = true;
  try {
    const res = await $api.LookupAppointment({
      slug: slug.value,
      lastName: form.lastName.trim(),
      title: form.title,
      phone: form.phone.replace(/[\s-]/g, '')
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '查詢失敗');
      return;
    }
    appointments.value = res.data.appointments;
    timezone.value = res.data.merchant.timezone;
    merchantName.value = res.data.merchant.name;
    // 寫回 session
    sessionStore.SetTriplet({
      lastName: form.lastName.trim(),
      title: form.title,
      phone: form.phone.replace(/[\s-]/g, '')
    });
    sessionStore.AddSlug(slug.value);
    queried.value = true;
  } finally {
    submitting.value = false;
  }
};

const ClickCancel = async (id: string) => {
  const ask = UseAsk();
  const ok = await ask.Cancel();
  if (!ok) return;
  const res = await $api.CancelPublicAppointment({
    id,
    lastName: form.lastName.trim(),
    title: form.title,
    phone: form.phone.replace(/[\s-]/g, '')
  });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '取消失敗');
    return;
  }
  ElMessage.success(t('booking.messages.cancelSuccess'));
  QueryFlow();
};
</script>

<template lang="pug">
.PageLookup
  BizCustomerPageHeader(
    :title="$t('booking.queryTitle')"
    :back-to="`/m/${slug}`"
  )
  .PageLookup__panel
    .PageLookup__head
      p.PageLookup__hint 輸入下方三項資訊查詢您的預約紀錄
    ElForm.PageLookup__form(label-position="top" @submit.prevent="QueryFlow")
      ElFormItem(:label="$t('booking.customer.lastName')" required)
        ElInput(v-model="form.lastName" maxlength="20" size="large")
      ElFormItem(:label="$t('booking.customer.titleField')" required)
        ElSelect(v-model="form.title" size="large" style="width: 100%;")
          ElOption(v-for="opt in titleOptions" :key="opt.value" :label="opt.label" :value="opt.value")
      ElFormItem(:label="$t('booking.customer.phone')" required)
        ElInput(v-model="form.phone" maxlength="20" inputmode="numeric" size="large" placeholder="0912345678")
      ElButton.PageLookup__submit(
        type="primary"
        size="large"
        :loading="submitting"
        :disabled="!isFormValid"
        @click="QueryFlow"
      ) {{ $t('booking.querySubmit') }}

  template(v-if="queried")
    .PageLookup__resultsHead {{ merchantName }}
    .PageLookup__empty(v-if="appointments.length === 0") {{ $t('booking.messages.emptyList') }}
    .PageLookup__list(v-else)
      BizBookingCard(
        v-for="a in appointments"
        :key="a.id"
        :appointment="a"
        :timezone="timezone"
        @click-cancel="ClickCancel"
      )
</template>

<style lang="scss" scoped>
.PageLookup {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageLookup__panel {
  background-color: $white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -8px rgba(31, 42, 68, 0.1);
}

.PageLookup__head {
  margin-bottom: 20px;
}

.PageLookup__eyebrow {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  background-color: rgba(53, 77, 123, 0.08);
  color: $primary;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

.PageLookup__title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
}

.PageLookup__hint {
  margin: 0;
  font-size: 13px;
  color: rgba(69, 69, 69, 0.65);
  line-height: 1.6;
}

.PageLookup__submit {
  width: 100%;
  margin-top: 4px;
  border-radius: 10px;
  font-weight: 600;
}

.PageLookup__resultsHead {
  font-size: 13px;
  color: rgba(69, 69, 69, 0.6);
  padding: 0 4px;
}

.PageLookup__empty {
  padding: 32px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageLookup__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

:deep(.el-input__wrapper),
:deep(.el-select .el-select__wrapper) {
  border-radius: 10px;
}
</style>
