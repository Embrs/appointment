<script setup lang="ts">
// PageAdminSchedule — 時段管理：scope 切換（MERCHANT / 各 RESOURCE）+ 七天網格 + 特定日期覆寫
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const useAsk = UseAsk();
// 初值 false：避免 v-loading 在 page transition mount 階段就建立 mask 而卡住
const loading = ref(false);
const saving = ref(false);
const resources = ref<ResourceItem[]>([]);
const allRules = ref<ScheduleRuleItem[]>([]);
const overrides = ref<ScheduleOverrideItem[]>([]);

// scope 選擇：MERCHANT 或某個 resourceId
const selectedScope = ref<string>('MERCHANT');

const isMerchantScope = computed(() => selectedScope.value === 'MERCHANT');
const currentResourceId = computed(() => isMerchantScope.value ? null : selectedScope.value);

// 對應目前 scope 的 rules
const currentRules = computed<{ weekday: number; startTime: string; endTime: string }[]>(() =>
  allRules.value
    .filter((r) =>
      isMerchantScope.value
        ? r.scope === 'MERCHANT'
        : r.scope === 'RESOURCE' && r.resourceId === currentResourceId.value
    )
    .map((r) => ({ weekday: r.weekday, startTime: r.startTime, endTime: r.endTime }))
);

const WEEKDAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

const ResourceName = (id: string | null): string => {
  if (!id) return '整店';
  return resources.value.find((r) => r.id === id)?.name ?? id;
};

const ApiLoad = async () => {
  loading.value = true;
  try {
    const [rRes, sRes, oRes] = await Promise.all([
      $api.GetResourceList(),
      $api.GetScheduleRules({}),
      $api.GetScheduleOverrides({})
    ]);
    if (rRes.status.code === $enum.apiStatus.success) resources.value = rRes.data.items;
    if (sRes.status.code === $enum.apiStatus.success) allRules.value = sRes.data.rules;
    if (oRes.status.code === $enum.apiStatus.success) overrides.value = oRes.data.items;
  } finally {
    loading.value = false;
  }
};

const HandleRulesChange = (next: { weekday: number; startTime: string; endTime: string }[]) => {
  // 用「整組覆蓋當前 scope」維護 allRules：先移除當前 scope，再 push 新的
  const others = allRules.value.filter((r) =>
    isMerchantScope.value
      ? !(r.scope === 'MERCHANT')
      : !(r.scope === 'RESOURCE' && r.resourceId === currentResourceId.value)
  );
  const newScopeRules: ScheduleRuleItem[] = next.map((n) => ({
    scope: isMerchantScope.value ? 'MERCHANT' : 'RESOURCE',
    resourceId: currentResourceId.value,
    weekday: n.weekday,
    startTime: n.startTime,
    endTime: n.endTime
  }));
  allRules.value = [...others, ...newScopeRules];
};

const ClickSave = async () => {
  saving.value = true;
  try {
    const res = await $api.UpdateScheduleRules({
      scope: isMerchantScope.value ? 'MERCHANT' : 'RESOURCE',
      resourceId: currentResourceId.value,
      rules: currentRules.value
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '儲存失敗');
      return;
    }
    ElMessage.success('已儲存時段');
    await ApiLoad();
  } finally {
    saving.value = false;
  }
};

const ClickAddOverride = async () => {
  const res = await $open.DialogScheduleOverrideEdit({
    scope: isMerchantScope.value ? 'MERCHANT' : 'RESOURCE',
    resourceId: currentResourceId.value
  });
  if (res?.done) await ApiLoad();
};

const ClickDeleteOverride = async (o: ScheduleOverrideItem) => {
  const ok = await useAsk.Delete(`${o.date} (${ResourceName(o.resourceId)})`);
  if (!ok) return;
  const res = await $api.DeleteScheduleOverride({ id: o.id });
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
.PageAdminSchedule
  BizPageHeader(title="時段管理" subtitle="設定整店或個別資源的週期性可預約時段與特殊覆寫")
  .PageAdminSchedule__scope
    span.PageAdminSchedule__scope-label 套用對象：
    ElSelect(
      v-model="selectedScope"
      value-on-clear=""
      style="width: 240px;"
    )
      ElOption(label="整店（MERCHANT）" value="MERCHANT")
      ElOption(
        v-for="r in resources"
        :key="r.id"
        :label="`資源：${r.name}`"
        :value="r.id"
      )
  .PageAdminSchedule__editor(v-loading="loading")
    BizSchedulerWeeklyEditor(
      :rules="currentRules"
      :scope="isMerchantScope ? 'MERCHANT' : 'RESOURCE'"
      :resource-id="currentResourceId"
      @update:rules="HandleRulesChange"
    )
    .PageAdminSchedule__editor-actions
      ElButton(
        type="primary"
        :loading="saving"
        @click="ClickSave"
      ) 儲存當前 scope
  .PageAdminSchedule__overrides
    .PageAdminSchedule__overrides-header
      h2.PageAdminSchedule__overrides-title 特定日期覆寫
      ElButton(@click="ClickAddOverride") + 新增覆寫
    ElTable(
      :data="overrides"
      v-loading="loading"
      stripe
      style="width: 100%;"
    )
      ElTableColumn(label="日期" prop="date" width="120")
      ElTableColumn(label="範圍" width="160")
        template(#default="{ row }")
          span {{ row.scope === 'MERCHANT' ? '整店' : ResourceName(row.resourceId) }}
      ElTableColumn(label="設定" min-width="200")
        template(#default="{ row }")
          ElTag(v-if="row.isClosed" type="danger" size="small") 當日休息
          span(v-else) 開放 {{ row.startTime }} – {{ row.endTime }}
      ElTableColumn(label="備註" prop="note" min-width="160")
        template(#default="{ row }")
          span {{ row.note || '—' }}
      ElTableColumn(label="操作" width="100" fixed="right")
        template(#default="{ row }")
          ElButton(size="small" link type="danger" @click="ClickDeleteOverride(row)") 刪除
</template>

<style lang="scss" scoped>
.PageAdminSchedule__scope {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  background-color: $white;
  padding: 14px 18px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.PageAdminSchedule__scope-label {
  font-size: 14px;
  font-weight: 600;
  color: $primary;
}

.PageAdminSchedule__editor {
  background-color: $white;
  padding: 20px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -10px rgba(31, 42, 68, 0.08);
  margin-bottom: 16px;
}

.PageAdminSchedule__editor-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  border-top: 1px solid rgba(53, 77, 123, 0.08);
  padding-top: 14px;
}

.PageAdminSchedule__overrides {
  background-color: $white;
  padding: 20px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -10px rgba(31, 42, 68, 0.08);
}

.PageAdminSchedule__overrides-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.PageAdminSchedule__overrides-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: $primary;
}
</style>
