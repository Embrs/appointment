<script setup lang="ts">
// PageAdminResources — 資源列表 + 新增 / 編輯 / 軟刪除
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const useAsk = UseAsk();
const items = ref<ResourceItem[]>([]);
const loading = ref(true);

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetResourceList();
    if (res.status.code !== $enum.apiStatus.success) return;
    items.value = res.data.items;
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
    ElMessage.error(res.status.message?.zh_tw || '刪除失敗');
    return;
  }
  ElMessage.success('已刪除');
  await ApiLoad();
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminResources
  .PageAdminResources__header
    h1.PageAdminResources__title 資源管理
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
    ElTableColumn(label="顯示順序" prop="displayOrder" width="100")
    ElTableColumn(label="操作" width="140" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link type="primary" @click="ClickEdit(row)") 編輯
        ElButton(size="small" link type="danger" @click="ClickDelete(row)") 刪除
</template>

<style lang="scss" scoped>
.PageAdminResources {
  padding: 8px;
}

.PageAdminResources__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.PageAdminResources__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.PageAdminResources__inactive {
  color: #909399;
  font-size: 12px;
}
</style>
