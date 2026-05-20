<script setup lang="ts">
// PageQueueLanding — 顧客領號頁
definePageMeta({ layout: 'front-desk' });

const route = useRoute();
const localePath = useLocalePath();
const slug = computed(() => String(route.params.slug ?? ''));
const sessionStore = StoreCustomerSession();
const queueStore = StoreQueueRealtime();
const recent = UseCustomerQueueRecent();

const loading = ref(true);
const taking = ref(false);
const merchant = ref<PublicMerchantItem | null>(null);
const queueServices = ref<PublicServiceItem[]>([]);
const recentEntries = ref<CustomerQueueRecentEntry[]>([]);
const dismissedTicketIds = ref<Set<string>>(new Set());

// 載入商家公開資訊，並只保留 QUEUE 模式服務
const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetPublicMerchant({ slug: slug.value });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '商家不存在');
      merchant.value = null;
      return;
    }
    merchant.value = res.data.merchant;
    queueServices.value = res.data.services.filter((s) => s.bookingMode === 'QUEUE');
    sessionStore.AddSlug(slug.value);
  } finally {
    loading.value = false;
  }
};

// 顯示用：依 WS 推播優先、否則 fallback 初始載入值
type ServingDisplay = {
  kind: 'not-started' | 'no-called' | 'serving';
  currentServing: number;
  waitingCount: number;
};

const DisplayState = (s: PublicServiceItem): ServingDisplay => {
  const wsState = queueStore.serviceMap[s.id];
  const currentServing = wsState ? wsState.currentServing : (s.currentServing ?? 0);
  const ticketsTaken = s.ticketsTaken ?? 0;
  const waitingCount = Math.max(0, ticketsTaken - currentServing);
  if (ticketsTaken === 0) {
    return { kind: 'not-started', currentServing: 0, waitingCount: 0 };
  }
  if (currentServing === 0) {
    return { kind: 'no-called', currentServing: 0, waitingCount };
  }
  return { kind: 'serving', currentServing, waitingCount };
};

const ApiTake = async (serviceId: string, customer: CustomerTripletShape) => {
  if (!merchant.value) return;
  taking.value = true;
  try {
    const res = await $api.TakeQueueTicket({
      slug: slug.value,
      serviceId,
      customer: { lastName: customer.lastName, title: customer.title, phone: customer.phone }
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '領號失敗');
      return;
    }
    sessionStore.SetTriplet(customer);
    // 寫入 localStorage 供下次自動還原；只存末 4 碼避免敏感資訊外洩
    const normalizedPhone = customer.phone.replace(/[\s-]/g, '');
    recent.Append({
      slug: slug.value,
      merchantId: merchant.value.id,
      ticketId: res.data.ticketId,
      ticketNumber: res.data.ticketNumber,
      ticketDate: res.data.ticketDate,
      serviceId,
      serviceName: res.data.serviceName,
      phoneLast4: normalizedPhone.slice(-4),
      takenAt: Date.now()
    });
    // 直接導向 status 頁，由 status 頁負責建立 WS 連線
    navigateTo(localePath(`/m/${slug.value}/queue/status?id=${res.data.ticketId}`));
  } finally {
    taking.value = false;
  }
};

const { t } = useI18n();

const ClickTake = async (serviceId: string) => {
  const prefill = sessionStore.triplet;
  const result = await $open.DialogCustomerForm({
    title: t('queue.page.formTitle'),
    submitLabel: t('queue.page.formSubmit'),
    initial: prefill ?? undefined
  });
  if (!result.done || !result.triplet) return;
  await ApiTake(serviceId, result.triplet);
};

const ClickResume = (entry: CustomerQueueRecentEntry) => {
  navigateTo(localePath(`/m/${slug.value}/queue/status?id=${entry.ticketId}`));
};

const ClickDismissRecent = (entry: CustomerQueueRecentEntry) => {
  // 僅本次隱藏，不從 localStorage 移除；保留作為下次出現的提示
  const next = new Set(dismissedTicketIds.value);
  next.add(entry.ticketId);
  dismissedTicketIds.value = next;
};

const ClickFind = () => navigateTo(localePath(`/m/${slug.value}/queue/find`));

const VisibleRecentEntries = computed(() => {
  return recentEntries.value.filter((e) => !dismissedTicketIds.value.has(e.ticketId));
});

