<script setup lang="ts">
// PageAdminIndex — 商家後台 Dashboard
// 三張卡片：服務數 / 資源數 / 今日預約數（預留為「即將上線」）
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const storeSelf = StoreSelf();
const merchantInfo = ref<SelfMerchantFull | null>(null);
const services = ref<ServiceItem[]>([]);
const resources = ref<ResourceItem[]>([]);
const todayAppointmentCount = ref<number | null>(null);
const loading = ref(true);

const serviceCount = computed(() => services.value.filter((s) => s.isActive).length);
const resourceCount = computed(() => resources.value.filter((r) => r.isActive).length);

const recentServices = computed(() =>
  [...services.value]
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, 5)
);

const ApiLoadTodayAppointments = async (timezone: string) => {
  const today = $dayjs().tz(timezone).format('YYYY-MM-DD');
  const res = await $api.GetAppointmentList({
    dateFrom: today,
    dateTo: today,
    status: 'CONFIRMED',
    pageSize: 1
  });
  if (res.status.code === $enum.apiStatus.success) {
    todayAppointmentCount.value = res.data.total;
  } else {
    todayAppointmentCount.value = null;
  }
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const [m, s, r] = await Promise.all([
      $api.GetSelfMerchant(),
      $api.GetServiceList(),
      $api.GetResourceList()
    ]);
    if (m.status.code === $enum.apiStatus.success) merchantInfo.value = m.data.merchant;
    if (s.status.code === $enum.apiStatus.success) services.value = s.data.items;
    if (r.status.code === $enum.apiStatus.success) resources.value = r.data.items;
    // 今日預約數需在拿到 merchant timezone 後計算（避免用瀏覽器時區）
    const tz = merchantInfo.value?.timezone || 'Asia/Taipei';
    await ApiLoadTodayAppointments(tz);
  } finally {
    loading.value = false;
  }
};

const BookingModeLabel = (mode: BookingModeType): string => {
  switch (mode) {
    case 'TIME_SLOT': return '固定時段';
    case 'TIME_CAPACITY': return '時段+人數';
    case 'RESOURCE': return '指定資源';
    case 'RESOURCE_OPTIONAL': return '可選資源';
    case 'QUEUE': return '號碼牌';
    default: return mode;
  }
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminIndex
  //- 頁首
  header.PageAdminIndex__head
    .PageAdminIndex__headMain
      .PageAdminIndex__eyebrow 商家後台
      h1.PageAdminIndex__title 歡迎，{{ merchantInfo?.name || storeSelf.userName }}
      p.PageAdminIndex__lead 管理服務、資源、員工與排班，所有預約一站式搞定。
    .PageAdminIndex__headActions
      NuxtLinkLocale.PageAdminIndex__headAction(to="/admin/services") 管理服務
      NuxtLinkLocale.PageAdminIndex__headAction.PageAdminIndex__headAction--ghost(to="/admin/share-link") 對外連結

  //- 統計卡片
  .PageAdminIndex__cards
    NuxtLinkLocale.PageAdminIndex__card.PageAdminIndex__card--service(to="/admin/services")
      .PageAdminIndex__cardHeader
        .PageAdminIndex__cardBadge 服務
        .PageAdminIndex__cardArrow →
      .PageAdminIndex__cardValue {{ loading ? '–' : serviceCount }}
      .PageAdminIndex__cardLabel 啟用服務
      .PageAdminIndex__cardHint 點擊管理服務

    NuxtLinkLocale.PageAdminIndex__card.PageAdminIndex__card--resource(to="/admin/resources")
      .PageAdminIndex__cardHeader
        .PageAdminIndex__cardBadge 資源
        .PageAdminIndex__cardArrow →
      .PageAdminIndex__cardValue {{ loading ? '–' : resourceCount }}
      .PageAdminIndex__cardLabel 啟用資源
      .PageAdminIndex__cardHint 點擊管理資源

    NuxtLinkLocale.PageAdminIndex__card.PageAdminIndex__card--appointment(to="/admin/appointments")
      .PageAdminIndex__cardHeader
        .PageAdminIndex__cardBadge 今日
        .PageAdminIndex__cardArrow →
      .PageAdminIndex__cardValue {{ loading ? '–' : (todayAppointmentCount ?? '—') }}
      .PageAdminIndex__cardLabel 今日預約
      .PageAdminIndex__cardHint 點擊查看預約管理

  //- 最近編輯的服務
  section.PageAdminIndex__section
    header.PageAdminIndex__sectionHead
      h2.PageAdminIndex__sectionTitle 最近編輯的服務
      NuxtLinkLocale.PageAdminIndex__sectionMore(to="/admin/services") 查看全部 →
    .PageAdminIndex__empty(v-if="!loading && recentServices.length === 0")
      | 尚未建立服務 ·
      NuxtLinkLocale.PageAdminIndex__emptyLink(to="/admin/services")  建立第一個服務 →
    ul.PageAdminIndex__list(v-else)
      li.PageAdminIndex__listItem(v-for="s in recentServices" :key="s.id")
        NuxtLinkLocale.PageAdminIndex__listLink(to="/admin/services")
          .PageAdminIndex__listAvatar {{ (s.name || '?').charAt(0).toUpperCase() }}
          .PageAdminIndex__listInfo
            .PageAdminIndex__listName {{ s.name }}
            .PageAdminIndex__listMeta {{ s.durationMinutes }} 分鐘
          ElTag(size="small" type="info" effect="light") {{ BookingModeLabel(s.bookingMode) }}
</template>

<style lang="scss" scoped>
.PageAdminIndex {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

// 頁首 ----
.PageAdminIndex__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  padding: 24px 28px;
  background: linear-gradient(135deg, $primary 0%, #2a3d62 60%, #1d2c4a 100%);
  color: $white;
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}

.PageAdminIndex__head::before {
  content: '';
  position: absolute;
  top: -80px;
  right: -60px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 173, 169, 0.28), transparent 60%);
  pointer-events: none;
}

