<script setup lang="ts">
// PageSysIndex — 平台管理員後台首頁
// 三張卡：待審核 / 在線 / 管理員數；最近 5 筆商家連結
definePageMeta({
  layout: 'back-desk',
  middleware: ['admin']
});

const storeSelf = StoreSelf();

const loading = ref(true);
const pendingCount = ref(0);
const activeCount = ref(0);
const adminCount = ref(0);
const recentMerchants = ref<SysMerchantItem[]>([]);

const ApiLoad = async () => {
  loading.value = true;
  try {
    const [pending, active, admins, recent] = await Promise.all([
      $api.SysGetMerchantList({ status: 'PENDING', pageSize: 1 }),
      $api.SysGetMerchantList({ status: 'ACTIVE', pageSize: 1 }),
      $api.GetAdminList(),
      $api.SysGetMerchantList({ status: 'ALL', pageSize: 5 })
    ]);
    if (pending.status.code === $enum.apiStatus.success) {
      pendingCount.value = pending.data.total ?? 0;
    }
    if (active.status.code === $enum.apiStatus.success) {
      activeCount.value = active.data.total ?? 0;
    }
    if (admins.status.code === $enum.apiStatus.success) {
      adminCount.value = (admins.data.items ?? []).filter((a) => a.isActive).length;
    }
    if (recent.status.code === $enum.apiStatus.success) {
      recentMerchants.value = recent.data.items ?? [];
    }
  } finally {
    loading.value = false;
  }
};

const StatusLabel = (status: MerchantStatusType): string => {
  switch (status) {
    case 'PENDING': return '待審核';
    case 'ACTIVE': return '在線';
    case 'SUSPENDED': return '停用';
    case 'REJECTED': return '已拒絕';
    default: return status;
  }
};

const StatusTagType = (status: MerchantStatusType): 'warning' | 'success' | 'info' | 'danger' => {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'ACTIVE': return 'success';
    case 'SUSPENDED': return 'info';
    case 'REJECTED': return 'danger';
    default: return 'info';
  }
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageSysIndex
  //- 頁首
  header.PageSysIndex__head
    .PageSysIndex__headMain
      .PageSysIndex__eyebrow 平台總覽
      h1.PageSysIndex__title 歡迎回來，{{ storeSelf.userName || '管理員' }}
      p.PageSysIndex__lead 一覽商家審核狀態、在線商家數量與管理員帳號。
    .PageSysIndex__headActions
      NuxtLink.PageSysIndex__headAction(to="/sys/merchants?status=PENDING") 處理待審核
      NuxtLink.PageSysIndex__headAction.PageSysIndex__headAction--ghost(to="/sys/admins") 管理員帳號

  //- 統計卡片
  .PageSysIndex__cards
    NuxtLink.PageSysIndex__card.PageSysIndex__card--pending(to="/sys/merchants?status=PENDING")
      .PageSysIndex__cardHeader
        .PageSysIndex__cardBadge 待處理
        .PageSysIndex__cardArrow →
      .PageSysIndex__cardValue {{ loading ? '–' : pendingCount }}
      .PageSysIndex__cardLabel 待審核商家
      .PageSysIndex__cardHint 點擊查看待審清單

    NuxtLink.PageSysIndex__card.PageSysIndex__card--active(to="/sys/merchants?status=ACTIVE")
      .PageSysIndex__cardHeader
        .PageSysIndex__cardBadge 在線
        .PageSysIndex__cardArrow →
      .PageSysIndex__cardValue {{ loading ? '–' : activeCount }}
      .PageSysIndex__cardLabel 在線商家
      .PageSysIndex__cardHint 點擊查看在線清單

    NuxtLink.PageSysIndex__card.PageSysIndex__card--admin(to="/sys/admins")
      .PageSysIndex__cardHeader
        .PageSysIndex__cardBadge 啟用中
        .PageSysIndex__cardArrow →
      .PageSysIndex__cardValue {{ loading ? '–' : adminCount }}
      .PageSysIndex__cardLabel 管理員帳號
      .PageSysIndex__cardHint 點擊管理帳號

  //- 最近註冊區塊
  section.PageSysIndex__section
    header.PageSysIndex__sectionHead
      h2.PageSysIndex__sectionTitle 最近註冊
      NuxtLink.PageSysIndex__sectionMore(to="/sys/merchants") 查看全部 →
    .PageSysIndex__empty(v-if="!loading && recentMerchants.length === 0") 暫無商家
    ul.PageSysIndex__list(v-else)
      li.PageSysIndex__listItem(v-for="m in recentMerchants" :key="m.id")
        NuxtLink.PageSysIndex__listLink(:to="`/sys/merchants/${m.id}`")
          .PageSysIndex__listAvatar {{ (m.name || '?').charAt(0).toUpperCase() }}
          .PageSysIndex__listInfo
            .PageSysIndex__listName {{ m.name }}
            .PageSysIndex__listMeta {{ m.ownerEmail || '—' }}
          ElTag(:type="StatusTagType(m.status)" size="small" effect="light") {{ StatusLabel(m.status) }}
