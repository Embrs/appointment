<script setup lang="ts">
// PageBook — 顧客預約步驟器
// 步驟：service → (provider?) → (resource?) → date → slot → info → confirm
// provider 步驟僅當 merchant.providerModeEnabled && service.requiresProvider 時啟用
import { resolveProviderLabel } from '~shared/i18n/provider-label';

definePageMeta({ layout: 'front-desk' });

const { t, locale } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const slug = computed(() => String(route.params.slug ?? ''));
const initialServiceId = computed(() => String(route.query.serviceId ?? ''));
const initialProviderId = computed(() => String(route.query.providerId ?? ''));

const sessionStore = StoreCustomerSession();

const loading = ref(true);
const merchant = ref<PublicMerchantItem | null>(null);
const services = ref<PublicServiceItem[]>([]);
const resources = ref<PublicResourceItem[]>([]);
const providers = ref<PublicProviderItem[]>([]);

const slots = ref<AvailabilitySlot[]>([]);
const slotsLoading = ref(false);
const timezone = ref('Asia/Taipei');

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

// 步驟狀態
type StepName = 'service' | 'provider' | 'resource' | 'datetime' | 'info';
// '__any__' 為「不指定（自動分配）」的 sentinel，僅 RESOURCE_OPTIONAL 模式會出現
const ANY_RESOURCE = '__any__';
const isResourceMode = (mode: string | undefined): boolean =>
  mode === 'RESOURCE' || mode === 'RESOURCE_OPTIONAL';
const needsProviderStep = computed(() =>
  merchant.value?.providerModeEnabled === true && selectedService.value?.requiresProvider === true
);
const stepOrder = computed<StepName[]>(() => {
  const needRes = isResourceMode(selectedService.value?.bookingMode);
  const steps: StepName[] = ['service'];
  if (needsProviderStep.value) steps.push('provider');
  if (needRes) steps.push('resource');
  steps.push('datetime', 'info');
  return steps;
});
const currentStep = ref<StepName>('service');
const stepIndex = computed(() => stepOrder.value.indexOf(currentStep.value));

const form = reactive({
  serviceId: '',
  resourceId: '',
  providerId: '',
  date: '',
  startAt: '',
  endAt: '',
  lastName: '',
  title: 'MR' as CustomerTitleType,
  phone: '',
  note: ''
});

const selectedService = computed(() =>
  services.value.find((s) => s.id === form.serviceId) ?? null
);

const selectedResource = computed(() =>
  resources.value.find((r) => r.id === form.resourceId) ?? null
);

// 顧客是否已在 resource 步驟做出選擇（含「不指定」）
const hasResourcePick = computed(() => form.resourceId !== '');
// 實際送往 API 的 resourceId：'__any__' 與空字串都不帶
const apiResourceId = computed(() =>
  isResourceMode(selectedService.value?.bookingMode) &&
  form.resourceId &&
  form.resourceId !== ANY_RESOURCE
    ? form.resourceId
    : undefined
);

const availableResources = computed(() => {
  if (!selectedService.value) return [];
  const ids = selectedService.value.resourceIds;
  return resources.value.filter((r) => ids.includes(r.id));
});

const availableProviders = computed(() => {
  if (!selectedService.value) return [];
  const ids = selectedService.value.providerIds || [];
  return providers.value.filter((p) => ids.includes(p.id));
});

const selectedProvider = computed(() =>
  providers.value.find((p) => p.id === form.providerId) ?? null
);

const apiProviderId = computed(() =>
  needsProviderStep.value && form.providerId ? form.providerId : undefined
);

