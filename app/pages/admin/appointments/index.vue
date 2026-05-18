<script setup lang="ts">
// PageAdminAppointments — 商家後台預約管理（表格 + filter）
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const route = useRoute();
const router = useRouter();
const storeSelf = StoreSelf();

const loading = ref(false);
const items = ref<AppointmentItem[]>([]);
const total = ref(0);
const services = ref<{ id: string; name: string }[]>([]);
const resources = ref<{ id: string; name: string }[]>([]);

const filter = reactive({
  dateFrom: $dayjs().format('YYYY-MM-DD'),
  dateTo: $dayjs().add(14, 'day').format('YYYY-MM-DD'),
  status: '' as '' | AppointmentStatusType,
  serviceId: '',
  resourceId: '',
  customerPhone: '',
  page: 1,
  pageSize: 50
});

const ApiLoadServices = async () => {
  const res = await $api.GetServiceList();
  if (res.status.code === $enum.apiStatus.success) {
    services.value = res.data.items.map((s) => ({ id: s.id, name: s.name }));
  }
};
const ApiLoadResources = async () => {
  const res = await $api.GetResourceList();
  if (res.status.code === $enum.apiStatus.success) {
    resources.value = res.data.items.map((r) => ({ id: r.id, name: r.name }));
  }
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetAppointmentList({
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
      status: filter.status || undefined,
      serviceId: filter.serviceId || undefined,
      resourceId: filter.resourceId || undefined,
      customerPhone: filter.customerPhone || undefined,
      page: filter.page,
      pageSize: filter.pageSize
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '查詢失敗');
      return;
    }
    items.value = res.data.items;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
};

const ClickResetFilter = () => {
  filter.status = '';
  filter.serviceId = '';
  filter.resourceId = '';
  filter.customerPhone = '';
  filter.page = 1;
  ApiLoad();
};

const ClickCreate = async () => {
  const result = await $open.DialogAppointmentCreate({ slug: route.query.slug as string || '' });
  if (result.done) ApiLoad();
};

const ClickInfo = async (a: AppointmentItem) => {
  const result = await $open.DrawerAppointmentInfo({
    appointment: a,
    timezone: 'Asia/Taipei'
  });
  if (result.done && result.canceled) ApiLoad();
};

const ClickCancel = async (a: AppointmentItem) => {
  const result = await $open.DialogCancelReason({});
  if (!result.done) return;
  const res = await $api.CancelAppointment({ id: a.id, reason: result.reason });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '取消失敗');
    return;
  }
  ElMessage.success('已取消預約');
  ApiLoad();
};

const ClickGoCalendar = () => router.push('/admin/appointments/calendar');
const ClickGoArchive = () => router.push('/admin/appointments/archive');

onMounted(() => {
  ApiLoadServices();
  ApiLoadResources();
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminAppointments
  BizPageHeader(title="預約管理" subtitle="查詢、處理與代客預約")
    template(#actions)
      ElButton(plain @click="ClickGoCalendar") 行事曆檢視
      ElButton(plain @click="ClickGoArchive") 歷史紀錄
      ElButton(type="primary" @click="ClickCreate") 代客預約

  .PageAdminAppointments__filter
    ElDatePicker(
      v-model="filter.dateFrom"
      value-format="YYYY-MM-DD"
      type="date"
      placeholder="起始日"
    )
    span 至
    ElDatePicker(
      v-model="filter.dateTo"
      value-format="YYYY-MM-DD"
      type="date"
      placeholder="結束日"
    )
    ElSelect(
      v-model="filter.status"
      placeholder="狀態"
      clearable
      value-on-clear=""
      style="width: 120px;"
    )
      ElOption(label="已預約" value="CONFIRMED")
      ElOption(label="已取消" value="CANCELED")
      ElOption(label="未到" value="NO_SHOW")
      ElOption(label="已完成" value="COMPLETED")
    ElSelect(
      v-model="filter.serviceId"
      placeholder="服務"
      clearable
      value-on-clear=""
      style="width: 140px;"
    )
      ElOption(v-for="s in services" :key="s.id" :label="s.name" :value="s.id")
    ElSelect(
      v-model="filter.resourceId"
      placeholder="資源"
      clearable
      value-on-clear=""
      style="width: 120px;"
    )
      ElOption(v-for="r in resources" :key="r.id" :label="r.name" :value="r.id")
    ElInput(
      v-model="filter.customerPhone"
      placeholder="手機"
      maxlength="20"
      inputmode="numeric"
      style="width: 140px;"
    )
    ElButton(@click="ApiLoad") 查詢
    ElButton(plain @click="ClickResetFilter") 重設

  BizAppointmentTable(
    :items="items"
    :loading="loading"
    @click-info="ClickInfo"
    @click-cancel="ClickCancel"
  )

  .PageAdminAppointments__pager(v-if="total > filter.pageSize")
    ElPagination(
      v-model:current-page="filter.page"
      :page-size="filter.pageSize"
      :total="total"
      layout="prev, pager, next, total"
      @current-change="ApiLoad"
    )
</template>

<style lang="scss" scoped>
.PageAdminAppointments {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.PageAdminAppointments__filter {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 16px 18px;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageAdminAppointments__pager {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}
</style>
