<script setup lang="ts">
// BizScheduleHolidaysPanel — 公休日 panel(原「休假」)
// services prop 僅用於副標 affects(holidays 影響整店,不需要過濾)
type Props = {
  services?: ServiceItem[];
};
defineProps<Props>();

const { t } = useI18n();
const useAsk = UseAsk();

const items = ref<HolidayItem[]>([]);
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
    ElMessage.error(res.status.message?.zh_tw || t('admin.errors.saveFailed'));
    return;
  }
  ElMessage.success(t('common.deleteSuccess'));
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
.BizScheduleHolidaysPanel
  .BizScheduleHolidaysPanel__hint {{ t('admin.schedule.hint.holidays') }}
  BizSchedulePanelAffects(:services="[]" :scope="'all'")
  .BizScheduleHolidaysPanel__head
    h2.BizScheduleHolidaysPanel__title {{ t('admin.schedule.holidaysTitle') }}
    .BizScheduleHolidaysPanel__actions
      ElInput(
        :model-value="String(year)"
        type="number"
        inputmode="numeric"
        maxlength="4"
        style="width: 100px;"
        @change="ChangeYear"
      )
      ElButton(type="primary" @click="ClickCreate") {{ t('admin.holidays.addHoliday') }}
  ElTable(
    :data="items"
    v-loading="loading"
    style="width: 100%;"
    stripe
  )
    ElTableColumn(:label="t('admin.holidays.dateLabel')" prop="date" width="160")
    ElTableColumn(:label="t('admin.holidays.nameLabel')" prop="name" min-width="200")
    ElTableColumn(label="操作" width="100" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link type="danger" @click="ClickDelete(row)") {{ t('common.delete') }}
</template>

<style lang="scss" scoped>
.BizScheduleHolidaysPanel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.BizScheduleHolidaysPanel__hint {
  font-size: 13px;
  color: rgba(69, 69, 69, 0.65);
  padding: 10px 14px;
  background-color: rgba(0, 173, 169, 0.06);
  border-left: 3px solid $secondary;
  border-radius: 6px;
}

.BizScheduleHolidaysPanel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.BizScheduleHolidaysPanel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: $primary;
}

.BizScheduleHolidaysPanel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