// 載入 merchant
const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetPublicMerchant({ slug: slug.value });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '商家不存在');
      return;
    }
    merchant.value = res.data.merchant;
    services.value = res.data.services.filter((s) => s.bookingMode !== 'QUEUE');
    resources.value = res.data.resources;
    timezone.value = res.data.merchant.timezone;

    // 啟用 Provider 制商家：載入公開 Provider 列表
    if (res.data.merchant.providerModeEnabled) {
      const pRes = await $api.GetPublicProviderList({ slug: slug.value });
      if (pRes.status.code === $enum.apiStatus.success) {
        providers.value = pRes.data.items;
      }
    }

    // URL 帶 serviceId：直接預選並推進
    if (initialServiceId.value) {
      const s = services.value.find((x) => x.id === initialServiceId.value);
      if (s) {
        form.serviceId = s.id;
        const needRes = isResourceMode(s.bookingMode);
        const needProv = res.data.merchant.providerModeEnabled && s.requiresProvider;
        // URL 也帶 providerId：兩步皆預選
        if (needProv && initialProviderId.value) {
          const p = providers.value.find((x) => x.id === initialProviderId.value && (s.providerIds || []).includes(x.id));
          if (p) {
            form.providerId = p.id;
            // 跳過 provider 步直接進下一步
            currentStep.value = needRes ? 'resource' : 'datetime';
            if (!needRes) {
              form.date = TodayStr(1);
              await ApiLoadSlots();
            }
          } else {
            currentStep.value = 'provider';
          }
        } else if (needProv) {
          currentStep.value = 'provider';
        } else {
          currentStep.value = needRes ? 'resource' : 'datetime';
          if (!needRes) {
            form.date = TodayStr(1);
            await ApiLoadSlots();
          }
        }
      }
    }
    // 預填三元組
    if (sessionStore.triplet) {
      form.lastName = sessionStore.triplet.lastName;
      form.title = sessionStore.triplet.title;
      form.phone = sessionStore.triplet.phone;
    }
  } finally {
    loading.value = false;
  }
};

const TodayStr = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return $dayjs(d).format('YYYY-MM-DD');
};

const ApiLoadSlots = async () => {
  if (!selectedService.value || !form.date) return;
  const mode = selectedService.value.bookingMode;
  // 需要選資源的模式：必須已做出選擇（具名或「不指定」）才能查時段
  if (isResourceMode(mode) && !hasResourcePick.value) return;
  // RESOURCE 模式：'__any__' 不合法（spec 規定必選具名）
  if (mode === 'RESOURCE' && form.resourceId === ANY_RESOURCE) return;
  slotsLoading.value = true;
  slots.value = [];
  form.startAt = '';
  form.endAt = '';
  try {
    const res = await $api.GetAvailability({
      slug: slug.value,
      serviceId: form.serviceId,
      resourceId: apiResourceId.value,
      providerId: apiProviderId.value,
      date: form.date
    });
    if (res.status.code === $enum.apiStatus.success) {
      slots.value = res.data.slots;
      timezone.value = res.data.timezone;
    } else {
      ElMessage.error(res.status.message?.zh_tw || '查詢時段失敗');
    }
  } finally {
    slotsLoading.value = false;
  }
};

const ClickPickService = (id: string) => {
  form.serviceId = id;
  form.resourceId = '';
  form.providerId = '';
  form.startAt = '';
  slots.value = [];
  const needRes = isResourceMode(selectedService.value?.bookingMode);
  const needProv = needsProviderStep.value;
  if (needProv) {
    currentStep.value = 'provider';
    return;
  }
  currentStep.value = needRes ? 'resource' : 'datetime';
  if (!needRes && !form.date) form.date = TodayStr(1);
  if (!needRes) ApiLoadSlots();
};

const ClickPickProvider = (id: string) => {
  form.providerId = id;
};

const ClickNextFromProvider = () => {
  if (!form.providerId) {
    ElMessage.warning(t('booking.messages.providerRequired', { label: providerLabel.value }));
    return;
  }
  const needRes = isResourceMode(selectedService.value?.bookingMode);
  currentStep.value = needRes ? 'resource' : 'datetime';
  if (!needRes && !form.date) form.date = TodayStr(1);
  if (!needRes) ApiLoadSlots();
};

const ClickQueueFromBook = (_serviceId: string) => {
  navigateTo(localePath(`/m/${slug.value}/queue`));
};

