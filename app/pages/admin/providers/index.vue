<script setup lang="ts">
// PageAdminProviders — 服務人員列表 + 新增 / 編輯 / 軟刪除
// 標題與按鈕用商家自訂稱呼（providerLabel）動態渲染
// 商家未啟用 providerModeEnabled 時頁首顯示 banner 引導去設定頁
import { resolveProviderLabel } from '~shared/i18n/provider-label';

definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const { t, locale } = useI18n();
const useAsk = UseAsk();

const items = ref<ProviderItem[]>([]);
const services = ref<ServiceItem[]>([]);
const merchant = ref<SelfMerchantFull | null>(null);
const loading = ref(false);

const resolveLocale = (): 'zh' | 'en' | 'ja' => {
  const l = locale.value;
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('ja')) return 'ja';
  return 'zh';
};

const providerLabel = computed(() => {
  if (!merchant.value) {
    const lo = resolveLocale();
    return lo === 'zh' ? '服務人員' : lo === 'en' ? 'Provider' : 'スタッフ';
  }
  return resolveProviderLabel(merchant.value, resolveLocale());
});

const providerModeEnabled = computed(() => merchant.value?.providerModeEnabled === true);

const boundServicesByProvider = computed(() => {
  const map = new Map<string, ServiceItem[]>();
  for (const p of items.value) map.set(p.id, []);
  for (const s of services.value) {
    if (!s.isActive) continue;
    for (const pid of s.providerIds ?? []) {
      const arr = map.get(pid);
      if (arr) arr.push(s);
    }
  }
  return map;
});

const ApiLoad = async () => {
  loading.value = true;
  try {
    const [mRes, pRes, sRes] = await Promise.all([
      $api.GetSelfMerchant(),
      $api.GetProviderList(),
      $api.GetServiceList()
    ]);
    if (mRes.status.code === $enum.apiStatus.success) merchant.value = mRes.data.merchant;
    if (pRes.status.code === $enum.apiStatus.success) items.value = pRes.data.items;
    if (sRes.status.code === $enum.apiStatus.success) services.value = sRes.data.items;
  } finally {
    loading.value = false;
  }
};

const ClickCreate = async () => {
  const res = await $open.DialogProviderEdit({ mode: 'create' });
  if (res?.done) await ApiLoad();
};

const ClickEdit = async (p: ProviderItem) => {
  const res = await $open.DialogProviderEdit({ mode: 'edit', provider: p });
  if (res?.done) await ApiLoad();
};

const ClickDelete = async (p: ProviderItem) => {
  const ok = await useAsk.Delete(p.name);
  if (!ok) return;
  const res = await $api.DeleteProvider({ id: p.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || t('common.operationFailed'));
    return;
  }
  ElMessage.success(t('common.deleteSuccess'));
  await ApiLoad();
};

const ClickGoSettings = () => {
  navigateTo('/admin/settings');
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminProviders
  BizPageHeader(
    :title="$t('provider.listTitle', { label: providerLabel })"
    :subtitle="''"
  )
    template(#actions)
      ElButton(
        v-if="providerModeEnabled"
        type="primary"
        @click="ClickCreate"
      ) {{ $t('provider.addButton', { label: providerLabel }) }}
  // 未啟用提示 banner
  ElAlert(
    v-if="!loading && !providerModeEnabled"
    :title="$t('provider.bannerNotEnabled')"
    type="warning"
    show-icon
    :closable="false"
    class="PageAdminProviders__banner"
  )
    template(#default)
      ElButton(type="primary" size="small" @click="ClickGoSettings") {{ $t('provider.bannerGoSettings') }}
  ElTable(
    v-if="providerModeEnabled || items.length > 0"
    :data="items"
    v-loading="loading"
    style="width: 100%;"
    stripe
  )
    ElTableColumn(:label="$t('provider.fields.avatar')" width="80")
      template(#default="{ row }")
        img.PageAdminProviders__avatar(
          v-if="row.avatarUrl"
          :src="row.avatarUrl"
          :alt="row.name"
        )
        .PageAdminProviders__avatarFallback(v-else) {{ row.name?.slice(0, 1) || '?' }}
    ElTableColumn(:label="$t('provider.fields.name')" prop="name" min-width="140")
      template(#default="{ row }")
        span {{ row.name }}
        span.PageAdminProviders__inactive(v-if="!row.isActive")  {{ $t('appointment.fields.providerInactiveSuffix') }}
    ElTableColumn(:label="$t('provider.fields.title')" prop="title" min-width="120")
      template(#default="{ row }")
        span {{ row.title || '—' }}
    ElTableColumn(:label="$t('provider.fields.boundServices')" min-width="220")
      template(#default="{ row }")
        template(v-if="(boundServicesByProvider.get(row.id) || []).length > 0")
          NuxtLinkLocale(
            v-for="s in boundServicesByProvider.get(row.id)"
            :key="s.id"
            to="/admin/services"
            class="PageAdminProviders__boundTagLink"
          )
            ElTag.PageAdminProviders__boundTag(size="small" type="info") {{ s.name }}
        span.PageAdminProviders__unbound(v-else) {{ $t('provider.fields.boundServicesEmpty') }}
    ElTableColumn(:label="$t('provider.fields.displayOrder')" prop="displayOrder" width="100")
    ElTableColumn(:label="$t('common.edit')" width="140" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link type="primary" @click="ClickEdit(row)") {{ $t('provider.actions.edit') }}
        ElButton(size="small" link type="danger" @click="ClickDelete(row)") {{ $t('provider.actions.delete') }}
</template>

<style lang="scss" scoped>
.PageAdminProviders__banner {
  margin: 16px 0;
}

.PageAdminProviders__inactive {
  color: rgba(69, 69, 69, 0.5);
  font-size: 12px;
}

.PageAdminProviders__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.PageAdminProviders__avatarFallback {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #e6f0fa;
  color: #2a6dd0;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
}

.PageAdminProviders__boundTagLink {
  text-decoration: none;
  margin-right: 4px;
  display: inline-block;
}

.PageAdminProviders__boundTag {
  margin-right: 0;
  cursor: pointer;
}

.PageAdminProviders__unbound {
  color: rgba(69, 69, 69, 0.5);
  font-size: 13px;
}
</style>
