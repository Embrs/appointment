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

const AriaLabel = computed(() => {
  const action = IsQueue.value ? t('admin.bookingMode.QUEUE') : t('booking.nav.bookNow');
  return `${action} - ${props.service.name}`;
});

const ModeLabel = computed(() => {
  switch (props.service.bookingMode) {
    case 'TIME_SLOT': return t('admin.bookingMode.TIME_SLOT');
    case 'TIME_CAPACITY': return t('admin.bookingMode.TIME_CAPACITY');
    case 'RESOURCE': return t('admin.bookingMode.RESOURCE');
    case 'RESOURCE_OPTIONAL': return t('admin.bookingMode.RESOURCE_OPTIONAL');
    case 'QUEUE': return t('admin.bookingMode.QUEUE');
    default: return '';
  }
});

const PriceLabel = computed(() => {
  const c = props.service.priceCents;
  if (c == null || c <= 0) return '';
  return `NT$ ${(c / 100).toFixed(0)}`;
});

const DurationLabel = computed(() =>
  t('service.durationLabel', { n: props.service.durationMinutes })
);
</script>

<template lang="pug">
.BizServiceCard(
  role="button"
  tabindex="0"
  :aria-label="AriaLabel"
  @click="ClickPrimary"
  @keydown.enter.prevent="ClickPrimary"
  @keydown.space.prevent="ClickPrimary"
)
  .BizServiceCard__head
    .BizServiceCard__name {{ service.name }}
    .BizServiceCard__mode {{ ModeLabel }}
  .BizServiceCard__meta
    span.BizServiceCard__duration {{ DurationLabel }}
    span.BizServiceCard__price(v-if="PriceLabel") {{ PriceLabel }}
  .BizServiceCard__desc(v-if="service.description") {{ service.description }}
  .BizServiceCard__chevron(aria-hidden="true")
    svg(width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round")
      polyline(points="9 18 15 12 9 6")
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
  cursor: pointer;
  position: relative;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  outline: none;
}

.BizServiceCard:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px -8px rgba(31, 42, 68, 0.18);
  border-color: rgba(53, 77, 123, 0.25);
}

.BizServiceCard:focus-visible {
  border-color: $primary;
  box-shadow: 0 0 0 3px rgba(53, 77, 123, 0.25);
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
  padding-right: 24px;
}

.BizServiceCard__chevron {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: rgba(53, 77, 123, 0.06);
  color: $primary;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.BizServiceCard:hover .BizServiceCard__chevron {
  background-color: $primary;
  color: $white;
  transform: translateX(2px);
}
</style>