const ClickPickResource = (id: string) => {
  form.resourceId = id;
  if (!form.date) form.date = TodayStr(1);
  currentStep.value = 'datetime';
  ApiLoadSlots();
};

watch(() => form.date, () => {
  if (currentStep.value === 'datetime') ApiLoadSlots();
});

const ClickPickSlot = (slot: AvailabilitySlot) => {
  form.startAt = slot.startAt;
  form.endAt = slot.endAt;
};

const ClickNextFromDateTime = () => {
  if (!form.startAt) {
    ElMessage.warning(t('validation.selectSlot'));
    return;
  }
  currentStep.value = 'info';
};

const ClickBack = () => {
  const i = stepIndex.value;
  if (i <= 0) return;
  if (currentStep.value === 'datetime') {
    form.startAt = '';
    form.endAt = '';
  }
  currentStep.value = stepOrder.value[i - 1]!;
};

const ConfirmFlow = async () => {
  if (!isFormValid.value) {
    ElMessage.warning(t('validation.completeFields'));
    return;
  }
  // 持久化三元組
  sessionStore.SetTriplet({
    lastName: form.lastName.trim(),
    title: form.title,
    phone: form.phone.replace(/[\s-]/g, '')
  });

  const result = await $open.DrawerBookingConfirm({
    slug: slug.value,
    serviceId: form.serviceId,
    serviceName: selectedService.value!.name,
    resourceId: apiResourceId.value,
    resourceName: selectedResource.value?.name,
    providerId: apiProviderId.value,
    providerName: selectedProvider.value?.name,
    startAt: form.startAt,
    endAt: form.endAt,
    timezone: timezone.value,
    customer: sessionStore.triplet!,
    note: form.note.trim() || undefined
  });

  if (result.done) {
    await $open.DialogBookingSuccess({
      serviceName: selectedService.value!.name,
      startAt: form.startAt,
      timezone: timezone.value
    });
    navigateTo(localePath(`/m/${slug.value}/my-bookings`));
    return;
  }

  // 達顧客預約上限：alert 後引導至我的預約
  if (result.limitExceeded) {
    await ElMessageBox.alert(
      `${t('booking.messages.limitExceeded')}\n\n${t('booking.messages.limitExceededHint')}`,
      t('booking.messages.limitExceededTitle'),
      {
        confirmButtonText: t('booking.messages.goMyBookings'),
        type: 'warning'
      }
    ).catch(() => null);
    navigateTo(localePath(`/m/${slug.value}/my-bookings`));
  }
};

const isFormValid = computed(() =>
  !!form.lastName.trim() &&
  !!form.title &&
  /^[0-9+\s-]{6,20}$/.test(form.phone)
);

const titleOptions = computed(() => [
  { value: 'MR' as const, label: t('booking.customer.titleMr') },
  { value: 'MRS' as const, label: t('booking.customer.titleMrs') },
  { value: 'MISS' as const, label: t('booking.customer.titleMiss') },
  { value: 'MX' as const, label: t('booking.customer.titleMx') }
]);

onMounted(ApiLoad);
</script>

