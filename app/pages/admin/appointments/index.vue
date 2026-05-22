<script setup lang="ts">
// PageAdminAppointments — 商家後台預約管理（行事曆 / 列表 同頁 toggle）
// 兩視圖獨立 filter：列表完整 filter（即時搜尋 + 400ms 防抖）；行事曆精簡為「服務 / 資源 / 隱藏已取消」
// 所有狀態操作（取消/完成/未到/修改）統一由 DrawerAppointmentInfo 提供
import { debounce } from 'lodash-es';

definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

type AdminViewMode = 'calendar' | 'list';

const ParseView = (v: unknown): AdminViewMode => (v === 'list' ? 'list' : 'calendar');

const view = ref<AdminViewMode>(ParseView(route.query.view));
watch(view, (next) => {
  const query = { ...route.query };
  if (next === 'calendar') delete query.view;
  else query.view = next;
  router.replace({ query });
});
watch(() => route.query.view, (q) => {
  const parsed = ParseView(q);
  if (parsed !== view.value) view.value = parsed;
});

// ====== 共用資料 ======

const loading = ref(false);
const items = ref<AppointmentItem[]>([]);
const total = ref(0);
const services = ref<{ id: string; name: string }[]>([]);
const resources = ref<{ id: string; name: string }[]>([]);
const merchantSlug = ref('');
const selfMerchant = ref<SelfMerchantFull | null>(null);

// 行事曆用：商家整週主規則、整日 closed 日期、override map
const merchantSchedule = ref<CalendarMerchantRule[]>([]);
const closedDates = ref<string[]>([]);
const overridesByDate = ref<Record<string, CalendarOverride>>({});

