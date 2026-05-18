<script setup lang="ts">
// BizServiceCard — 服務卡片（顧客視角）

interface ServiceCardProps {
  service: PublicServiceItem;
  resourceCount?: number;
}

const props = withDefaults(defineProps<ServiceCardProps>(), {
  resourceCount: 0
});

const { t } = useI18n();

type Emit = {
  'click-book': [serviceId: string];
  'click-queue': [serviceId: string];
};
const emit = defineEmits<Emit>();

const IsQueue = computed(() => props.service.bookingMode === 'QUEUE');
const ClickPrimary = () => {
  if (IsQueue.value) emit('click-queue', props.service.id);
  else emit('click-book', props.service.id);
};

const ModeLabel = computed(() => {
  switch (props.service.bookingMode) {
    case 'TIME_SLOT': return t('admin.bookingMode.TIME_SLOT');
    case 'TIME_CAPACITY': return t('admin.bookingMode.TIME_CAPACITY');
    case 'RESOURCE': return t('admin.bookingMode.RESOURCE');
    case 'QUEUE': return t('admin.bookingMode.QUEUE');
    default: return '';
  }
});

const PriceLabel = computed(() => {
  if (props.service.priceCents == null) return '';
  return `NT$ ${(props.service.priceCents / 100).toFixed(0)}`;
});
</script>

<template lang="pug">
.BizServiceCard
  .BizServiceCard__head
    .BizServiceCard__name {{ service.name }}
    .BizServiceCard__mode {{ ModeLabel }}
  .BizServiceCard__meta
    span.BizServiceCard__duration {{ service.durationMinutes }}
    span.BizServiceCard__price(v-if="PriceLabel") {{ PriceLabel }}
  .BizServiceCard__desc(v-if="service.description") {{ service.description }}
  .BizServiceCard__footer
    ElButton.BizServiceCard__btn(
      type="primary"
      @click="ClickPrimary"
    ) {{ IsQueue ? $t('admin.bookingMode.QUEUE') : $t('booking.nav.bookNow') }}
</template>

<style lang="scss" scoped>
.BizServiceCard {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 6%);
  border: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.BizServiceCard__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.BizServiceCard__name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}

.BizServiceCard__mode {
  font-size: 12px;
  color: #409eff;
  background: #ecf5ff;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.BizServiceCard__meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #606266;
}

.BizServiceCard__price {
  color: #f56c6c;
  font-weight: 500;
}

.BizServiceCard__desc {
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
}

.BizServiceCard__footer {
  margin-top: auto;
  padding-top: 4px;
  display: flex;
  justify-content: flex-end;
}

.BizServiceCard__btn {
  min-width: 96px;
}
</style>
