<script setup lang="ts">
// BizSlotPicker — 時段選擇 grid
// 規範：slot 以 startAt ISO 為 key；剩餘 0 時 disabled 並標「滿」
// 視覺：依時段分群（上午 / 下午 / 晚上）並與 BizDatePickerCalendar 同色系

interface SlotItem {
  startAt: string;
  endAt: string;
  capacity: number;
  remaining: number;
}

interface SlotPickerProps {
  modelValue: string | null;
  slots: SlotItem[];
  timezone: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<SlotPickerProps>(), {
  loading: false
});

type Emit = { 'update:modelValue': [startAt: string] };
const emit = defineEmits<Emit>();

const { t } = useI18n();

const localDay = (iso: string) => $dayjs(new Date(iso)).tz(props.timezone);
const fmtTime = (iso: string) => {
  try { return localDay(iso).format('HH:mm'); } catch { return iso; }
};

type Period = 'morning' | 'afternoon' | 'evening';
const periodOf = (iso: string): Period => {
  const h = localDay(iso).hour();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
};

interface SlotGroup {
  key: Period;
  label: string;
  slots: SlotItem[];
}

const groups = computed<SlotGroup[]>(() => {
  const buckets: Record<Period, SlotItem[]> = { morning: [], afternoon: [], evening: [] };
  for (const s of props.slots) buckets[periodOf(s.startAt)].push(s);
  const order: Period[] = ['morning', 'afternoon', 'evening'];
  return order
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, label: t(`booking.slotPicker.${k}`), slots: buckets[k]! }));
});

const ClickPick = (slot: SlotItem) => {
  if (slot.remaining <= 0) return;
  emit('update:modelValue', slot.startAt);
};
</script>

<template lang="pug">
.BizSlotPicker
  .BizSlotPicker__state(v-if="loading")
    .BizSlotPicker__spinner(aria-hidden="true")
    .BizSlotPicker__stateText {{ $t('booking.slotPicker.loading') }}
  .BizSlotPicker__state(v-else-if="slots.length === 0")
    .BizSlotPicker__emptyIcon(aria-hidden="true")
      svg(width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round")
        circle(cx="12" cy="12" r="9")
        polyline(points="12 7 12 12 15 14")
    .BizSlotPicker__stateText {{ $t('booking.slotPicker.empty') }}
  template(v-else)
    .BizSlotPicker__group(v-for="g in groups" :key="g.key")
      .BizSlotPicker__groupHead
        span.BizSlotPicker__groupDot(:class="`BizSlotPicker__groupDot--${g.key}`")
        span.BizSlotPicker__groupLabel {{ g.label }}
        span.BizSlotPicker__groupCount {{ g.slots.length }}
      .BizSlotPicker__grid
        button.BizSlotPicker__slot(
          v-for="slot in g.slots"
          :key="slot.startAt"
          type="button"
          :class="{ 'is-active': slot.startAt === modelValue, 'is-full': slot.remaining <= 0 }"
          :disabled="slot.remaining <= 0"
          :aria-pressed="slot.startAt === modelValue ? 'true' : 'false'"
          @click="ClickPick(slot)"
        )
          span.BizSlotPicker__time {{ fmtTime(slot.startAt) }}
          span.BizSlotPicker__tag.BizSlotPicker__tag--full(v-if="slot.remaining <= 0") {{ $t('booking.slotPicker.full') }}
          span.BizSlotPicker__tag.BizSlotPicker__tag--cap(v-else-if="slot.capacity > 1")
            | {{ $t('booking.slotPicker.remaining', { n: slot.remaining }) }}
          span.BizSlotPicker__check(v-if="slot.startAt === modelValue" aria-hidden="true")
            svg(width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round")
              polyline(points="20 6 9 17 4 12")
</template>

<style lang="scss" scoped>
.BizSlotPicker {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

// 狀態（loading / empty）
.BizSlotPicker__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 36px 16px;
  border: 1px dashed rgba(53, 77, 123, 0.18);
  border-radius: 14px;
  background-color: rgba(53, 77, 123, 0.02);
  color: rgba(69, 69, 69, 0.55);
}

.BizSlotPicker__stateText {
  font-size: 13px;
}

.BizSlotPicker__emptyIcon {
  color: rgba(53, 77, 123, 0.45);
}

.BizSlotPicker__spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(53, 77, 123, 0.18);
  border-top-color: $primary;
  animation: BizSlotPickerSpin 0.8s linear infinite;
}

@keyframes BizSlotPickerSpin {
  to { transform: rotate(360deg); }
}

// 分群
.BizSlotPicker__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.BizSlotPicker__groupHead {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
  font-size: 12.5px;
  color: rgba(31, 42, 68, 0.7);
}

.BizSlotPicker__groupDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $primary;
  box-shadow: 0 0 0 3px rgba(53, 77, 123, 0.12);
}

.BizSlotPicker__groupDot--morning {
  background: #f5b400;
  box-shadow: 0 0 0 3px rgba(245, 180, 0, 0.18);
}

.BizSlotPicker__groupDot--afternoon {
  background: $secondary;
  box-shadow: 0 0 0 3px rgba(0, 173, 169, 0.18);
}

.BizSlotPicker__groupDot--evening {
  background: #6f5ad6;
  box-shadow: 0 0 0 3px rgba(111, 90, 214, 0.18);
}

.BizSlotPicker__groupLabel {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.BizSlotPicker__groupCount {
  margin-left: 2px;
  font-size: 11.5px;
  color: rgba(69, 69, 69, 0.5);
  background-color: rgba(53, 77, 123, 0.06);
  padding: 1px 7px;
  border-radius: 10px;
}

// Grid
.BizSlotPicker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}

.BizSlotPicker__slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 56px;
  padding: 8px 6px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
  color: #303133;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.12s ease,
    background-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
  outline: none;
}

.BizSlotPicker__slot:hover:not(.is-active):not(.is-full) {
  border-color: $primary;
  color: $primary;
  transform: translateY(-1px);
  box-shadow: 0 6px 14px -8px rgba(31, 42, 68, 0.25);
}

.BizSlotPicker__slot:focus-visible {
  border-color: $primary;
  box-shadow: 0 0 0 3px rgba(53, 77, 123, 0.22);
}

.BizSlotPicker__slot.is-active {
  background: $primary;
  border-color: $primary;
  color: #fff;
  box-shadow: 0 8px 18px -8px rgba(31, 42, 68, 0.4);
}

.BizSlotPicker__slot.is-full {
  background: #f5f7fa;
  color: #c0c4cc;
  cursor: not-allowed;
  border-color: #ebeef5;
}

.BizSlotPicker__time {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.BizSlotPicker__tag {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 8px;
  line-height: 1.4;
}

.BizSlotPicker__tag--cap {
  background-color: rgba(0, 173, 169, 0.12);
  color: $secondary;
}

.BizSlotPicker__slot.is-active .BizSlotPicker__tag--cap {
  background-color: rgba(255, 255, 255, 0.22);
  color: #fff;
}

.BizSlotPicker__tag--full {
  background-color: rgba(245, 108, 108, 0.12);
  color: #f56c6c;
}

.BizSlotPicker__check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.22);
  color: #fff;
}

@media (max-width: 640px) {
  .BizSlotPicker__grid {
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 6px;
  }

  .BizSlotPicker__slot {
    min-height: 52px;
    border-radius: 9px;
  }

  .BizSlotPicker__time {
    font-size: 15px;
  }
}
</style>