<template lang="pug">
.PageBook
  BizCustomerPageHeader(
    :title="$t('booking.nav.bookNow')"
    :back-to="`/m/${slug}`"
  )
  .PageBook__loading(v-if="loading") {{ $t('common.loading') }}
  template(v-else)
    //- 步驟條
    .PageBook__steps
      .PageBook__step(
        v-for="(s, i) of stepOrder"
        :key="s"
        :class="{ 'PageBook__step--active': s === currentStep, 'PageBook__step--done': i < stepIndex }"
      )
        .PageBook__stepNum
          span.PageBook__stepNumInner
            template(v-if="i < stepIndex") ✓
            template(v-else) {{ i + 1 }}
        .PageBook__stepLabel {{ $t(`booking.steps.${s}`) }}

    //- 內容面板
    .PageBook__panel
      //- Step: service
      template(v-if="currentStep === 'service'")
        h3.PageBook__panelTitle {{ $t('booking.panel.pickService') }}
        .PageBook__serviceGrid
          BizServiceCard(
            v-for="s in services"
            :key="s.id"
            :service="s"
            @click-book="ClickPickService"
            @click-queue="ClickQueueFromBook"
          )

      //- Step: provider
      template(v-else-if="currentStep === 'provider'")
        h3.PageBook__panelTitle {{ $t('booking.panel.pickProvider', { label: providerLabel }) }}
        p.PageBook__panelHint {{ $t('booking.provider.pickHint', { label: providerLabel }) }}
        .PageBook__providerGrid
          .PageBook__providerCard(
            v-for="p in availableProviders"
            :key="p.id"
            :class="{ 'PageBook__providerCard--active': form.providerId === p.id }"
            @click="ClickPickProvider(p.id)"
          )
            .PageBook__providerAvatar
              img(v-if="p.avatarUrl" :src="p.avatarUrl" :alt="p.name")
              span.PageBook__providerAvatarFallback(v-else) {{ p.name?.slice(0, 1) || '?' }}
            .PageBook__providerInfo
              .PageBook__providerName {{ p.name }}
              .PageBook__providerTitle(v-if="p.title") {{ p.title }}
              .PageBook__providerBio(v-if="p.bio") {{ p.bio }}
              .PageBook__providerBio(v-else) {{ $t('booking.provider.bioEmpty') }}
        .PageBook__nav
          ElButton(size="large" @click="ClickBack") {{ $t('common.previous') }}
          ElButton(
            type="primary"
            size="large"
            :disabled="!form.providerId"
            @click="ClickNextFromProvider"
          ) {{ $t('common.next') }}

      //- Step: resource
      template(v-else-if="currentStep === 'resource'")
        h3.PageBook__panelTitle {{ $t('booking.panel.pickResource') }}
        BizResourcePicker(
          :model-value="form.resourceId"
          :resources="availableResources"
          :allow-any="selectedService?.bookingMode === 'RESOURCE_OPTIONAL'"
          :any-label="$t('booking.resource.anyLabel')"
          :any-description="$t('booking.resource.anyDescription')"
          @update:model-value="ClickPickResource"
        )
        .PageBook__nav
          ElButton(size="large" @click="ClickBack") {{ $t('common.previous') }}

      //- Step: datetime（合併日期與時段）
      template(v-else-if="currentStep === 'datetime'")
        h3.PageBook__panelTitle {{ $t('booking.panel.pickDateTime') }}
        .PageBook__datetime
          .PageBook__datetimeCalendar
            BizDatePickerCalendar(v-model="form.date")
          .PageBook__datetimeSlots
            BizSlotPicker(
              :model-value="form.startAt"
              :slots="slots"
              :timezone="timezone"
              :loading="slotsLoading"
              @update:model-value="(iso) => { const s = slots.find(x => x.startAt === iso); if (s) ClickPickSlot(s); }"
            )
        .PageBook__nav
          ElButton(size="large" @click="ClickBack") {{ $t('common.previous') }}
          ElButton(type="primary" size="large" :disabled="!form.startAt" @click="ClickNextFromDateTime") {{ $t('common.next') }}

      //- Step: info
      template(v-else-if="currentStep === 'info'")
        h3.PageBook__panelTitle {{ $t('booking.fillContactTitle') }}
        ElForm(label-position="top")
          ElFormItem(:label="$t('booking.customer.lastName')" required)
            ElInput(v-model="form.lastName" maxlength="20" size="large" :placeholder="$t('booking.customer.lastNamePlaceholder')")
          ElFormItem(:label="$t('booking.customer.titleField')" required)
            ElSelect(v-model="form.title" size="large" style="width: 100%;")
              ElOption(v-for="opt in titleOptions" :key="opt.value" :label="opt.label" :value="opt.value")
          ElFormItem(:label="$t('booking.customer.phone')" required)
            ElInput(v-model="form.phone" maxlength="20" inputmode="numeric" size="large" :placeholder="$t('booking.customer.phonePlaceholder')")
          ElFormItem(:label="$t('booking.customer.noteOptional')")
            ElInput(v-model="form.note" type="textarea" :rows="2" maxlength="200" show-word-limit)
        .PageBook__nav
          ElButton(size="large" @click="ClickBack") {{ $t('common.previous') }}
          ElButton(type="primary" size="large" :disabled="!isFormValid" @click="ConfirmFlow") {{ $t('booking.actions.confirmBooking') }}