</template>

<style lang="scss" scoped>
.PageSysIndex {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

// 頁首 ----
.PageSysIndex__head {
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

.PageSysIndex__head::before {
  content: '';
  position: absolute;
  top: -80px;
  right: -60px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(235, 139, 45, 0.25), transparent 60%);
  pointer-events: none;
}

.PageSysIndex__head::after {
  content: '';
  position: absolute;
  bottom: -100px;
  left: -40px;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 173, 169, 0.25), transparent 60%);
  pointer-events: none;
}

.PageSysIndex__headMain {
  position: relative;
  max-width: 560px;
}

.PageSysIndex__eyebrow {
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

.PageSysIndex__title {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.005em;
}

.PageSysIndex__lead {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.75);
}

.PageSysIndex__headActions {
  position: relative;
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.PageSysIndex__headAction {
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

.PageSysIndex__headAction:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px -10px rgba(0, 0, 0, 0.35);
}

.PageSysIndex__headAction--ghost {
  background-color: rgba(255, 255, 255, 0.12);
  color: $white;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.PageSysIndex__headAction--ghost:hover {
  background-color: rgba(255, 255, 255, 0.22);
}

// 統計卡片 ----
.PageSysIndex__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.PageSysIndex__card {
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

.PageSysIndex__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: $primary;
}

.PageSysIndex__card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 32px -16px rgba(31, 42, 68, 0.2);
  border-color: rgba(53, 77, 123, 0.18);
}

.PageSysIndex__card--pending::before {
  background: linear-gradient(180deg, $tertiary, #f0a85d);
}

.PageSysIndex__card--active::before {
  background: linear-gradient(180deg, $secondary, #5fc6c3);
}

.PageSysIndex__card--admin::before {
  background: linear-gradient(180deg, $primary, #2a3d62);
}

.PageSysIndex__cardHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.PageSysIndex__cardBadge {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: 999px;
  background-color: rgba(53, 77, 123, 0.08);
  color: $primary;
}

.PageSysIndex__card--pending .PageSysIndex__cardBadge {
  background-color: rgba(235, 139, 45, 0.12);
  color: $tertiary;
}

.PageSysIndex__card--active .PageSysIndex__cardBadge {
  background-color: rgba(0, 173, 169, 0.12);
  color: $secondary;
}

.PageSysIndex__cardArrow {
  font-size: 16px;
  color: rgba(53, 77, 123, 0.3);
  transition: transform 0.15s ease, color 0.15s ease;
}

.PageSysIndex__card:hover .PageSysIndex__cardArrow {
  transform: translateX(3px);
  color: $primary;
}

.PageSysIndex__cardValue {
  font-size: 36px;
  font-weight: 700;
  color: $primary;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.PageSysIndex__cardLabel {
  font-size: 14px;
  font-weight: 600;
  color: $font;
  margin-top: 2px;
}

.PageSysIndex__cardHint {
  font-size: 12px;
  color: rgba(69, 69, 69, 0.55);
  margin-top: 2px;
}

// 區塊 ----
.PageSysIndex__section {
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  padding: 24px 28px;
}

.PageSysIndex__sectionHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.PageSysIndex__sectionTitle {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: $primary;
}

.PageSysIndex__sectionMore {
  font-size: 12.5px;
  color: $primary;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s ease;
}

.PageSysIndex__sectionMore:hover {
  color: $secondary;
}

.PageSysIndex__empty {
  color: rgba(69, 69, 69, 0.55);
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}

.PageSysIndex__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.PageSysIndex__listItem {
  border-bottom: 1px solid rgba(53, 77, 123, 0.06);
}

.PageSysIndex__listItem:last-child {
  border-bottom: 0;
}

.PageSysIndex__listLink {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  text-decoration: none;
  color: inherit;
  transition: padding 0.12s ease;
}

.PageSysIndex__listLink:hover {
  padding-left: 4px;
}

.PageSysIndex__listAvatar {
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

.PageSysIndex__listInfo {
  flex: 1;
  min-width: 0;
}

.PageSysIndex__listName {
  font-size: 14px;
  font-weight: 600;
  color: $font;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.PageSysIndex__listMeta {
  font-size: 12px;
  color: rgba(69, 69, 69, 0.55);
  margin-top: 2px;
}

// RWD ----
@media (max-width: 760px) {
  .PageSysIndex__head {
    flex-direction: column;
    align-items: stretch;
    padding: 20px;
  }

  .PageSysIndex__title {
    font-size: 22px;
  }

  .PageSysIndex__headActions {
    flex-direction: column;
  }

  .PageSysIndex__section {
    padding: 20px;
  }
}
</style>
