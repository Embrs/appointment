<script setup lang="ts">
// PageMyBookings — 顧客 session 內的預約清單
// 如已有三元組：自動查；否則彈出 CustomerForm 填寫
definePageMeta({ layout: 'front-desk' });

const { t } = useI18n();
const route = useRoute();
const slug = computed(() => String(route.params.slug ?? ''));
const sessionStore = StoreCustomerSession();

const loading = ref(true);
const appointments = ref<LookupAppointmentItem[]>([]);
const merchantName = ref('');
const timezone = ref('Asia/Taipei');

const ApiLookup = async () => {
  if (!sessionStore.triplet) return;
  loading.value = true;
  try {
    const res = await $api.LookupAppointment({
      slug: slug.value,
      ...sessionStore.triplet
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '查詢失敗');
      return;
    }
    appointments.value = res.data.appointments;
    merchantName.value = res.data.merchant.name;
    timezone.value = res.data.merchant.timezone;
  } finally {
    loading.value = false;
  }
};

const PromptTripletFlow = async () => {
  loading.value = false;
  const result = await $open.DialogCustomerForm({
    title: t('booking.queryTitle'),
    submitLabel: t('booking.querySubmit'),
    initial: sessionStore.triplet ?? undefined
  });
  if (!result.done || !result.triplet) {
    navigateTo(`/m/${slug.value}`);
    return;
  }
  sessionStore.SetTriplet(result.triplet);
  ApiLookup();
};

const ClickCancel = async (id: string) => {
  if (!sessionStore.triplet) return;
  const ask = UseAsk();
  const ok = await ask.Cancel();
  if (!ok) return;
  const res = await $api.CancelPublicAppointment({
    id,
    ...sessionStore.triplet
  });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '取消失敗');
    return;
  }
  ElMessage.success(t('booking.messages.cancelSuccess'));
  ApiLookup();
};

onMounted(() => {
  if (sessionStore.hasTriplet) {
    ApiLookup();
  } else {
    PromptTripletFlow();
  }
});
</script>

<template lang="pug">
.PageMyBookings
  .PageMyBookings__loading(v-if="loading") …
  template(v-else)
    .PageMyBookings__head
      div
        h2.PageMyBookings__title {{ $t('booking.nav.myBookings') }}
        p.PageMyBookings__sub {{ merchantName }}
      ElButton(plain size="small" @click="PromptTripletFlow") {{ $t('booking.actions.switchIdentity') }}
    .PageMyBookings__empty(v-if="appointments.length === 0") {{ $t('booking.messages.emptyList') }}
    template(v-else)
      .PageMyBookings__list
        template(v-for="(a, idx) in appointments" :key="a.id")
          BizBookingCard(
            :appointment="a"
            :timezone="timezone"
            @click-cancel="ClickCancel"
          )
          BizAdSlot(v-if="(idx + 1) % 3 === 0" name="my-bookings-inline")
</template>

<style lang="scss" scoped>
.PageMyBookings {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.PageMyBookings__loading,
.PageMyBookings__empty {
  padding: 32px;
  text-align: center;
  color: #909399;
}

.PageMyBookings__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  padding: 0 4px;
}

.PageMyBookings__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.PageMyBookings__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #909399;
}

.PageMyBookings__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
