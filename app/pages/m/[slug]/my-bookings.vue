<script setup lang="ts">
// PageMyBookings — 顧客 session 內的預約清單
// 如已有三元組：自動查；否則彈出 CustomerForm 填寫
definePageMeta({ layout: 'front-desk' });

const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
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
    navigateTo(localePath(`/m/${slug.value}`));
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
  BizCustomerPageHeader(
    :title="$t('booking.nav.myBookings')"
    :subtitle="merchantName || ''"
    :back-to="`/m/${slug}`"
  )
    template(#actions)
      button.PageMyBookings__switch(type="button" @click="PromptTripletFlow")
        span.PageMyBookings__switchIcon ⇄
        span {{ $t('booking.actions.switchIdentity') }}
  .PageMyBookings__loading(v-if="loading") {{ $t('common.loading') }}
  template(v-else)
    .PageMyBookings__empty(v-if="appointments.length === 0")
      .PageMyBookings__emptyIcon ○
      .PageMyBookings__emptyText {{ $t('booking.messages.emptyList') }}
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
  gap: 16px;
}

.PageMyBookings__loading {
  padding: 32px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}

.PageMyBookings__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  padding: 4px 4px 0;
}

.PageMyBookings__headLeft {
  min-width: 0;
  flex: 1;
}

.PageMyBookings__eyebrow {
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 999px;
  background-color: rgba(53, 77, 123, 0.08);
  color: $primary;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}

.PageMyBookings__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
}

.PageMyBookings__sub {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: rgba(69, 69, 69, 0.6);
}

.PageMyBookings__switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: $white;
  border: 1px solid rgba(53, 77, 123, 0.15);
  color: $primary;
  font-size: 12.5px;
  font-weight: 500;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  flex-shrink: 0;
}

.PageMyBookings__switch:hover {
  border-color: $primary;
  background-color: rgba(53, 77, 123, 0.04);
}

.PageMyBookings__switchIcon {
  font-size: 13px;
  opacity: 0.7;
}

.PageMyBookings__empty {
  padding: 40px 24px;
  text-align: center;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.PageMyBookings__emptyIcon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: rgba(53, 77, 123, 0.06);
  color: rgba(53, 77, 123, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.PageMyBookings__emptyText {
  color: rgba(69, 69, 69, 0.6);
  font-size: 14px;
}

.PageMyBookings__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
