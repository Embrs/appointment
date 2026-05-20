<script setup lang="ts">
// PageAdminSchedule — 排班整合頁:四 tab 容器(預約時段 / 單日調整 / 公休日 / 現場領號時段)
// Tab 依商家服務的 bookingMode 動態顯示;預設 tab 為當前可見的第一個
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

type TabKey = 'weekly' | 'overrides' | 'holidays' | 'queue-window';
const TAB_ORDER: TabKey[] = ['weekly', 'overrides', 'holidays', 'queue-window'];

const services = ref<ServiceItem[]>([]);
const servicesLoading = ref(true);

const activeServices = computed(() => services.value.filter((s) => s.isActive));
const hasNonQueueService = computed(() => activeServices.value.some((s) => s.bookingMode !== 'QUEUE'));
const hasQueueService = computed(() => activeServices.value.some((s) => s.bookingMode === 'QUEUE'));

const visibleTabs = computed<TabKey[]>(() => {
  const out: TabKey[] = [];
  if (hasNonQueueService.value) {
    out.push('weekly', 'overrides', 'holidays');
  }
  if (hasQueueService.value) {
    out.push('queue-window');
  }
  return out;
});

const isValidTab = (v: unknown): v is TabKey =>
  typeof v === 'string' && TAB_ORDER.includes(v as TabKey);

const activeTab = ref<TabKey>('weekly');

const ResolveTab = (): TabKey | null => {
  if (visibleTabs.value.length === 0) return null;
  const q = route.query.tab;
  if (isValidTab(q) && visibleTabs.value.includes(q)) return q;
  return visibleTabs.value[0]!;
};

const ApplyTabToUrl = (next: TabKey) => {
  if (route.query.tab === next) return;
  router.replace({ query: { ...route.query, tab: next } });
};

const ClickTab = (key: TabKey) => {
  activeTab.value = key;
  ApplyTabToUrl(key);
};

const TabLabel = (key: TabKey) => {
  const i18nKey = key === 'queue-window' ? 'queueWindow' : key;
  return t(`admin.schedule.tab.${i18nKey}`);
};

watch(() => route.query.tab, (next) => {
  if (visibleTabs.value.length === 0) return;
  const v = isValidTab(next) && visibleTabs.value.includes(next) ? next : visibleTabs.value[0]!;
  if (v !== activeTab.value) activeTab.value = v;
});

watch(visibleTabs, (next) => {
  // 若目前 tab 因服務變動而不再可見,fallback 到第一個可見 tab
  if (next.length === 0) return;
  if (!next.includes(activeTab.value)) {
    activeTab.value = next[0]!;
    ApplyTabToUrl(next[0]!);
  }
});

const ApiLoadServices = async () => {
  servicesLoading.value = true;
  try {
    const res = await $api.GetServiceList();
    if (res.status.code === $enum.apiStatus.success) {
      services.value = res.data.items;
    }
  } finally {
    servicesLoading.value = false;
  }
};

onMounted(async () => {
  await ApiLoadServices();
  const initial = ResolveTab();
  if (initial) {
    activeTab.value = initial;
    ApplyTabToUrl(initial);
  }
});
</script>

<template lang="pug">
.PageAdminSchedule
  BizPageHeader(
    :title="t('admin.schedule.title')"
    :subtitle="t('admin.schedule.subtitle')"
  )

  //- 無任何啟用服務:中央 empty state
  .PageAdminSchedule__empty(v-if="!servicesLoading && visibleTabs.length === 0")
    p {{ t('admin.schedule.emptyNoService') }}
    NuxtLinkLocale.PageAdminSchedule__emptyLink(to="/admin/services") {{ t('admin.schedule.goCreateService') }}

  template(v-else)
    .PageAdminSchedule__tabs(role="tablist")
      button.PageAdminSchedule__tab(
        v-for="key in visibleTabs"
        :key="key"
        type="button"
        role="tab"
        :class="{ 'PageAdminSchedule__tab--active': activeTab === key }"
        :data-tab="key"
        :data-testid="`schedule-tab-${key}`"
        @click="ClickTab(key)"
      ) {{ TabLabel(key) }}

    .PageAdminSchedule__panel
      BizScheduleWeeklyPanel(
        v-if="visibleTabs.includes('weekly')"
        v-show="activeTab === 'weekly'"
        :services="services"
      )
      BizScheduleOverridesPanel(
        v-if="visibleTabs.includes('overrides')"
        v-show="activeTab === 'overrides'"
        :services="services"
      )
      BizScheduleHolidaysPanel(
        v-if="visibleTabs.includes('holidays')"
        v-show="activeTab === 'holidays'"
        :services="services"
      )
      BizScheduleQueueWindowPanel(
        v-if="visibleTabs.includes('queue-window')"
        v-show="activeTab === 'queue-window'"
        :services="services"
      )
</template>

<style lang="scss" scoped>
.PageAdminSchedule {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageAdminSchedule__tabs {
  display: flex;
  gap: 4px;
  background-color: $white;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  overflow-x: auto;
}

.PageAdminSchedule__tab {
  flex-shrink: 0;
  padding: 8px 18px;
  font-size: 13.5px;
  font-weight: 500;
  background-color: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: rgba(69, 69, 69, 0.7);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.PageAdminSchedule__tab:hover {
  background-color: rgba(53, 77, 123, 0.05);
  color: $primary;
}

.PageAdminSchedule__tab--active {
  background-color: $primary;
  color: $white;
  font-weight: 600;
}

.PageAdminSchedule__tab--active:hover {
  background-color: $primary;
  color: $white;
}

.PageAdminSchedule__panel {
  display: block;
}

.PageAdminSchedule__empty {
  background-color: $white;
  padding: 48px 24px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  text-align: center;
  color: rgba(69, 69, 69, 0.65);
}

.PageAdminSchedule__emptyLink {
  display: inline-block;
  margin-top: 10px;
  color: $primary;
  text-decoration: underline;
  font-weight: 500;
}
</style>
