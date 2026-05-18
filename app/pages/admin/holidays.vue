<script setup lang="ts">
// PageAdminHolidays — 商家休假日列表 + 新增 / 刪除
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const useAsk = UseAsk();
const items = ref<HolidayItem[]>([]);
// 初值 false：避免 v-loading 在 page transition mount 階段就建立 mask 而卡住
const loading = ref(false);
const year = ref<number>(new Date().getFullYear());

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetHolidayList({ year: Number(year.value) });
    if (res.status.code !== $enum.apiStatus.success) return;
    items.value = res.data.items;
  } finally {
    loading.value = false;
  }
};

const ClickCreate = async () => {
  const res = await $open.DialogHolidayEdit();
  if (res?.done) await ApiLoad();
};

const ClickDelete = async (h: HolidayItem) => {
  const ok = await useAsk.Delete(`${h.date} ${h.name}`);
  if (!ok) return;
  const res = await $api.DeleteHoliday({ id: h.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '刪除失敗');
    return;
  }
  ElMessage.success('已刪除');
  await ApiLoad();
};

const ChangeYear = (val: number | string) => {
  year.value = Number(val);
  ApiLoad();
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminHolidays
  BizPageHeader(title="休假日" subtitle="設定整店休假日期，當天不接受預約")
    template(#actions)
      ElInput(
        :model-value="String(year)"
        type="number"
        inputmode="numeric"
        maxlength="4"
        style="width: 100px;"
        @change="ChangeYear"
      )
      ElButton(type="primary" @click="ClickCreate") + 新增休假
  ElTable(
    :data="items"
    v-loading="loading"
    style="width: 100%;"
    stripe
  )
    ElTableColumn(label="日期" prop="date" width="160")
    ElTableColumn(label="名稱" prop="name" min-width="200")
    ElTableColumn(label="操作" width="100" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link type="danger" @click="ClickDelete(row)") 刪除
</template>

<style lang="scss" scoped>
.PageAdminHolidays {
  // 內部樣式由 ElTable 與 BizPageHeader 提供
}
</style>