onMounted(async () => {
  // 讀取 localStorage 紀錄（含當日過濾與防呆）
  recentEntries.value = recent.ReadBySlug(slug.value);
  await ApiLoad();
  if (merchant.value?.id) {
    queueStore.Connect(merchant.value.id);
  }
});

onBeforeUnmount(() => {
  queueStore.Disconnect();
});

const TitleHint = (mode: string) => mode === 'QUEUE' ? t('admin.bookingMode.QUEUE') : '';
</script>

<template lang="pug">
.PageQueueLanding
  BizCustomerPageHeader(:back-to="`/m/${slug}`")
  .PageQueueLanding__loading(v-if="loading") {{ $t('common.loading') }}
  .PageQueueLanding__empty(v-else-if="!merchant") {{ $t('booking.messages.notFound') }}
  template(v-else)
    //- 自動還原橫幅（onMounted 後若 localStorage 有當日同 slug 紀錄則顯示）
    .PageQueueLanding__recent(
      v-for="entry in VisibleRecentEntries"
      :key="entry.ticketId"
      data-testid="queue-recent-banner"
    )
      .PageQueueLanding__recentBody
        .PageQueueLanding__recentTitle {{ $t('queue.page.recentTitle', { n: entry.ticketNumber }) }}
        .PageQueueLanding__recentSub
          span.PageQueueLanding__recentService {{ entry.serviceName }}
          span.PageQueueLanding__recentSep ·
          span.PageQueueLanding__recentHint {{ $t('queue.page.recentSubtitle') }}
      .PageQueueLanding__recentActions
        ElButton(
          link
          size="small"
          data-testid="queue-recent-dismiss"
          @click="ClickDismissRecent(entry)"
        ) {{ $t('queue.page.recentDismiss') }}
        ElButton(
          type="primary"
          size="small"
          data-testid="queue-recent-return"
          @click="ClickResume(entry)"
        ) {{ $t('queue.page.recentReturn') }}

    //- 頁首 banner（漸層）
    .PageQueueLanding__hero
      .PageQueueLanding__eyebrow {{ $t('queue.page.landingEyebrow') }}
      h1.PageQueueLanding__title {{ $t('queue.page.landingTitle') }}
      p.PageQueueLanding__desc {{ $t('queue.page.landingHint') }}

    //- 服務卡片
    .PageQueueLanding__empty(v-if="queueServices.length === 0")
      .PageQueueLanding__emptyIcon ○
      .PageQueueLanding__emptyText {{ $t('queue.page.adminEmpty') }}
    .PageQueueLanding__list(v-else)
      .PageQueueLanding__card(v-for="s in queueServices" :key="s.id")
        .PageQueueLanding__cardHead
          .PageQueueLanding__cardName {{ s.name }}
          .PageQueueLanding__cardMode {{ TitleHint(s.bookingMode) }}
        .PageQueueLanding__cardDesc(v-if="s.description") {{ s.description }}

        //- 當前叫號狀態（即時 via WS；無 WS 訊息時讀初始載入值）
        .PageQueueLanding__cardServing(:data-testid="`queue-serving-${s.id}`")
          template(v-if="DisplayState(s).kind === 'not-started'")
            .PageQueueLanding__servingNot {{ $t('queue.page.notStarted') }}
          template(v-else-if="DisplayState(s).kind === 'no-called'")
            .PageQueueLanding__servingChip
              span.PageQueueLanding__servingLabel {{ $t('queue.page.currentServing') }}
              span.PageQueueLanding__servingNum —
            .PageQueueLanding__servingChip.PageQueueLanding__servingChip--waiting
              span.PageQueueLanding__servingLabel {{ $t('queue.page.waitingCount', { n: DisplayState(s).waitingCount }) }}
          template(v-else)
            .PageQueueLanding__servingChip
              span.PageQueueLanding__servingLabel {{ $t('queue.page.currentServing') }}
              span.PageQueueLanding__servingNum {{ DisplayState(s).currentServing }}
            .PageQueueLanding__servingChip.PageQueueLanding__servingChip--waiting
              span.PageQueueLanding__servingLabel {{ $t('queue.page.waitingCount', { n: DisplayState(s).waitingCount }) }}

        .PageQueueLanding__cardFoot
          ElButton(
            type="primary"
            size="large"
            :loading="taking"
            data-testid="queue-take-btn"
            @click="ClickTake(s.id)"
          ) {{ $t('queue.page.take') }}

    //- 找回我的號碼次要入口
    .PageQueueLanding__findEntry(v-if="queueServices.length > 0")
      ElButton(
        link
        type="primary"
        data-testid="queue-find-entry"
        @click="ClickFind"
      ) {{ $t('queue.page.findEntry') }}
