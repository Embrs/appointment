<script setup lang="ts">
// BizScheduleQueueWindowPanel — 現場領號時段 panel(原 PageAdminQueueWindow)
type Props = {
  services?: ServiceItem[];
};
const props = defineProps<Props>();

const { t } = useI18n();

const loading = ref(true);
const saving = ref(false);
const queueServices = ref<ServiceItem[]>([]);
const selectedServiceId = ref<string>('');
const windows = ref<QueueWindowItem[]>([]);

const affectedServices = computed(() => {
  if (props.services) {
    return props.services.filter((s) => s.isActive && s.bookingMode === 'QUEUE');
  }
  return queueServices.value;
});

const ApiLoadServices = async () => {
  loading.value = true;
  try {
    const res = await $api.GetServiceList();
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || t('admin.errors.saveFailed'));
      queueServices.value = [];
      return;
    }
    queueServices.value = res.data.items.filter((s) => s.bookingMode === 'QUEUE' && s.isActive);
    if (queueServices.value.length > 0 && !selectedServiceId.value) {
      selectedServiceId.value = queueServices.value[0]!.id;
    }
  } finally {
    loading.value = false;
  }
};

const ApiLoadWindows = async () => {
  if (!selectedServiceId.value) {
    windows.value = [];
    return;
  }
  const res = await $api.GetQueueWindows({ serviceId: selectedServiceId.value });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || t('admin.errors.saveFailed'));
    windows.value = [];
    return;
  }
  windows.value = res.data.windows;
};

const ClickSave = async () => {
  if (!selectedServiceId.value) return;
  saving.value = true;
  try {
    const payload = windows.value.filter((w) => w.isActive);
    const res = await $api.UpdateQueueWindows({
      serviceId: selectedServiceId.value,
      windows: payload
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || t('admin.errors.saveFailed'));
      return;
    }
    ElMessage.success(t('admin.queueWindow.saveSuccess'));
    windows.value = res.data.windows;
  } finally {
    saving.value = false;
  }
};

watch(selectedServiceId, async () => {
  await ApiLoadWindows();
});

onMounted(async () => {
  await ApiLoadServices();
  await ApiLoadWindows();
});
</script>

<template lang="pug">
.BizScheduleQueueWindowPanel
  .BizScheduleQueueWindowPanel__hint {{ t('admin.schedule.hint.queueWindow') }}
  BizSchedulePanelAffects(:services="affectedServices" :scope="'queue'")

  .BizScheduleQueueWindowPanel__loading(v-if="loading") {{ t('admin.queueWindow.loading') }}

  .BizScheduleQueueWindowPanel__empty(v-else-if="queueServices.length === 0")
    p {{ t('admin.queueWindow.noQueueService') }}
    NuxtLinkLocale.BizScheduleQueueWindowPanel__emptyLink(to="/admin/services") {{ t('admin.queueWindow.goCreateService') }}

  template(v-else)
    .BizScheduleQueueWindowPanel__picker
      span.BizScheduleQueueWindowPanel__pickerLabel {{ t('admin.queueWindow.serviceLabel') }}
      ElSelect(
        v-model="selectedServiceId"
        data-testid="queue-window-service-select"
      )
        ElOption(
          v-for="s in queueServices"
          :key="s.id"
          :label="s.name"
          :value="s.id"
        )

    .BizScheduleQueueWindowPanel__editor
      BizQueueWindowEditor(v-model="windows")

    .BizScheduleQueueWindowPanel__foot
      ElButton(
        type="primary"
        :loading="saving"
        data-testid="queue-window-save-btn"
        @click="ClickSave"
      ) {{ t('common.save') }}
</template>

<style lang="scss" scoped>
.BizScheduleQueueWindowPanel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.BizScheduleQueueWindowPanel__hint {
  font-size: 13px;
  color: rgba(69, 69, 69, 0.65);
  padding: 10px 14px;
  background-color: rgba(0, 173, 169, 0.06);
  border-left: 3px solid $secondary;
  border-radius: 6px;
}

.BizScheduleQueueWindowPanel__loading,
.BizScheduleQueueWindowPanel__empty {
  padding: 32px 24px;
  text-align: center;
  background-color: $white;
  border-radius: 12px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  color: rgba(69, 69, 69, 0.65);
}

.BizScheduleQueueWindowPanel__emptyLink {
  display: inline-block;
  margin-top: 8px;
  color: $primary;
  text-decoration: underline;
}

.BizScheduleQueueWindowPanel__picker {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: $white;
  border-radius: 12px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.BizScheduleQueueWindowPanel__pickerLabel {
  font-size: 13.5px;
  color: $primary;
  font-weight: 600;
}

.BizScheduleQueueWindowPanel__editor {
  padding: 16px;
  background-color: $white;
  border-radius: 12px;
  border: 1px solid rgba(53, 77, 123, 0.08);
}

.BizScheduleQueueWindowPanel__foot {
  display: flex;
  justify-content: flex-end;
}
</style>
