<script setup lang="ts">
// BizSchedulePanelAffects — 排班 panel 共用「影響服務」副標
// scope='booking' 顯示「影響服務:服務 A, 服務 B」清單
// scope='queue'   顯示「影響服務:QUEUE 服務 A, ...」
// scope='all'     顯示「影響:整店所有服務」(公休日 tab)
type Scope = 'booking' | 'queue' | 'all';
type Props = {
  services: ServiceItem[];
  scope: Scope;
};
const props = defineProps<Props>();

const { t } = useI18n();

const expanded = ref(false);
const COLLAPSE_AT = 5;
const COLLAPSED_SHOW = 3;

const visibleNames = computed(() => {
  if (props.scope === 'all') return [];
  if (expanded.value || props.services.length <= COLLAPSE_AT) {
    return props.services.map((s) => s.name);
  }
  return props.services.slice(0, COLLAPSED_SHOW).map((s) => s.name);
});

const remainingCount = computed(() =>
  Math.max(0, props.services.length - COLLAPSED_SHOW)
);

const showMoreToggle = computed(
  () => props.scope !== 'all' && props.services.length > COLLAPSE_AT && !expanded.value
);
</script>

<template lang="pug">
.BizSchedulePanelAffects(data-testid="schedule-panel-affects")
  template(v-if="scope === 'all'")
    span.BizSchedulePanelAffects__label {{ t('admin.schedule.affectsAll') }}
  template(v-else)
    template(v-if="services.length === 0")
      span.BizSchedulePanelAffects__label.is-none {{ t('admin.schedule.affectsNone') }}
    template(v-else)
      span.BizSchedulePanelAffects__label
        | {{ t('admin.schedule.affects', { names: visibleNames.join('、') }) }}
      template(v-if="showMoreToggle")
        button.BizSchedulePanelAffects__more(type="button" @click="expanded = true")
          | {{ t('admin.schedule.affectsMore', { n: remainingCount }) }}
</template>

<style lang="scss" scoped>
.BizSchedulePanelAffects {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12.5px;
  color: rgba(69, 69, 69, 0.55);
}

.BizSchedulePanelAffects__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.BizSchedulePanelAffects__label.is-none {
  color: rgba(228, 121, 17, 0.85);
  font-style: italic;
}

.BizSchedulePanelAffects__more {
  border: none;
  background: transparent;
  padding: 0 4px;
  color: $primary;
  cursor: pointer;
  text-decoration: underline;
  font-size: 12px;
}
</style>