.PageAdminIndex__head::after {
  content: '';
  position: absolute;
  bottom: -100px;
  left: -40px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(235, 139, 45, 0.2), transparent 60%);
  pointer-events: none;
}

.PageAdminIndex__headMain {
  position: relative;
  max-width: 560px;
}

.PageAdminIndex__eyebrow {
  display: inline-flex;
  padding: 5px 12px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.9);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  margin-bottom: 14px;
}

.PageAdminIndex__title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.005em;
}

.PageAdminIndex__lead {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.75);
}

.PageAdminIndex__headActions {
  position: relative;
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.PageAdminIndex__headAction {
  display: inline-flex;
  align-items: center;
  padding: 9px 16px;
  border-radius: 8px;
  background-color: $white;
  color: $primary;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.12s ease, box-shadow 0.15s ease;
}

.PageAdminIndex__headAction:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -10px rgba(0, 0, 0, 0.35);
}

.PageAdminIndex__headAction--ghost {
  background-color: rgba(255, 255, 255, 0.12);
  color: $white;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.PageAdminIndex__headAction--ghost:hover {
  background-color: rgba(255, 255, 255, 0.22);
}

// 統計卡片 ----
.PageAdminIndex__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.PageAdminIndex__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px 22px 20px;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.PageAdminIndex__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: $primary;
}

.PageAdminIndex__card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 32px -16px rgba(31, 42, 68, 0.2);
  border-color: rgba(53, 77, 123, 0.18);
}

.PageAdminIndex__card--service::before {
  background: linear-gradient(180deg, $primary, #2a3d62);
}

.PageAdminIndex__card--resource::before {
  background: linear-gradient(180deg, $secondary, #5fc6c3);
}

.PageAdminIndex__card--appointment::before {
  background: linear-gradient(180deg, #eb8b2d, #f4a85c);
}

.PageAdminIndex__cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.PageAdminIndex__cardBadge {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: 999px;
  background-color: rgba(53, 77, 123, 0.08);
  color: $primary;
}

.PageAdminIndex__card--resource .PageAdminIndex__cardBadge {
  background-color: rgba(0, 173, 169, 0.12);
  color: $secondary;
}

.PageAdminIndex__card--appointment .PageAdminIndex__cardBadge {
  background-color: rgba(235, 139, 45, 0.14);
  color: #eb8b2d;
}

.PageAdminIndex__cardArrow {
  font-size: 16px;
  color: rgba(53, 77, 123, 0.3);
  transition: transform 0.15s ease, color 0.15s ease;
}

.PageAdminIndex__card:hover .PageAdminIndex__cardArrow {
  transform: translateX(3px);
  color: $primary;
}

.PageAdminIndex__cardValue {
  font-size: 36px;
  font-weight: 700;
  color: $primary;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.PageAdminIndex__cardLabel {
  font-size: 14px;
  font-weight: 600;
  color: $font;
  margin-top: 2px;
}

.PageAdminIndex__cardHint {
  font-size: 12px;
  color: rgba(69, 69, 69, 0.55);
  margin-top: 2px;
}

// 區塊 ----
.PageAdminIndex__section {
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  padding: 24px 28px;
}

.PageAdminIndex__sectionHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.PageAdminIndex__sectionTitle {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: $primary;
}

.PageAdminIndex__sectionMore {
  font-size: 12.5px;
  color: $primary;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s ease;
}

.PageAdminIndex__sectionMore:hover {
  color: $secondary;
}

.PageAdminIndex__empty {
  color: rgba(69, 69, 69, 0.6);
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}

.PageAdminIndex__emptyLink {
  color: $primary;
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
}

.PageAdminIndex__emptyLink:hover {
  color: $secondary;
}

.PageAdminIndex__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.PageAdminIndex__listItem {
  border-bottom: 1px solid rgba(53, 77, 123, 0.06);
}

.PageAdminIndex__listItem:last-child {
  border-bottom: 0;
}

.PageAdminIndex__listLink {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  text-decoration: none;
  color: inherit;
  transition: padding 0.12s ease;
}

.PageAdminIndex__listLink:hover {
  padding-left: 4px;
}

.PageAdminIndex__listAvatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, $primary, $secondary);
  color: $white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.PageAdminIndex__listInfo {
  flex: 1;
  min-width: 0;
}

.PageAdminIndex__listName {
  font-size: 14px;
  font-weight: 600;
  color: $font;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.PageAdminIndex__listMeta {
  font-size: 12px;
  color: rgba(69, 69, 69, 0.55);
  margin-top: 2px;
}

// RWD ----
@media (max-width: 760px) {
  .PageAdminIndex__head {
    flex-direction: column;
    align-items: stretch;
    padding: 20px;
  }

  .PageAdminIndex__title {
    font-size: 22px;
  }

  .PageAdminIndex__headActions {
    flex-direction: column;
  }

  .PageAdminIndex__section {
    padding: 20px;
  }
}
</style>
