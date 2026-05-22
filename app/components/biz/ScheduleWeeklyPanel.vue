<script setup lang="ts">
// BizScheduleWeeklyPanel — 預約時段 panel:scope 切換 + SchedulerWeeklyEditor + 儲存
// 含「影響服務」副標 + 未綁定資源警告
// 啟用 Provider 制商家時 scope 切換器額外列出 PROVIDER 選項
import { resolveProviderLabel } from '~shared/i18n/provider-label';

type Props = {
  services?: ServiceItem[];
};
const props = defineProps<Props>();

const { t, locale } = useI18n();

const loading = ref(false);
const saving = ref(false);
const resources = ref<ResourceItem[]>([]);
const providers = ref<ProviderItem[]>([]);
const merchant = ref<SelfMerchantFull | null>(null);
const allRules = ref<ScheduleRuleItem[]>([]);
const ownServices = ref<ServiceItem[]>([]);

// services 優先用 props(由容器頁傳入);無 prop 時自行 fetch
const effectiveServices = computed(() => props.services ?? ownServices.value);

// selectedScope 編碼：'MERCHANT' | 'r:<resourceId>' | 'p:<providerId>'
const selectedScope = ref<string>('MERCHANT');
const isMerchantScope = computed(() => selectedScope.value === 'MERCHANT');
const isProviderScope = computed(() => selectedScope.value.startsWith('p:'));
const isResourceScope = computed(() => selectedScope.value.startsWith('r:'));
const currentResourceId = computed(() => isResourceScope.value ? selectedScope.value.slice(2) : null);
const currentProviderId = computed(() => isProviderScope.value ? selectedScope.value.slice(2) : null);
const currentScopeApi = computed<'MERCHANT' | 'RESOURCE' | 'PROVIDER'>(() => {
  if (isMerchantScope.value) return 'MERCHANT';
  if (isProviderScope.value) return 'PROVIDER';
  return 'RESOURCE';
});

const resolveLocale = (): 'zh' | 'en' | 'ja' => {
  const l = locale.value;
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('ja')) return 'ja';
  return 'zh';
};
const providerLabel = computed(() => {
  if (!merchant.value) return resolveLocale() === 'zh' ? '服務人員' : resolveLocale() === 'en' ? 'Provider' : 'スタッフ';
  return resolveProviderLabel(merchant.value, resolveLocale());
});
const providerModeEnabled = computed(() => merchant.value?.providerModeEnabled === true);

const currentRules = computed<{ weekday: number; startTime: string; endTime: string }[]>(() =>
  allRules.value
    .filter((r) => {
      if (isMerchantScope.value) return r.scope === 'MERCHANT';
      if (isResourceScope.value) return r.scope === 'RESOURCE' && r.resourceId === currentResourceId.value;
      return r.scope === 'PROVIDER' && r.providerId === currentProviderId.value;
    })
    .map((r) => ({ weekday: r.weekday, startTime: r.startTime, endTime: r.endTime }))
);

// 影響的服務:非 QUEUE 且啟用
const affectedServices = computed(() =>
  effectiveServices.value.filter((s) => s.isActive && s.bookingMode !== 'QUEUE')
);

// 未綁定資源警告:當前 scope 為某資源,且該資源未被任何 RESOURCE / RESOURCE_OPTIONAL 啟用服務的 resourceIds 包含
const isResourceUnbound = computed(() => {
  if (isMerchantScope.value) return false;
  const rid = currentResourceId.value;
  if (!rid) return false;
  const boundCount = effectiveServices.value.filter(
    (s) =>
      (s.bookingMode === 'RESOURCE' || s.bookingMode === 'RESOURCE_OPTIONAL') &&
      s.isActive &&
      s.resourceIds?.includes(rid)
  ).length;
  return boundCount === 0;
});

