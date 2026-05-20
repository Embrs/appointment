<script setup lang="ts">
// BizScheduleOverridesPanel — 單日調整 panel(原「特定日期覆寫」)
type Props = {
  services?: ServiceItem[];
};
const props = defineProps<Props>();

const { t } = useI18n();
const useAsk = UseAsk();

const loading = ref(false);
const resources = ref<ResourceItem[]>([]);
const overrides = ref<ScheduleOverrideItem[]>([]);
const ownServices = ref<ServiceItem[]>([]);

const effectiveServices = computed(() => props.services ?? ownServices.value);
const affectedServices = computed(() =>
  effectiveServices.value.filter((s) => s.isActive && s.bookingMode !== 'QUEUE')
);

const ResourceName = (id: string | null): string => {
  if (!id) return t('admin.schedule.scopeMerchant');
  return resources.value.find((r) => r.id === id)?.name ?? id;
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const calls: Promise<unknown>[] = [
      $api.GetResourceList().then((r) => {
        if (r.status.code === $enum.apiStatus.success) resources.value = r.data.items;
      }),
      $api.GetScheduleOverrides({}).then((r) => {
        if (r.status.code === $enum.apiStatus.success) overrides.value = r.data.items;
      })
    ];
    if (!props.services) {
      calls.push(
        $api.GetServiceList().then((r) => {
          if (r.status.code === $enum.apiStatus.success) ownServices.value = r.data.items;
        })
      );
    }
    await Promise.all(calls);
  } finally {
    loading.value = false;
  }
};

const ClickAdd = async () => {
  const res = await $open.DialogScheduleOverrideEdit({
    scope: 'MERCHANT',
    resourceId: null
  });
  if (res?.done) await ApiLoad();
};

const ClickDelete = async (o: ScheduleOverrideItem) => {
  const ok = await useAsk.Delete(`${o.date} (${ResourceName(o.resourceId)})`);
  if (!ok) return;
  const res = await $api.DeleteScheduleOverride({ id: o.id });
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
.BizScheduleOverridesPanel
  .BizScheduleOverridesPanel__hint {{ t('admin.schedule.hint.overrides') }}
  BizSchedulePanelAffects(:services="affectedServices" :scope="'booking'")
  .BizScheduleOverridesPanel__head
    h2.BizScheduleOverridesPanel__title {{ t('admin.schedule.overridesTitle') }}
    ElButton(@click="ClickAdd") {{ t('admin.schedule.addOverride') }}
  ElTable(
    :data="overrides"
    v-loading="loading"
    stripe
    style="width: 100%;"
  )
    ElTableColumn(:label="t('admin.holidays.dateLabel')" prop="date" width="120")
    ElTableColumn(label="範圍" width="160")
      template(#default="{ row }")
        span {{ row.scope === 'MERCHANT' ? t('admin.schedule.scopeMerchant') : ResourceName(row.resourceId) }}
    ElTableColumn(label="設定" min-width="200")
      template(#default="{ row }")
        ElTag(v-if="row.isClosed" type="danger" size="small") {{ t('admin.schedule.closed') }}
        span(v-else) {{ row.startTime }} – {{ row.endTime }}
    ElTableColumn(label="備註" prop="note" min-width="160")
      template(#default="{ row }")
        span {{ row.note || '—' }}
    ElTableColumn(label="操作" width="100" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link type="danger" @click="ClickDelete(row)") {{ t('common.delete') }}
</template>

<style lang="scss" scoped>
.BizScheduleOverridesPanel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.BizScheduleOverridesPanel__hint {
  font-size: 13px;
  color: rgba(69, 69, 69, 0.65);
  padding: 10px 14px;
  background-color: rgba(0, 173, 169, 0.06);
  border-left: 3px solid $secondary;
  border-radius: 6px;
}

.BizScheduleOverridesPanel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.BizScheduleOverridesPanel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: $primary;
}
</style>