</template>

<style lang="scss" scoped>
.PageQueueLanding {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.PageQueueLanding__loading {
  padding: 32px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}

// 自動還原橫幅 ----
.PageQueueLanding__recent {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, rgba(0, 173, 169, 0.12) 0%, rgba(0, 173, 169, 0.04) 100%);
  border: 1px solid rgba(0, 173, 169, 0.28);
  border-radius: 14px;
}

.PageQueueLanding__recentBody {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 220px;
}

.PageQueueLanding__recentTitle {
  font-size: 15px;
  font-weight: 700;
  color: $secondary;
}

.PageQueueLanding__recentSub {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 12.5px;
  color: rgba(69, 69, 69, 0.7);
}

.PageQueueLanding__recentService {
  font-weight: 600;
}

.PageQueueLanding__recentSep {
  opacity: 0.4;
}

.PageQueueLanding__recentActions {
  display: inline-flex;
  gap: 8px;
  flex-shrink: 0;
}

// 頁首 banner ----
.PageQueueLanding__hero {
  position: relative;
  padding: 24px 24px 22px;
  background: linear-gradient(135deg, $primary 0%, #2a3d62 60%, #1d2c4a 100%);
  color: $white;
  border-radius: 16px;
  overflow: hidden;
}

.PageQueueLanding__hero::before {
  content: '';
  position: absolute;
  top: -60px;
  right: -40px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 173, 169, 0.3), transparent 60%);
  pointer-events: none;
}

.PageQueueLanding__hero::after {
  content: '';
  position: absolute;
  bottom: -80px;
  left: -40px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(235, 139, 45, 0.2), transparent 60%);
  pointer-events: none;
}

.PageQueueLanding__back {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  margin-bottom: 12px;
  transition: color 0.15s ease;
}

.PageQueueLanding__back:hover {
  color: $white;
}

.PageQueueLanding__eyebrow {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.92);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
  position: relative;
}

.PageQueueLanding__title {
  position: relative;
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.005em;
}

.PageQueueLanding__desc {
  position: relative;
  margin: 0;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.6;
}

// 空狀態 ----
.PageQueueLanding__empty {
  padding: 40px 24px;
  text-align: center;
  background-color: $white;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.PageQueueLanding__emptyIcon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: rgba(53, 77, 123, 0.06);
  color: rgba(53, 77, 123, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.PageQueueLanding__emptyText {
  color: rgba(69, 69, 69, 0.6);
  font-size: 14px;
}

// 卡片 ----
.PageQueueLanding__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.PageQueueLanding__card {
  background-color: $white;
  padding: 20px 22px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 12px -8px rgba(31, 42, 68, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.PageQueueLanding__card:hover {
  transform: translateY(-2px);
  border-color: rgba(53, 77, 123, 0.18);
  box-shadow: 0 12px 24px -12px rgba(31, 42, 68, 0.15);
}

.PageQueueLanding__cardHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.PageQueueLanding__cardName {
  font-size: 17px;
  font-weight: 700;
  color: $primary;
}

.PageQueueLanding__cardMode {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: $secondary;
  background-color: rgba(0, 173, 169, 0.12);
  padding: 4px 12px;
  border-radius: 999px;
}

.PageQueueLanding__cardDesc {
  font-size: 13.5px;
  color: rgba(69, 69, 69, 0.65);
  line-height: 1.6;
}

.PageQueueLanding__cardServing {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.PageQueueLanding__servingNot {
  font-size: 13.5px;
  color: rgba(69, 69, 69, 0.55);
  font-style: italic;
}

.PageQueueLanding__servingChip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: rgba(0, 173, 169, 0.12);
  color: $secondary;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.PageQueueLanding__servingChip--waiting {
  background-color: rgba(235, 139, 45, 0.12);
  color: $tertiary;
}

.PageQueueLanding__servingLabel {
  font-weight: 500;
  font-size: 12.5px;
  opacity: 0.85;
}

.PageQueueLanding__servingNum {
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 700;
}

.PageQueueLanding__cardFoot {
  display: flex;
  justify-content: flex-end;
}

// 找回我的號碼次要入口 ----
.PageQueueLanding__findEntry {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}
</style>
