<script setup lang="ts">
// PageAdminServices — 服務列表 + 新增 / 編輯彈窗 + 軟刪除
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const useAsk = UseAsk();
const items = ref<ServiceItem[]>([]);
const resources = ref<ResourceItem[]>([]);
// 初值 false：避免 v-loading 在 page transition mount 階段就建立 mask，
// 導致 transitionend 事件與頁面 enter transition 衝突而卡住載入動畫
const loading = ref(false);

const resourceMap = computed(() => {
  const m: Record<string, string> = {};
  for (const r of resources.value) m[r.id] = r.name;
  return m;
});

const BookingModeLabel = (mode: BookingModeType): string => {
  switch (mode) {
    case 'TIME_SLOT': return '固定時段';
    case 'TIME_CAPACITY': return '時段+人數';
    case 'RESOURCE': return '指定資源';
    case 'QUEUE': return '號碼牌';
    default: return mode;
  }
};

const BookingModeTagType = (mode: BookingModeType): 'primary' | 'success' | 'warning' | 'info' => {
  switch (mode) {
    case 'TIME_SLOT': return 'primary';
    case 'TIME_CAPACITY': return 'success';
    case 'RESOURCE': return 'warning';
    case 'QUEUE': return 'info';
    default: return 'info';
  }
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const [s, r] = await Promise.all([
      $api.GetServiceList(),
      $api.GetResourceList()
    ]);
    if (s.status.code === $enum.apiStatus.success) items.value = s.data.items;
    if (r.status.code === $enum.apiStatus.success) resources.value = r.data.items;
  } finally {
    loading.value = false;
  }
};

const ClickCreate = async () => {
  const res = await $open.DialogServiceEdit({ mode: 'create' });
  if (res?.done) await ApiLoad();
};

const ClickEdit = async (s: ServiceItem) => {
  const res = await $open.DialogServiceEdit({ mode: 'edit', service: s });
  if (res?.done) await ApiLoad();
};

const ClickDelete = async (s: ServiceItem) => {
  const ok = await useAsk.Delete(s.name);
  if (!ok) return;
  const res = await $api.DeleteService({ id: s.id });
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
.PageAdminServices
  BizPageHeader(title="服務管理" subtitle="管理可被預約的服務項目、模式與時長")
    template(#actions)
      ElButton(type="primary" @click="ClickCreate") + 新增服務
  ElTable(
    :data="items"
    v-loading="loading"
    style="width: 100%;"
    stripe
  )
    ElTableColumn(label="名稱" prop="name" min-width="140")
      template(#default="{ row }")
        span {{ row.name }}
        span.PageAdminServices__inactive(v-if="!row.isActive")  (停用)
    ElTableColumn(label="模式" width="120")
      template(#default="{ row }")
        ElTag(:type="BookingModeTagType(row.bookingMode)" size="small") {{ BookingModeLabel(row.bookingMode) }}
    ElTableColumn(label="時長 / 間隔" width="120")
      template(#default="{ row }")
        span(v-if="row.bookingMode !== 'QUEUE'") {{ row.durationMinutes }}m / {{ row.slotIntervalMinutes }}m
        span(v-else) —
    ElTableColumn(label="容量" width="80")
      template(#default="{ row }")
        span(v-if="row.bookingMode === 'TIME_CAPACITY'") {{ row.capacityPerSlot }}
        span(v-else) —
    ElTableColumn(label="資源" min-width="160")
      template(#default="{ row }")
        template(v-if="row.bookingMode === 'RESOURCE' && row.resourceIds.length")
          ElTag(
            v-for="rid in row.resourceIds"
            :key="rid"
            size="small"
            type="info"
            style="margin-right: 4px;"
          ) {{ resourceMap[rid] || rid }}
        span(v-else) —
    ElTableColumn(label="操作" width="140" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link type="primary" @click="ClickEdit(row)") 編輯
        ElButton(size="small" link type="danger" @click="ClickDelete(row)") 刪除
</template>

<style lang="scss" scoped>
.PageAdminServices__inactive {
  color: rgba(69, 69, 69, 0.5);
  font-size: 12px;
}
</style>
