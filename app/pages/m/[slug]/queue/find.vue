<script setup lang="ts">
// PageQueueFind — 顧客以手機末 4 碼找回今日號碼牌
definePageMeta({ layout: 'front-desk' });

const route = useRoute();
const localePath = useLocalePath();
const slug = computed(() => String(route.params.slug ?? ''));
const { t } = useI18n();

const loading = ref(true);
const submitting = ref(false);
const queueServices = ref<PublicServiceItem[]>([]);
const formServiceId = ref('');
const formPhoneLast4 = ref('');
/** 多筆同手機末 4 碼結果（不同 resource 各一張） */
type FindResultItem = {
  ticketId: string;
  ticketNumber: number;
  status: string;
  resourceId: string | null;
  resourceName: string | null;
  serviceName: string;
  claimToken: string;
};
const multiResults = ref<FindResultItem[]>([]);

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetPublicMerchant({ slug: slug.value });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '商家不存在');
      return;
    }
    queueServices.value = res.data.services.filter((s) => s.bookingMode === 'QUEUE');
    if (queueServices.value.length === 1) {
      formServiceId.value = queueServices.value[0].id;
    }
  } finally {
    loading.value = false;
  }
};

const SanitizePhone = (val: string): string => val.replace(/\D/g, '').slice(0, 4);

const HandlePhoneInput = (val: string) => {
  formPhoneLast4.value = SanitizePhone(val);
};

const CanSubmit = computed(() =>
  !!formServiceId.value && /^\d{4}$/.test(formPhoneLast4.value) && !submitting.value
);

const ClickSubmit = async () => {
  if (!CanSubmit.value) return;
  submitting.value = true;
  multiResults.value = [];
  try {
    const res = await $api.FindQueueTicket({
      slug: slug.value,
      serviceId: formServiceId.value,
      phoneLast4: formPhoneLast4.value
    });
    if (res.status.code === $enum.apiStatus.success) {
      // 多筆命中（不同 resource）：列出供顧客選
      if (res.data.tickets && res.data.tickets.length > 0) {
        multiResults.value = res.data.tickets.map((t) => ({
          ticketId: t.ticketId,
          ticketNumber: t.ticketNumber,
          status: t.status,
          resourceId: t.resourceId,
          resourceName: t.resourceName,
          serviceName: t.serviceName,
          claimToken: t.claimToken
        }));
        return;
      }
      // 單筆命中（既有 contract）
      if (res.data.ticketId) {
        navigateTo(localePath(`/m/${slug.value}/queue/status?id=${res.data.ticketId}`));
        return;
      }
    }
    // 後端錯誤碼分流：badRequest=400 / notFound=404 / tooManyRequests=429
    const msg = res.status.message?.zh_tw || t('queue.messages.findNotFound');
    if (res.status.code === 429) {
      ElMessage.warning(msg);
    } else if (res.status.code === 404) {
      ElMessage.warning(t('queue.messages.findNotFound'));
    } else {
      ElMessage.error(msg);
    }
  } finally {
    submitting.value = false;
  }
};

const ClickResultItem = (entry: FindResultItem) => {
  navigateTo(localePath(
    `/m/${slug.value}/queue/status?id=${entry.ticketId}&token=${encodeURIComponent(entry.claimToken)}`
  ));
};

onMounted(ApiLoad);
</script>

<template lang="pug">
.PageQueueFind
  BizCustomerPageHeader(
    :title="$t('queue.page.findTitle')"
    :back-to="`/m/${slug}/queue`"
  )
  .PageQueueFind__loading(v-if="loading") {{ $t('common.loading') }}
  template(v-else)
    .PageQueueFind__card
      p.PageQueueFind__hint {{ $t('queue.page.findHint') }}

      .PageQueueFind__field
        label.PageQueueFind__label {{ $t('queue.page.findServiceLabel') }}
        ElSelect(
          v-model="formServiceId"
          :placeholder="$t('queue.page.findServicePlaceholder')"
          size="large"
          data-testid="queue-find-service"
        )
          ElOption(
            v-for="s in queueServices"
            :key="s.id"
            :label="s.name"
            :value="s.id"
          )

      .PageQueueFind__field
        label.PageQueueFind__label {{ $t('queue.page.findPhoneLabel') }}
        ElInput(
          :model-value="formPhoneLast4"
          :placeholder="$t('queue.page.findPhonePlaceholder')"
          size="large"
          maxlength="4"
          inputmode="numeric"
          data-testid="queue-find-phone"
          @update:model-value="HandlePhoneInput"
        )

      .PageQueueFind__actions
        ElButton(
          type="primary"
          size="large"
          :loading="submitting"
          :disabled="!CanSubmit"
          data-testid="queue-find-submit"
          @click="ClickSubmit"
        ) {{ $t('queue.page.findSubmit') }}

    //- 多筆同手機末 4 碼命中（不同診間／櫃台各一張）
    .PageQueueFind__results(
      v-if="multiResults.length > 0"
      data-testid="queue-find-results"
    )
      .PageQueueFind__resultsTitle {{ $t('queue.page.findTitle') }}
      ul.PageQueueFind__resultList
        li.PageQueueFind__resultItem(
          v-for="r in multiResults"
          :key="r.ticketId"
          :data-testid="`queue-find-result-${r.resourceId ?? 'null'}`"
        )
          .PageQueueFind__resultMain
            .PageQueueFind__resultNumber
              span(v-if="r.resourceName") {{ $t('queue.page.ticketWithRoom', { room: r.resourceName, number: r.ticketNumber }) }}
              span(v-else) {{ r.ticketNumber }}
            .PageQueueFind__resultService {{ r.serviceName }}
          ElButton(
            type="primary"
            size="small"
            @click="ClickResultItem(r)"
          ) {{ $t('common.search') }}
</template>

<style lang="scss" scoped>
.PageQueueFind {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageQueueFind__loading {
  padding: 32px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}

.PageQueueFind__card {
  background-color: $white;
  padding: 22px 22px 24px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 12px -8px rgba(31, 42, 68, 0.08);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.PageQueueFind__hint {
  margin: 0;
  font-size: 13.5px;
  color: rgba(69, 69, 69, 0.7);
  line-height: 1.6;
}

.PageQueueFind__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.PageQueueFind__label {
  font-size: 12.5px;
  font-weight: 600;
  color: rgba(69, 69, 69, 0.75);
  letter-spacing: 0.02em;
}

.PageQueueFind__actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.PageQueueFind__actions > * {
  width: 100%;
  max-width: 240px;
}

// 多筆結果列表 ----
.PageQueueFind__results {
  background-color: $white;
  padding: 18px 22px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 12px -8px rgba(31, 42, 68, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.PageQueueFind__resultsTitle {
  font-size: 14px;
  font-weight: 700;
  color: $primary;
}

.PageQueueFind__resultList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.PageQueueFind__resultItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background-color: rgba(0, 173, 169, 0.06);
  border: 1px solid rgba(0, 173, 169, 0.18);
  border-radius: 10px;
}

.PageQueueFind__resultMain {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.PageQueueFind__resultNumber {
  font-size: 16px;
  font-weight: 700;
  color: $secondary;
  font-variant-numeric: tabular-nums;
}

.PageQueueFind__resultService {
  font-size: 12.5px;
  color: rgba(69, 69, 69, 0.65);
}

@media (max-width: 360px) {
  .PageQueueFind__card {
    padding: 18px 16px 20px;
  }
}
</style>
