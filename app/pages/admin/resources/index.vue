<script setup lang="ts">
// PageAdminResources — 資源列表 + 新增 / 編輯 / 軟刪除
// 含「已綁服務」column,顯示資源被哪些 RESOURCE 服務綁定;未綁時提示
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const { t } = useI18n();
const useAsk = UseAsk();
const items = ref<ResourceItem[]>([]);
const services = ref<ServiceItem[]>([]);
// 初值 false:避免 v-loading 在 page transition mount 階段就建立 mask 而卡住
const loading = ref(false);

const boundServicesByResource = computed(() => {
  const map = new Map<string, ServiceItem[]>();
  for (const r of items.value) map.set(r.id, []);
  for (const s of services.value) {
    if (s.bookingMode !== 'RESOURCE' || !s.isActive) continue;
    for (const rid of s.resourceIds ?? []) {
      const arr = map.get(rid);
      if (arr) arr.push(s);
    }
  }
  return map;
});

const ApiLoad = async () => {
  loading.value = true;
  try {
    const [rRes, sRes] = await Promise.all([
      $api.GetResourceList(),
      $api.GetServiceList()
    ]);
    if (rRes.status.code === $enum.apiStatus.success) items.value = rRes.data.items;
    if (sRes.status.code === $enum.apiStatus.success) services.value = sRes.data.items;
  } finally {
    loading.value = false;
  }
};

const ClickCreate = async () => {
  const res = await $open.DialogResourceEdit({ mode: 'create' });
  if (res?.done) await ApiLoad();
};

const ClickEdit = async (r: ResourceItem) => {
  const res = await $open.DialogResourceEdit({ mode: 'edit', resource: r });
  if (res?.done) await ApiLoad();
};

const ClickDelete = async (r: ResourceItem) => {
  const ok = await useAsk.Delete(r.name);
  if (!ok) return;
  const res = await $api.DeleteResource({ id: r.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || t('admin.errors.saveFailed'));
    return;
  }
  ElMessage.success(t('common.deleteSuccess'));
  await ApiLoad();
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminResources
  BizPageHeader(title="資源管理" subtitle="管理技師、座位、設備等可被分配的資源")
    template(#actions)
      ElButton(type="primary" @click="ClickCreate") + 新增資源
  ElTable(
    :data="items"
    v-loading="loading"
    style="width: 100%;"
    stripe
  )
    ElTableColumn(label="名稱" prop="name" min-width="160")
      template(#default="{ row }")
        span {{ row.name }}
        span.PageAdminResources__inactive(v-if="!row.isActive")  (停用)
    ElTableColumn(label="描述" prop="description" min-width="220")
      template(#default="{ row }")
        span {{ row.description || '—' }}
    ElTableColumn(:label="t('admin.resources.boundServices')" min-width="220" data-testid="resources-bound-services-column")
      template(#default="{ row }")
        template(v-if="(boundServicesByResource.get(row.id) || []).length > 0")
          NuxtLinkLocale(
            v-for="s in boundServicesByResource.get(row.id)"
            :key="s.id"
            to="/admin/services"
            class="PageAdminResources__boundTagLink"
          )
            ElTag.PageAdminResources__boundTag(size="small" type="info") {{ s.name }}
        ElTooltip(
          v-else
          :content="t('admin.resources.boundServicesHint')"
          placement="top"
        )
          span.PageAdminResources__unbound(data-testid="resources-unbound-hint") {{ t('admin.resources.boundServicesEmpty') }}
    ElTableColumn(label="顯示順序" prop="displayOrder" width="100")
    ElTableColumn(label="操作" width="140" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link type="primary" @click="ClickEdit(row)") 編輯
        ElButton(size="small" link type="danger" @click="ClickDelete(row)") 刪除
</template>

<style lang="scss" scoped>
.PageAdminResources__inactive {
  color: rgba(69, 69, 69, 0.5);
  font-size: 12px;
}

.PageAdminResources__boundTagLink {
  text-decoration: none;
  margin-right: 4px;
  display: inline-block;
}

.PageAdminResources__boundTag {
  margin-right: 0;
  cursor: pointer;
}

.PageAdminResources__unbound {
  color: rgba(228, 121, 17, 0.85);
  font-size: 13px;
  font-style: italic;
  cursor: help;
}
</style>
