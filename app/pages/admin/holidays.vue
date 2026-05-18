<script setup lang="ts">
// PageAdminHolidays — 商家休假日列表 + 新增 / 刪除
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const useAsk = UseAsk();
const items = ref<HolidayItem[]>([]);
const loading = ref(true);
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
  .PageAdminHolidays__header
    h1.PageAdminHolidays__title 休假日
    .PageAdminHolidays__actions
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
  padding: 8px;
}

.PageAdminHolidays__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 8px;
}

.PageAdminHolidays__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.PageAdminHolidays__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
