<script setup lang="ts">
// PageAdminAppointmentsArchive — 商家歷史紀錄查詢
// 即時搜尋（400ms 防抖），任一篩選變動 → 頁碼回到第一頁；換頁不重設篩選；查詢中顯示 loading
import { debounce } from 'lodash-es';

definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const router = useRouter();
const localePath = useLocalePath();
const { t } = useI18n();

const loading = ref(false);
const items = ref<AppointmentArchiveItem[]>([]);
const total = ref(0);

const initialFilter = () => ({
  dateFrom: $dayjs().subtract(6, 'month').format('YYYY-MM-DD'),
  dateTo: $dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
  customerPhone: ''
});

const filter = reactive({
  ...initialFilter(),
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

// 即時搜尋（400ms 防抖）：任一篩選變動 → 重置 page=1 並重打 API
const ApiLoadDebounced = debounce(() => {
  filter.page = 1;
  ApiLoad();
}, 400);

watch(
  () => [filter.dateFrom, filter.dateTo, filter.customerPhone],
  () => { ApiLoadDebounced(); }
);

onBeforeUnmount(() => {
  ApiLoadDebounced.cancel();
});

const ClickResetFilter = () => {
  Object.assign(filter, initialFilter());
  filter.page = 1;
  ApiLoadDebounced.cancel();
  ApiLoad();
};

const StatusLabel = (status: string) => t(`appointment.status.${status}`, status);
const TitleLabel = (title: string) => (title ? t(`appointment.customerTitle.${title}`, '') : '');

const fmtDateTime = (iso: string) => $dayjs(new Date(iso)).format('YYYY-MM-DD HH:mm');

const ClickBack = () => router.push(localePath('/admin/appointments'));

onMounted(ApiLoad);
</script>

<template lang="pug">
.PageArchive
  BizPageHeader(title="歷史紀錄" subtitle="查詢已歸檔的舊預約紀錄")
    template(#actions)
      ElButton(plain @click="ClickBack") {{ $t('appointment.actions.backToMain') }}

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
    ElButton(plain @click="ClickResetFilter") 重設

  ElTable(
    v-loading="loading"
    :data="items"
    stripe
    element-loading-text="查詢中…"
    style="width: 100%;"
  )
    ElTableColumn(label="時間" width="160")
      template(#default="{ row }")
        span {{ fmtDateTime(row.startAt) }}
    ElTableColumn(label="顧客" min-width="160")
      template(#default="{ row }")
        span {{ row.customerLastName }}{{ TitleLabel(row.customerTitle) }} ｜ {{ row.customerPhone }}
    ElTableColumn(label="狀態" width="100")
      template(#default="{ row }")
        span {{ StatusLabel(row.status) }}
    ElTableColumn(label="取消理由" prop="cancelReason" min-width="160")
    ElTableColumn(label="歸檔時間" width="160")
      template(#default="{ row }")
        span {{ fmtDateTime(row.archivedAt) }}

  .PageArchive__pager(v-if="total > 0")
    ElPagination(
      v-model:current-page="filter.page"
      :page-size="filter.pageSize"
      :total="total"
      :pager-count="7"
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
