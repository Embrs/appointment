<script setup lang="ts">
// PageAdminResources — 資源列表 + 新增 / 編輯 / 軟刪除
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const useAsk = UseAsk();
const items = ref<ResourceItem[]>([]);
// 初值 false：避免 v-loading 在 page transition mount 階段就建立 mask 而卡住
const loading = ref(false);

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
</style>
