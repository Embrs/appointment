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
  .PageLookup__panel
    h2.PageLookup__title {{ $t('booking.queryTitle') }}
    p.PageLookup__hint {{ $t('booking.customer.lastName') }} / {{ $t('booking.customer.titleField') }} / {{ $t('booking.customer.phone') }}
    ElForm(label-position="top" @submit.prevent="QueryFlow")
      ElFormItem(:label="$t('booking.customer.lastName')" required)
        ElInput(v-model="form.lastName" maxlength="20")
      ElFormItem(:label="$t('booking.customer.titleField')" required)
        ElSelect(v-model="form.title" style="width: 100%;")
          ElOption(v-for="opt in titleOptions" :key="opt.value" :label="opt.label" :value="opt.value")
      ElFormItem(:label="$t('booking.customer.phone')" required)
        ElInput(v-model="form.phone" maxlength="20" inputmode="numeric" placeholder="0912345678")
      ElButton(
        type="primary"
        :loading="submitting"
        :disabled="!isFormValid"
        @click="QueryFlow"
        style="width: 100%;"
      ) {{ $t('booking.querySubmit') }}

  template(v-if="queried")
    .PageLookup__results-head {{ merchantName }}
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
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
}

.PageLookup__title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
}

.PageLookup__hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #909399;
}

.PageLookup__results-head {
  font-size: 14px;
  color: #606266;
  padding: 0 4px;
}

.PageLookup__empty {
  padding: 32px;
  text-align: center;
  color: #909399;
  background: #fff;
  border-radius: 8px;
}

.PageLookup__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
