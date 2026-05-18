<script setup lang="ts">
// BizDatePickerStrip — 橫向滾動 7-14 天日期選擇器

interface DatePickerStripProps {
  modelValue: string; // YYYY-MM-DD
  days?: number;
  /** 起始 offset（0 = 今天，1 = 明天） */
  startOffset?: number;
  /** 不可選的日期清單（YYYY-MM-DD） */
  disabledDates?: string[];
}

const props = withDefaults(defineProps<DatePickerStripProps>(), {
  days: 14,
  startOffset: 0,
  disabledDates: () => []
});

type Emit = { 'update:modelValue': [date: string] };
const emit = defineEmits<Emit>();

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const dates = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const list: { date: string; day: number; weekday: string; isToday: boolean; disabled: boolean }[] = [];
  for (let i = props.startOffset; i < props.startOffset + props.days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    list.push({
      date: dateStr,
      day: d.getDate(),
      weekday: WEEKDAY_LABELS[d.getDay()] ?? '',
      isToday: i === 0,
      disabled: props.disabledDates.includes(dateStr)
    });
  }
  return list;
});

const ClickPick = (date: string, disabled: boolean) => {
  if (disabled) return;
  emit('update:modelValue', date);
};
</script>

<template lang="pug">
.BizDatePickerStrip
  .BizDatePickerStrip__scroll
    button.BizDatePickerStrip__item(
      v-for="item in dates"
      :key="item.date"
      type="button"
      :class="{ 'is-active': item.date === modelValue, 'is-disabled': item.disabled }"
      :disabled="item.disabled"
      @click="ClickPick(item.date, item.disabled)"
    )
      span.BizDatePickerStrip__weekday {{ item.weekday }}
      span.BizDatePickerStrip__day {{ item.day }}
      span.BizDatePickerStrip__badge(v-if="item.isToday") 今
</template>

<style lang="scss" scoped>
.BizDatePickerStrip {
  width: 100%;
  overflow: hidden;
}

.BizDatePickerStrip__scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 4px 12px 4px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.BizDatePickerStrip__scroll::-webkit-scrollbar {
  height: 4px;
}

.BizDatePickerStrip__scroll::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 2px;
}

.BizDatePickerStrip__item {
  flex: 0 0 auto;
  min-width: 56px;
  padding: 8px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  position: relative;
  transition: all 0.15s;
  scroll-snap-align: start;
}

.BizDatePickerStrip__item:hover:not(.is-disabled):not(.is-active) {
  border-color: #409eff;
  color: #409eff;
}

.BizDatePickerStrip__item.is-active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.BizDatePickerStrip__item.is-disabled {
  background: #f5f7fa;
  color: #c0c4cc;
  cursor: not-allowed;
}

.BizDatePickerStrip__weekday {
  font-size: 12px;
  opacity: 0.85;
}

.BizDatePickerStrip__day {
  font-size: 18px;
  font-weight: 600;
}

.BizDatePickerStrip__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f56c6c;
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 8px;
}
</style>
