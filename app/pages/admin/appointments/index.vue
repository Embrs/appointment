<script setup lang="ts">
// PageAdminAppointments — 商家後台預約管理（行事曆 / 列表 同頁 toggle）
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const storeSelf = StoreSelf();

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

// 列表 view 是否顯示已結案紀錄（CANCELED / COMPLETED / NO_SHOW）
// 預設關閉 → 列表只顯示 CONFIRMED + 今日起
// 開啟 → 清空 status 篩選、dateFrom 擴展至 90 天前
const showArchived = ref(false);
watch(showArchived, (next) => {
  if (next) {
    filter.status = '';
    filter.dateFrom = $dayjs().subtract(90, 'day').format('YYYY-MM-DD');
  } else {
    filter.status = 'CONFIRMED';
    filter.dateFrom = $dayjs().format('YYYY-MM-DD');
  }
  filter.page = 1;
  ApiLoad();
});

// view 切換時重新載入，避免兩 view 顯示策略不一致
watch(view, () => {
  filter.page = 1;
  ApiLoad();
});

// 行事曆 anchor（與 filter.dateFrom 解耦：行事曆自己一個 anchor）
const calendarMode = ref<'week' | 'day'>('week');
const calendarAnchor = ref(filter.dateFrom);

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
  // 取商家主規則（用於判斷營業時段斜紋）
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
  // 取休假
  const holidayRes = await $api.GetHolidayList();
  const holidayDates = holidayRes.status.code === $enum.apiStatus.success
    ? holidayRes.data.items.map((h) => $dayjs(h.date).format('YYYY-MM-DD'))
    : [];
  // 取 override（取一個夠寬的區間）
  const ovRes = await $api.GetScheduleOverrides({
    from: $dayjs(filter.dateFrom).subtract(7, 'day').format('YYYY-MM-DD'),
    to: $dayjs(filter.dateTo).add(7, 'day').format('YYYY-MM-DD'),
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

const ApiLoad = async () => {
  loading.value = true;
  try {
    // 行事曆 view 一律顯示所有狀態（避免格子空白），列表 view 套用 filter.status
    const inListView = view.value === 'list';
    const res = await $api.GetAppointmentList({
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
      status: inListView ? (filter.status || undefined) : undefined,
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
  // 重設保留「列表預設過濾」語意：未開 showArchived 時 status 回到 CONFIRMED
  filter.status = showArchived.value ? '' : 'CONFIRMED';
  filter.serviceId = '';
  filter.resourceId = '';
  filter.customerPhone = '';
  filter.page = 1;
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
  }
};

const ClickCreate = () => OpenCreateDialog();
const ClickEmptyCell = (payload: { date: string; startAt?: string }) => {
  OpenCreateDialog({ prefillDate: payload.date, prefillStartAt: payload.startAt });
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

const ClickComplete = async (a: AppointmentItem) => {
  try {
    await ElMessageBox.confirm('確定將此預約標記為已完成？', '標記完成', {
      confirmButtonText: '確認',
      cancelButtonText: '取消',
      type: 'success'
    });
  } catch {
    return;
  }
  const res = await $api.CompleteAppointment({ id: a.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '標記失敗');
    return;
  }
  ElMessage.success('已標記為完成');
  ApiLoad();
};

const ClickNoShow = async (a: AppointmentItem) => {
  try {
    await ElMessageBox.confirm('確定將此預約標記為未到？', '標記未到', {
      confirmButtonText: '確認',
      cancelButtonText: '取消',
      type: 'warning'
    });
  } catch {
    return;
  }
  const res = await $api.NoShowAppointment({ id: a.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '標記失敗');
    return;
  }
  ElMessage.success('已標記為未到');
  ApiLoad();
};

const ClickGoArchive = () => router.push(localePath('/admin/appointments/archive'));

// 行事曆導覽
const ClickCalPrev = () => {
  const step = calendarMode.value === 'day' ? 1 : 7;
  calendarAnchor.value = $dayjs(calendarAnchor.value).subtract(step, 'day').format('YYYY-MM-DD');
};
const ClickCalNext = () => {
  const step = calendarMode.value === 'day' ? 1 : 7;
  calendarAnchor.value = $dayjs(calendarAnchor.value).add(step, 'day').format('YYYY-MM-DD');
};
const ClickCalToday = () => {
  calendarAnchor.value = $dayjs().format('YYYY-MM-DD');
};

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
      ElRadioGroup(v-model="view" size="small")
        ElRadioButton(value="calendar") 行事曆
        ElTooltip(:content="$t('appointment.tooltip.list')" placement="bottom")
          ElRadioButton(value="list") 列表
      ElTooltip(:content="$t('appointment.tooltip.archive')" placement="bottom")
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
      :items="items"
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
      @click-info="ClickInfo"
      @click-cancel="ClickCancel"
      @click-complete="ClickComplete"
      @click-no-show="ClickNoShow"
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
</style>
