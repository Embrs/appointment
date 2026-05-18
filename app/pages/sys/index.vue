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
  h1.PageSysIndex__title 平台管理員後台
  p.PageSysIndex__welcome 歡迎，{{ storeSelf.userName || '管理員' }}
  .PageSysIndex__cards
    NuxtLink.PageSysIndex__card.PageSysIndex__card--pending(to="/sys/merchants?status=PENDING")
      span.PageSysIndex__card-label 待審核商家
      span.PageSysIndex__card-value {{ loading ? '-' : pendingCount }}
      span.PageSysIndex__card-hint 點擊查看待審清單
    NuxtLink.PageSysIndex__card.PageSysIndex__card--active(to="/sys/merchants?status=ACTIVE")
      span.PageSysIndex__card-label 在線商家
      span.PageSysIndex__card-value {{ loading ? '-' : activeCount }}
      span.PageSysIndex__card-hint 點擊查看在線清單
    NuxtLink.PageSysIndex__card.PageSysIndex__card--admin(to="/sys/admins")
      span.PageSysIndex__card-label 管理員（啟用中）
      span.PageSysIndex__card-value {{ loading ? '-' : adminCount }}
      span.PageSysIndex__card-hint 點擊管理帳號
  .PageSysIndex__section
    h2.PageSysIndex__section-title 最近註冊
    .PageSysIndex__empty(v-if="!loading && recentMerchants.length === 0") 暫無商家
    ul.PageSysIndex__list(v-else)
      li.PageSysIndex__list-item(v-for="m in recentMerchants" :key="m.id")
        NuxtLink.PageSysIndex__list-link(:to="`/sys/merchants/${m.id}`")
          span.PageSysIndex__list-name {{ m.name }}
          span.PageSysIndex__list-meta {{ m.ownerEmail || '—' }}
          ElTag(:type="StatusTagType(m.status)" size="small") {{ StatusLabel(m.status) }}
</template>

<style lang="scss" scoped>
.PageSysIndex {
  padding: 8px;
}

.PageSysIndex__title {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.PageSysIndex__welcome {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #606266;
}

.PageSysIndex__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}

.PageSysIndex__card {
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

.PageSysIndex__card:hover {
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
}

.PageSysIndex__card--pending {
  border-left-color: #e6a23c;
}

.PageSysIndex__card--active {
  border-left-color: #67c23a;
}

.PageSysIndex__card--admin {
  border-left-color: #409eff;
}

.PageSysIndex__card-label {
  font-size: 13px;
  color: #606266;
}

.PageSysIndex__card-value {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
}

.PageSysIndex__card-hint {
  font-size: 12px;
  color: #909399;
}

.PageSysIndex__section {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}

.PageSysIndex__section-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.PageSysIndex__empty {
  color: #909399;
  font-size: 13px;
  padding: 12px 0;
}

.PageSysIndex__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.PageSysIndex__list-item {
  border-bottom: 1px solid #ebeef5;
}

.PageSysIndex__list-item:last-child {
  border-bottom: 0;
}

.PageSysIndex__list-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  text-decoration: none;
  color: inherit;
}

.PageSysIndex__list-name {
  flex: 1;
  font-size: 14px;
  color: #303133;
}

.PageSysIndex__list-meta {
  font-size: 12px;
  color: #909399;
}
</style>
