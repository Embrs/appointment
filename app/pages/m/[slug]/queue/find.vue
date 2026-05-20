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
  try {
    const res = await $api.FindQueueTicket({
      slug: slug.value,
      serviceId: formServiceId.value,
      phoneLast4: formPhoneLast4.value
    });
    if (res.status.code === $enum.apiStatus.success && res.data.ticketId) {
      navigateTo(localePath(`/m/${slug.value}/queue/status?id=${res.data.ticketId}`));
      return;
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

@media (max-width: 360px) {
  .PageQueueFind__card {
    padding: 18px 16px 20px;
  }
}
</style>