const ApiLoad = async () => {
  loading.value = true;
  try {
    const calls: Promise<unknown>[] = [
      $api.GetResourceList().then((r) => {
        if (r.status.code === $enum.apiStatus.success) resources.value = r.data.items;
      }),
      $api.GetScheduleRules({}).then((r) => {
        if (r.status.code === $enum.apiStatus.success) allRules.value = r.data.rules;
      }),
      $api.GetSelfMerchant().then((r) => {
        if (r.status.code === $enum.apiStatus.success) merchant.value = r.data.merchant;
      }),
      $api.GetProviderList().then((r) => {
        if (r.status.code === $enum.apiStatus.success) providers.value = r.data.items.filter((p) => p.isActive);
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

const HandleRulesChange = (next: { weekday: number; startTime: string; endTime: string }[]) => {
  const others = allRules.value.filter((r) => {
    if (isMerchantScope.value) return r.scope !== 'MERCHANT';
    if (isResourceScope.value) return !(r.scope === 'RESOURCE' && r.resourceId === currentResourceId.value);
    return !(r.scope === 'PROVIDER' && r.providerId === currentProviderId.value);
  });
  const newScopeRules: ScheduleRuleItem[] = next.map((n) => ({
    scope: currentScopeApi.value,
    resourceId: currentResourceId.value,
    providerId: currentProviderId.value,
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
      scope: currentScopeApi.value,
      resourceId: currentResourceId.value,
      providerId: currentProviderId.value,
      rules: currentRules.value
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || t('admin.errors.saveFailed'));
      return;
    }
    ElMessage.success(t('common.saveSuccess'));
    await ApiLoad();
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.BizScheduleWeeklyPanel
  .BizScheduleWeeklyPanel__hint {{ t('admin.schedule.hint.weekly') }}

  BizSchedulePanelAffects(:services="affectedServices" :scope="'booking'")

  .BizScheduleWeeklyPanel__scope
    span.BizScheduleWeeklyPanel__scope-label {{ t('admin.schedule.scopeMerchant') }} / {{ t('admin.schedule.scopeResource') }}:
    ElSelect(
      v-model="selectedScope"
      value-on-clear=""
      style="width: 240px;"
    )
      ElOption(:label="t('admin.schedule.scopeMerchant')" value="MERCHANT")
      ElOption(
        v-for="r in resources"
        :key="r.id"
        :label="`${t('admin.schedule.scopeResource')}:${r.name}`"
        :value="`r:${r.id}`"
      )
      ElOption(
        v-for="p in (providerModeEnabled ? providers : [])"
        :key="p.id"
        :label="`${providerLabel}:${p.name}`"
        :value="`p:${p.id}`"
      )

  //- 未綁定資源警告
  ElAlert(
    v-if="isResourceUnbound"
    type="warning"
    :title="t('admin.schedule.unboundResource.title')"
    :closable="false"
    show-icon
    data-testid="schedule-unbound-resource-warning"
  )
    template(#default)
      NuxtLinkLocale.BizScheduleWeeklyPanel__unboundAction(to="/admin/services") {{ t('admin.schedule.unboundResource.action') }}

  .BizScheduleWeeklyPanel__editor(v-loading="loading")
    BizSchedulerWeeklyEditor(
      :rules="currentRules"
      :scope="currentScopeApi"
      :resource-id="currentResourceId"
      @update:rules="HandleRulesChange"
    )
    .BizScheduleWeeklyPanel__editor-actions
      ElButton(
        type="primary"
        :loading="saving"
        @click="ClickSave"
      ) {{ t('common.save') }}
</template>

<style lang="scss" scoped>
.BizScheduleWeeklyPanel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.BizScheduleWeeklyPanel__hint {
  font-size: 13px;
  color: rgba(69, 69, 69, 0.65);
  padding: 10px 14px;
  background-color: rgba(0, 173, 169, 0.06);
  border-left: 3px solid $secondary;
  border-radius: 6px;
}

.BizScheduleWeeklyPanel__scope {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: $white;
  padding: 14px 18px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.BizScheduleWeeklyPanel__scope-label {
  font-size: 14px;
  font-weight: 600;
  color: $primary;
}

.BizScheduleWeeklyPanel__unboundAction {
  display: inline-block;
  margin-top: 6px;
  color: $primary;
  text-decoration: underline;
  font-weight: 500;
  font-size: 13px;
}

.BizScheduleWeeklyPanel__editor {
  background-color: $white;
  padding: 20px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -10px rgba(31, 42, 68, 0.08);
}

.BizScheduleWeeklyPanel__editor-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
  border-top: 1px solid rgba(53, 77, 123, 0.08);
  padding-top: 14px;
}
</style>
