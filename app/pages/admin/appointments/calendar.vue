<script setup lang="ts">
// PageAdminAppointmentsCalendar — 商家行事曆檢視
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const router = useRouter();
const mode = ref<'week' | 'day'>('week');
const anchorDate = ref($dayjs().format('YYYY-MM-DD'));
const items = ref<AppointmentItem[]>([]);
const loading = ref(false);

const dateRange = computed(() => {
  if (mode.value === 'day') {
    return { from: anchorDate.value, to: anchorDate.value };
  }
  const start = $dayjs(anchorDate.value);
  return {
    from: start.format('YYYY-MM-DD'),
    to: start.add(6, 'day').format('YYYY-MM-DD')
  };
});

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetAppointmentList({
      dateFrom: dateRange.value.from,
      dateTo: dateRange.value.to,
      status: 'CONFIRMED',
      pageSize: 200
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '查詢失敗');
      return;
    }
    items.value = res.data.items;
  } finally {
    loading.value = false;
  }
};

watch([mode, anchorDate], ApiLoad);

const ClickPrev = () => {
  const step = mode.value === 'day' ? 1 : 7;
  anchorDate.value = $dayjs(anchorDate.value).subtract(step, 'day').format('YYYY-MM-DD');
};
const ClickNext = () => {
  const step = mode.value === 'day' ? 1 : 7;
  anchorDate.value = $dayjs(anchorDate.value).add(step, 'day').format('YYYY-MM-DD');
};
const ClickToday = () => {
  anchorDate.value = $dayjs().format('YYYY-MM-DD');
};

const ClickCell = async (a: AppointmentItem) => {
  const result = await $open.DrawerAppointmentInfo({
    appointment: a,
    timezone: 'Asia/Taipei'
  });
  if (result.done && result.canceled) ApiLoad();
};

const ClickBackToList = () => router.push('/admin/appointments');

onMounted(ApiLoad);
</script>

<template lang="pug">
.PageAdminAppointmentsCalendar
  BizPageHeader(title="行事曆" subtitle="以週/日視圖檢視預約安排")
    template(#actions)
      ElButton(plain @click="ClickBackToList") 切換為列表

  .PageAdminAppointmentsCalendar__nav
    ElRadioGroup(v-model="mode")
      ElRadioButton(value="week") 週
      ElRadioButton(value="day") 日
    .PageAdminAppointmentsCalendar__date-nav
      ElButton(plain size="small" @click="ClickPrev") ← 上一{{ mode === 'day' ? '日' : '週' }}
      ElButton(plain size="small" @click="ClickToday") 今天
      ElButton(plain size="small" @click="ClickNext") 下一{{ mode === 'day' ? '日' : '週' }} →
    .PageAdminAppointmentsCalendar__anchor {{ anchorDate }}

  BizAppointmentCalendar(
    :items="items"
    :mode="mode"
    :anchor-date="anchorDate"
    @click-cell="ClickCell"
  )
</template>

<style lang="scss" scoped>
.PageAdminAppointmentsCalendar {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.PageAdminAppointmentsCalendar__nav {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: $white;
  padding: 14px 18px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageAdminAppointmentsCalendar__date-nav {
  display: flex;
  gap: 6px;
}

.PageAdminAppointmentsCalendar__anchor {
  margin-left: auto;
  font-size: 13.5px;
  font-weight: 600;
  color: $primary;
}
</style>