</template>

<style lang="scss" scoped>
.PageBook {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.PageBook__loading {
  padding: 32px;
  text-align: center;
  color: rgba(69, 69, 69, 0.55);
  font-size: 14px;
}

// 步驟條 ----
.PageBook__steps {
  display: flex;
  gap: 4px;
  background-color: $white;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  overflow-x: auto;
}

.PageBook__step {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12.5px;
  color: rgba(69, 69, 69, 0.5);
  border-radius: 8px;
  min-width: 90px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.PageBook__step--active {
  color: $primary;
  background-color: rgba(53, 77, 123, 0.08);
  font-weight: 600;
}

.PageBook__step--done {
  color: $secondary;
}

.PageBook__stepNum {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: currentColor;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.PageBook__stepNumInner {
  color: $white;
  line-height: 1;
}

.PageBook__step:not(.PageBook__step--active):not(.PageBook__step--done) .PageBook__stepNum {
  background-color: rgba(53, 77, 123, 0.18);
}

// 內容面板 ----
.PageBook__panel {
  background-color: $white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 16px -8px rgba(31, 42, 68, 0.1);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.PageBook__panelTitle {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 700;
  color: $primary;
  letter-spacing: -0.005em;
  position: relative;
  padding-left: 12px;
}

.PageBook__panelTitle::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, $primary, $secondary);
}

.PageBook__serviceGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.PageBook__panelHint {
  margin: 0 0 8px;
  font-size: 13px;
  color: rgba(69, 69, 69, 0.6);
}

.PageBook__providerGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.PageBook__providerCard {
  display: flex;
  gap: 12px;
  padding: 14px;
  background-color: $white;
  border: 2px solid rgba(53, 77, 123, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.PageBook__providerCard:hover {
  border-color: rgba(53, 77, 123, 0.3);
}

.PageBook__providerCard--active {
  border-color: $primary;
  box-shadow: 0 4px 14px -6px rgba(53, 77, 123, 0.3);
}

.PageBook__providerAvatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #e6f0fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.PageBook__providerAvatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.PageBook__providerAvatarFallback {
  font-weight: 600;
  color: #2a6dd0;
  font-size: 22px;
  text-transform: uppercase;
}

.PageBook__providerInfo {
  flex: 1;
  min-width: 0;
}

.PageBook__providerName {
  font-size: 15px;
  font-weight: 600;
  color: $primary;
}

.PageBook__providerTitle {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(69, 69, 69, 0.6);
}

.PageBook__providerBio {
  margin-top: 6px;
  font-size: 13px;
  color: rgba(69, 69, 69, 0.7);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.PageBook__datetime {
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.PageBook__datetimeCalendar,
.PageBook__datetimeSlots {
  min-width: 0;
}

@media (max-width: 768px) {
  .PageBook__datetime {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

.PageBook__nav {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.PageBook__nav > * {
  flex: 1;
}

.PageBook__nav :deep(.el-button) {
  min-height: 52px;
  font-size: 15.5px;
  font-weight: 600;
  border-radius: 12px;
  letter-spacing: 0.04em;
}

:deep(.el-input__wrapper),
:deep(.el-select .el-select__wrapper),
:deep(.el-textarea__inner) {
  border-radius: 10px;
}

@media (max-width: 640px) {
  .PageBook__steps {
    gap: 6px;
  }

  .PageBook__step {
    flex: 0 0 auto;
    min-width: 0;
    padding: 6px 10px;
    font-size: 12px;
  }

  .PageBook__step--active {
    flex: 1 1 auto;
  }

  .PageBook__stepLabel {
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .PageBook__step:not(.PageBook__step--active) .PageBook__stepLabel {
    display: none;
  }
}
</style>
