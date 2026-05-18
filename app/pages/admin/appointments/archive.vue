<script setup lang="ts">
// PageAdminAppointmentsArchive — 商家歷史紀錄查詢
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const loading = ref(false);
const items = ref<AppointmentArchiveItem[]>([]);
const total = ref(0);
const filter = reactive({
  dateFrom: $dayjs().subtract(6, 'month').format('YYYY-MM-DD'),
  dateTo: $dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
  customerPhone: '',
  page: 1,
  pageSize: 50
});

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetAppointmentArchive({
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
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

const TitleLabel = (t: string) =>
  ({ MR: '先生', MRS: '女士', MISS: '小姐', MX: '客人' } as Record<string, string>)[t] ?? '';

const fmtDateTime = (iso: string) => $dayjs(new Date(iso)).format('YYYY-MM-DD HH:mm');

onMounted(ApiLoad);
</script>

<template lang="pug">
.PageArchive
  BizPageHeader(title="歷史紀錄" subtitle="查詢已歸檔的舊預約紀錄")

  .PageArchive__filter
    ElDatePicker(v-model="filter.dateFrom" value-format="YYYY-MM-DD" type="date" placeholder="起始日")
    span 至
    ElDatePicker(v-model="filter.dateTo" value-format="YYYY-MM-DD" type="date" placeholder="結束日")
    ElInput(
      v-model="filter.customerPhone"
      placeholder="顧客手機"
      maxlength="20"
      inputmode="numeric"
      style="width: 160px;"
    )
    ElButton(@click="ApiLoad") 查詢

  ElTable(:data="items" :loading="loading" stripe style="width: 100%;")
    ElTableColumn(label="時間" width="160")
      template(#default="{ row }")
        span {{ fmtDateTime(row.startAt) }}
    ElTableColumn(label="顧客" min-width="160")
      template(#default="{ row }")
        span {{ row.customerLastName }}{{ TitleLabel(row.customerTitle) }} ｜ {{ row.customerPhone }}
    ElTableColumn(label="狀態" prop="status" width="100")
    ElTableColumn(label="取消理由" prop="cancelReason" min-width="160")
    ElTableColumn(label="歸檔時間" width="160")
      template(#default="{ row }")
        span {{ fmtDateTime(row.archivedAt) }}

  .PageArchive__pager(v-if="total > filter.pageSize")
    ElPagination(
      v-model:current-page="filter.page"
      :page-size="filter.pageSize"
      :total="total"
      layout="prev, pager, next, total"
      @current-change="ApiLoad"
    )
</template>

<style lang="scss" scoped>
.PageArchive {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.PageArchive__filter {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 16px 18px;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageArchive__pager {
  display: flex;
  justify-content: center;
}
</style>
