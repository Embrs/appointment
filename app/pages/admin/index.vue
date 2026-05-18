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
const loading = ref(true);

const serviceCount = computed(() => services.value.filter((s) => s.isActive).length);
const resourceCount = computed(() => resources.value.filter((r) => r.isActive).length);

const recentServices = computed(() =>
  [...services.value]
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, 5)
);

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
  } finally {
    loading.value = false;
  }
};

const BookingModeLabel = (mode: BookingModeType): string => {
  switch (mode) {
    case 'TIME_SLOT': return '固定時段';
    case 'TIME_CAPACITY': return '時段+人數';
    case 'RESOURCE': return '指定資源';
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
  h1.PageAdminIndex__title 商家後台
  p.PageAdminIndex__welcome 歡迎，{{ merchantInfo?.name || storeSelf.userName }}
  .PageAdminIndex__cards
    NuxtLink.PageAdminIndex__card.PageAdminIndex__card--service(to="/admin/services")
      span.PageAdminIndex__card-label 啟用服務
      span.PageAdminIndex__card-value {{ loading ? '—' : serviceCount }}
      span.PageAdminIndex__card-hint 點擊管理服務
    NuxtLink.PageAdminIndex__card.PageAdminIndex__card--resource(to="/admin/resources")
      span.PageAdminIndex__card-label 啟用資源
      span.PageAdminIndex__card-value {{ loading ? '—' : resourceCount }}
      span.PageAdminIndex__card-hint 點擊管理資源
    .PageAdminIndex__card.PageAdminIndex__card--placeholder
      span.PageAdminIndex__card-label 今日預約
      span.PageAdminIndex__card-value —
      span.PageAdminIndex__card-hint 將於下一階段（預約核心）開放
  .PageAdminIndex__section
    h2.PageAdminIndex__section-title 最近編輯的服務
    .PageAdminIndex__empty(v-if="!loading && recentServices.length === 0")
      | 尚未建立服務 ·
      NuxtLink(to="/admin/services") 建立第一個服務
    ul.PageAdminIndex__list(v-else)
      li.PageAdminIndex__list-item(v-for="s in recentServices" :key="s.id")
        NuxtLink.PageAdminIndex__list-link(to="/admin/services")
          span.PageAdminIndex__list-name {{ s.name }}
          ElTag(size="small" type="info") {{ BookingModeLabel(s.bookingMode) }}
          span.PageAdminIndex__list-meta {{ s.durationMinutes }} 分鐘
</template>

<style lang="scss" scoped>
.PageAdminIndex {
  padding: 8px;
}

.PageAdminIndex__title {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.PageAdminIndex__welcome {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #606266;
}

.PageAdminIndex__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}

.PageAdminIndex__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background-color: #fff;
  border-radius: 8px;
  border-left: 4px solid #909399;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s ease;
}

.PageAdminIndex__card:hover {
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
}

.PageAdminIndex__card--service {
  border-left-color: #409eff;
}

.PageAdminIndex__card--resource {
  border-left-color: #67c23a;
}

.PageAdminIndex__card--placeholder {
  border-left-color: #909399;
  opacity: 0.7;
  cursor: default;
}

.PageAdminIndex__card-label {
  font-size: 13px;
  color: #606266;
}

.PageAdminIndex__card-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
}

.PageAdminIndex__card-hint {
  font-size: 12px;
  color: #909399;
}

.PageAdminIndex__section {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}

.PageAdminIndex__section-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.PageAdminIndex__empty {
  color: #909399;
  font-size: 13px;
  padding: 12px 0;
}

.PageAdminIndex__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.PageAdminIndex__list-item {
  border-bottom: 1px solid #ebeef5;
}

.PageAdminIndex__list-item:last-child {
  border-bottom: 0;
}

.PageAdminIndex__list-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  text-decoration: none;
  color: inherit;
}

.PageAdminIndex__list-name {
  flex: 1;
  font-size: 14px;
  color: #303133;
}

.PageAdminIndex__list-meta {
  font-size: 12px;
  color: #909399;
}
</style>