interface CalendarMerchantRule {
  weekday: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

interface CalendarOverride {
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
}

// 列表用完整 filter
const filter = reactive({
  dateFrom: $dayjs().format('YYYY-MM-DD'),
  dateTo: $dayjs().add(14, 'day').format('YYYY-MM-DD'),
  status: 'CONFIRMED' as '' | AppointmentStatusType,
  serviceId: '',
  resourceId: '',
  customerPhone: '',
  page: 1,
  pageSize: 50
});

// 列表 view 是否顯示已結案紀錄
// 改值後由 filter watcher 統一觸發 debounced ApiLoad（400ms），無需手動呼叫
const showArchived = ref(false);
watch(showArchived, (next) => {
  if (next) {
    filter.status = '';
    filter.dateFrom = $dayjs().subtract(90, 'day').format('YYYY-MM-DD');
  } else {
    filter.status = 'CONFIRMED';
    filter.dateFrom = $dayjs().format('YYYY-MM-DD');
  }
});

// 行事曆獨立 filter
const calendarFilter = reactive({
  serviceId: '',
  resourceId: '',
  hideCanceled: true
});

// view 切換時重新載入
watch(view, () => {
  filter.page = 1;
  ApiLoad();
});

// 列表 filter 即時搜尋（防抖 400ms）：任何欄位變動 → 重置 page=1 並重打 API
const ApiLoadDebounced = debounce(() => {
  filter.page = 1;
  ApiLoad();
}, 400);

watch(
  () => [
    filter.dateFrom,
    filter.dateTo,
    filter.status,
    filter.serviceId,
    filter.resourceId,
    filter.customerPhone
  ],
  () => {
    if (view.value === 'list') ApiLoadDebounced();
  }
);

onBeforeUnmount(() => {
  ApiLoadDebounced.cancel();
});

// 行事曆 anchor 對齊 ISO 週一
const calendarMode = ref<'week' | 'day'>('week');
const calendarAnchor = ref($dayjs().startOf('isoWeek').format('YYYY-MM-DD'));

// 行事曆篩選即時觸發
watch([() => calendarFilter.serviceId, () => calendarFilter.resourceId], () => {
  if (view.value === 'calendar') ApiLoad();
});
// 行事曆 anchor 變動觸發
watch(calendarAnchor, () => {
  if (view.value === 'calendar') ApiLoad();
});
watch(calendarMode, () => {
  if (view.value === 'calendar') ApiLoad();
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

const ApiLoadCalendarMeta = async () => {
  // 商家主規則
  const rulesRes = await $api.GetScheduleRules({ scope: 'MERCHANT' });
  if (rulesRes.status.code === $enum.apiStatus.success) {
    merchantSchedule.value = rulesRes.data.rules
      .filter((r) => r.scope === 'MERCHANT')
      .map((r) => ({
        weekday: r.weekday,
        startTime: r.startTime,
        endTime: r.endTime,
        isActive: r.isActive
      }));
  }
  // 休假
  const holidayRes = await $api.GetHolidayList();
  const holidayDates = holidayRes.status.code === $enum.apiStatus.success
    ? holidayRes.data.items.map((h) => $dayjs(h.date).format('YYYY-MM-DD'))
    : [];
  // override
  const ovRes = await $api.GetScheduleOverrides({
    from: $dayjs(calendarAnchor.value).subtract(7, 'day').format('YYYY-MM-DD'),
    to: $dayjs(calendarAnchor.value).add(21, 'day').format('YYYY-MM-DD'),
    scope: 'MERCHANT'
  });
  const ovs: Record<string, CalendarOverride> = {};
  const ovClosedDates: string[] = [];
  if (ovRes.status.code === $enum.apiStatus.success) {
    for (const item of ovRes.data.items) {
      const d = $dayjs(item.date).format('YYYY-MM-DD');
      ovs[d] = {
        isClosed: item.isClosed,
        startTime: item.startTime,
        endTime: item.endTime
      };
      if (item.isClosed) ovClosedDates.push(d);
    }
  }
  closedDates.value = [...holidayDates, ...ovClosedDates];
  overridesByDate.value = ovs;
};

// 行事曆視圖：依 anchor + mode 推算 dateFrom / dateTo
const CalendarRange = (): { dateFrom: string; dateTo: string } => {
  if (calendarMode.value === 'day') {
    return {
      dateFrom: calendarAnchor.value,
      dateTo: calendarAnchor.value
    };
  }
  const start = $dayjs(calendarAnchor.value).startOf('isoWeek');
  const end = start.add(6, 'day');
  return {
    dateFrom: start.format('YYYY-MM-DD'),
    dateTo: end.format('YYYY-MM-DD')
  };
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const inListView = view.value === 'list';
    const range = inListView ? null : CalendarRange();
    const res = await $api.GetAppointmentList({
      dateFrom: inListView ? (filter.dateFrom || undefined) : (range?.dateFrom),
      dateTo: inListView ? (filter.dateTo || undefined) : (range?.dateTo),
      status: inListView ? (filter.status || undefined) : undefined,
      serviceId: inListView ? (filter.serviceId || undefined) : (calendarFilter.serviceId || undefined),
      resourceId: inListView ? (filter.resourceId || undefined) : (calendarFilter.resourceId || undefined),
      customerPhone: inListView ? (filter.customerPhone || undefined) : undefined,
      page: inListView ? filter.page : 1,
      pageSize: inListView ? filter.pageSize : 200
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

// 行事曆視圖：套用「隱藏已取消」前端過濾，避免重打 API
const displayedItems = computed(() => {
  if (view.value !== 'calendar') return items.value;
  if (calendarFilter.hideCanceled) {
    return items.value.filter((a) => a.status !== 'CANCELED');
  }
  return items.value;
});

const ClickResetFilter = () => {
  // 清回初始狀態：日期區間、狀態、服務、資源、手機、頁碼全部重置
  filter.dateFrom = showArchived.value
    ? $dayjs().subtract(90, 'day').format('YYYY-MM-DD')
    : $dayjs().format('YYYY-MM-DD');
  filter.dateTo = $dayjs().add(14, 'day').format('YYYY-MM-DD');
  filter.status = showArchived.value ? '' : 'CONFIRMED';
  filter.serviceId = '';
  filter.resourceId = '';
  filter.customerPhone = '';
  filter.page = 1;
  // 強制立即送出（避免值與初始相同時 watch 不觸發、或值雖變但 debounce 還沒到時間）
  ApiLoadDebounced.cancel();
  ApiLoad();
};

const OpenCreateDialog = async (
  prefill?: { prefillDate?: string; prefillStartAt?: string }
) => {
  const result = await $open.DialogAppointmentCreate({
    slug: merchantSlug.value,
    prefillDate: prefill?.prefillDate,
    prefillStartAt: prefill?.prefillStartAt
  });
  if (result.done) ApiLoad();
};

const ApiLoadSelfMerchant = async () => {
  const res = await $api.GetSelfMerchant();
  if (res.status.code === $enum.apiStatus.success) {
    merchantSlug.value = res.data.merchant.slug;
    selfMerchant.value = res.data.merchant;
  }
};

const ClickCreate = () => OpenCreateDialog();
const ClickEmptyCell = (payload: { date: string; startAt?: string }) => {
  OpenCreateDialog({ prefillDate: payload.date, prefillStartAt: payload.startAt });
};

const ClickInfo = async (a: AppointmentItem) => {
  const result = await $open.DrawerAppointmentInfo({
    appointment: a,
    timezone: 'Asia/Taipei',
    slug: merchantSlug.value
  });
  if (result.done) ApiLoad();
};

const ClickGoArchive = () => router.push(localePath('/admin/appointments/archive'));

// 行事曆導覽：anchor 永遠對齊 ISO 週一（week 模式）或單日（day 模式）
const ClickCalPrev = () => {
  const step = calendarMode.value === 'day' ? 1 : 7;
  calendarAnchor.value = $dayjs(calendarAnchor.value).subtract(step, 'day').format('YYYY-MM-DD');
};
const ClickCalNext = () => {
  const step = calendarMode.value === 'day' ? 1 : 7;
  calendarAnchor.value = $dayjs(calendarAnchor.value).add(step, 'day').format('YYYY-MM-DD');
};
const ClickCalToday = () => {
  calendarAnchor.value = calendarMode.value === 'week'
    ? $dayjs().startOf('isoWeek').format('YYYY-MM-DD')
    : $dayjs().format('YYYY-MM-DD');
};

// 切換 week ↔ day：切回 week 時自動 normalize 回該週週一
watch(calendarMode, (next) => {
  if (next === 'week') {
    calendarAnchor.value = $dayjs(calendarAnchor.value).startOf('isoWeek').format('YYYY-MM-DD');
  }
});

onMounted(() => {
  ApiLoadSelfMerchant();
  ApiLoadServices();
  ApiLoadResources();
  ApiLoad();
  ApiLoadCalendarMeta();
});
</script>

<template lang="pug">
.PageAdminAppointments
  BizPageHeader(title="預約管理" subtitle="查詢、處理與代客預約")
    template(#actions)
      ElTooltip(:content="$t('appointment.tooltip.archive')" placement="bottom")
        ElButton.PageAdminAppointments__archiveBtn(link @click="ClickGoArchive") 歷史紀錄
      ElRadioGroup.PageAdminAppointments__viewSwitch(v-model="view")
        ElRadioButton(value="calendar") 行事曆
        ElTooltip(:content="$t('appointment.tooltip.list')" placement="bottom")
          ElRadioButton(value="list") 列表
      ElButton(type="primary" @click="ClickCreate") 代客預約

  //- 列表視圖：完整 filter
  .PageAdminAppointments__filter(v-if="view === 'list'")
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
    ElButton(plain @click="ClickResetFilter") 重設

  //- 行事曆視圖：精簡 filter（服務 / 資源 / 隱藏已取消）
  .PageAdminAppointments__filter.is-calendar(v-else)
    ElSelect(
      v-model="calendarFilter.serviceId"
      placeholder="服務"
      clearable
      value-on-clear=""
      style="width: 160px;"
    )
      ElOption(v-for="s in services" :key="s.id" :label="s.name" :value="s.id")
    ElSelect(
      v-model="calendarFilter.resourceId"
      placeholder="資源"
      clearable
      value-on-clear=""
      style="width: 140px;"
    )
      ElOption(v-for="r in resources" :key="r.id" :label="r.name" :value="r.id")
    .PageAdminAppointments__calSwitch
      ElSwitch(v-model="calendarFilter.hideCanceled")
      span.PageAdminAppointments__calSwitchLabel 隱藏已取消

  //- 行事曆 view
  template(v-if="view === 'calendar'")
    .PageAdminAppointments__cal-nav
      ElRadioGroup(v-model="calendarMode" size="small")
        ElRadioButton(value="week") 週
        ElRadioButton(value="day") 日
      .PageAdminAppointments__cal-buttons
        ElButton(plain size="small" @click="ClickCalPrev") ← 上一{{ calendarMode === 'day' ? '日' : '週' }}
        ElButton(plain size="small" @click="ClickCalToday") 今天
        ElButton(plain size="small" @click="ClickCalNext") 下一{{ calendarMode === 'day' ? '日' : '週' }} →
      .PageAdminAppointments__cal-anchor {{ calendarAnchor }}

    BizAppointmentCalendar(
      :items="displayedItems"
      :mode="calendarMode"
      :anchor-date="calendarAnchor"
      :merchant-schedule="merchantSchedule"
      :closed-dates="closedDates"
      :overrides-by-date="overridesByDate"
      @click-cell="ClickInfo"
      @click-empty-cell="ClickEmptyCell"
    )

  //- 列表 view
  template(v-else)
    .PageAdminAppointments__listToolbar
      ElTooltip(:content="$t('appointment.list.showArchivedHint')" placement="top")
        .PageAdminAppointments__archivedSwitch
          ElSwitch(v-model="showArchived")
          span.PageAdminAppointments__archivedLabel {{ $t('appointment.list.showArchived') }}

    BizAppointmentTable(
      :items="items"
      :loading="loading"
      :merchant="selfMerchant"
      @click-info="ClickInfo"
    )

    .PageAdminAppointments__pager(v-if="total > 0")
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

.PageAdminAppointments__filter.is-calendar {
  gap: 14px;
}

.PageAdminAppointments__calSwitch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.PageAdminAppointments__calSwitchLabel {
  font-size: 13px;
  color: rgba(53, 77, 123, 0.85);
}

.PageAdminAppointments__cal-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageAdminAppointments__cal-buttons {
  display: flex;
  gap: 6px;
}

.PageAdminAppointments__cal-anchor {
  margin-left: auto;
  font-size: 13.5px;
  font-weight: 600;
  color: $primary;
}

.PageAdminAppointments__pager {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.PageAdminAppointments__listToolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 4px 4px 0;
}

.PageAdminAppointments__archivedSwitch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.PageAdminAppointments__archivedLabel {
  font-size: 13px;
  color: rgba(53, 77, 123, 0.85);
}

.PageAdminAppointments__archiveBtn {
  font-size: 13px;
  color: rgba(53, 77, 123, 0.6);
  margin-right: 4px;

  &:hover {
    color: $primary;
  }
}

.PageAdminAppointments__viewSwitch :deep(.el-radio-button__inner) {
  padding: 10px 22px;
  font-size: 14.5px;
  font-weight: 600;
}
</style>
