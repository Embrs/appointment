<script setup lang="ts">
// PageSysMerchantsIndex — 平台後台：商家列表
// Tabs（ALL/PENDING/ACTIVE/SUSPENDED/REJECTED）+ 關鍵字 + 分頁
definePageMeta({
  layout: 'back-desk',
  middleware: ['admin']
});

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const useAsk = UseAsk();

const QueryStatus = (raw: unknown): MerchantStatusFilter => {
  if (raw === 'PENDING' || raw === 'ACTIVE' || raw === 'SUSPENDED' || raw === 'REJECTED') return raw;
  return 'ALL';
};

const status = ref<MerchantStatusFilter>(QueryStatus(route.query.status));
const keyword = ref<string>(typeof route.query.keyword === 'string' ? route.query.keyword : '');
const page = ref<number>(Number(route.query.page) || 1);
const pageSize = 20;

const loading = ref(false);
const items = ref<SysMerchantItem[]>([]);
const total = ref(0);

const SyncQuery = () => {
  router.replace({
    path: localePath('/sys/merchants'),
    query: {
      status: status.value === 'ALL' ? undefined : status.value,
      keyword: keyword.value || undefined,
      page: page.value > 1 ? String(page.value) : undefined
    }
  });
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.SysGetMerchantList({
      status: status.value,
      keyword: keyword.value.trim() || undefined,
      page: page.value,
      pageSize
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '載入失敗');
      return;
    }
    items.value = res.data.items ?? [];
    total.value = res.data.total ?? 0;
  } finally {
    loading.value = false;
  }
};

const ClickTab = (next: MerchantStatusFilter) => {
  status.value = next;
  page.value = 1;
  SyncQuery();
  ApiLoad();
};

const ClickSearch = () => {
  page.value = 1;
  SyncQuery();
  ApiLoad();
};

const ClickPage = (next: number) => {
  page.value = next;
  SyncQuery();
  ApiLoad();
};

const StatusLabel = (s: MerchantStatusType): string => {
  switch (s) {
    case 'PENDING': return '待審核';
    case 'ACTIVE': return '在線';
    case 'SUSPENDED': return '停用';
    case 'REJECTED': return '已拒絕';
    default: return s;
  }
};

const StatusTagType = (s: MerchantStatusType): 'warning' | 'success' | 'info' | 'danger' => {
  switch (s) {
    case 'PENDING': return 'warning';
    case 'ACTIVE': return 'success';
    case 'SUSPENDED': return 'info';
    case 'REJECTED': return 'danger';
    default: return 'info';
  }
};

const ClickApprove = async (row: SysMerchantItem) => {
  const res = await $open.DialogMerchantApprove({
    mode: 'approve',
    merchantId: row.id,
    merchantName: row.name
  });
  if (res.done) ApiLoad();
};

const ClickReject = async (row: SysMerchantItem) => {
  const res = await $open.DialogMerchantApprove({
    mode: 'reject',
    merchantId: row.id,
    merchantName: row.name
  });
  if (res.done) ApiLoad();
};

const SuspendFlow = async (row: SysMerchantItem) => {
  const ok = await useAsk.Any(`確定要停用「${row.name}」嗎？`, '停用商家', '取消', '確認停用', 'warning');
  if (!ok) return;
  const res = await $api.SysSuspendMerchant({ id: row.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '操作失敗');
    return;
  }
  ElMessage.success('已停用');
  ApiLoad();
};

const ActivateFlow = async (row: SysMerchantItem) => {
  const ok = await useAsk.Any(`確定要啟用「${row.name}」嗎？`, '啟用商家', '取消', '確認啟用', 'warning');
  if (!ok) return;
  const res = await $api.SysActivateMerchant({ id: row.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '操作失敗');
    return;
  }
  ElMessage.success('已啟用');
  ApiLoad();
};

const ImpersonateUrl = (id: string) => `/sys/impersonate/${id}`;

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageSysMerchantsIndex
  BizPageHeader(title="商家管理" subtitle="審核、查看、停用商家帳號")
  .PageSysMerchantsIndex__bar
    ElTabs(:model-value="status" @tab-change="ClickTab")
      ElTabPane(label="全部" name="ALL")
      ElTabPane(label="待審核" name="PENDING")
      ElTabPane(label="在線" name="ACTIVE")
      ElTabPane(label="停用" name="SUSPENDED")
      ElTabPane(label="拒絕" name="REJECTED")
    .PageSysMerchantsIndex__search
      ElInput(
        v-model="keyword"
        maxlength="60"
        placeholder="搜尋商家名 / slug / OWNER email"
        clearable
        value-on-clear=""
        @keyup.enter="ClickSearch"
      )
      ElButton(type="primary" :loading="loading" @click="ClickSearch") 搜尋
  ElTable(
    :data="items"
    v-loading="loading"
    stripe
    style="width: 100%"
  )
    ElTableColumn(prop="name" label="商家名稱" min-width="180")
      template(#default="{ row }")
        NuxtLinkLocale.PageSysMerchantsIndex__name-link(:to="`/sys/merchants/${row.id}`") {{ row.name }}
    ElTableColumn(prop="slug" label="slug" min-width="140")
    ElTableColumn(prop="ownerEmail" label="OWNER" min-width="200")
    ElTableColumn(prop="status" label="狀態" width="100")
      template(#default="{ row }")
        ElTag(:type="StatusTagType(row.status)" size="small") {{ StatusLabel(row.status) }}
    ElTableColumn(label="操作" width="280" fixed="right")
      template(#default="{ row }")
        .PageSysMerchantsIndex__actions
          ElButton(size="small" link @click="router.push(localePath(`/sys/merchants/${row.id}`))") 檢視
          template(v-if="row.status === 'PENDING'")
            ElButton(size="small" type="primary" @click="ClickApprove(row)") 審核
            ElButton(size="small" type="danger" plain @click="ClickReject(row)") 拒絕
          template(v-else-if="row.status === 'ACTIVE'")
            NuxtLinkLocale(:to="ImpersonateUrl(row.id)")
              ElButton(size="small" type="primary" plain) 進入後台
            ElButton(size="small" type="warning" plain @click="SuspendFlow(row)") 停用
          template(v-else-if="row.status === 'SUSPENDED'")
            ElButton(size="small" type="success" plain @click="ActivateFlow(row)") 啟用
  .PageSysMerchantsIndex__pagination
    ElPagination(
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next, total"
      background
      @current-change="ClickPage"
    )
</template>

<style lang="scss" scoped>
.PageSysMerchantsIndex__bar {
  background-color: $white;
  border-radius: 14px;
  padding: 4px 18px 16px;
  margin-bottom: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageSysMerchantsIndex__search {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: -8px;
  max-width: 480px;
}

.PageSysMerchantsIndex__name-link {
  color: $primary;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s ease;
}

.PageSysMerchantsIndex__name-link:hover {
  color: $secondary;
}

.PageSysMerchantsIndex__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.PageSysMerchantsIndex__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

@media (max-width: 640px) {
  .PageSysMerchantsIndex__search {
    flex-direction: column;
    align-items: stretch;
    max-width: none;
  }
}
</style>
