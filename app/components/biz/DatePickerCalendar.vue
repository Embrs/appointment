<script setup lang="ts">
// BizDatePickerCalendar — 月曆 grid 日期選擇器（7 欄 × 6 列，固定高度）

interface DatePickerCalendarProps {
  modelValue: string; // YYYY-MM-DD
  minDate?: string;   // YYYY-MM-DD，預設今天
  maxDate?: string;   // YYYY-MM-DD，預設今天 + 60
  disabledDates?: string[];
}

const props = withDefaults(defineProps<DatePickerCalendarProps>(), {
  minDate: '',
  maxDate: '',
  disabledDates: () => []
});

type Emit = { 'update:modelValue': [date: string] };
const emit = defineEmits<Emit>();

const { locale } = useI18n();

const WEEKDAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_LABELS: Record<string, string[]> = {
  zh: ['日', '一', '二', '三', '四', '五', '六'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土']
};
const MONTH_TITLE_FMT: Record<string, string> = {
  zh: 'YYYY 年 M 月',
  en: 'MMM YYYY',
  ja: 'YYYY 年 M 月'
};

const weekdayLabels = computed(() => WEEKDAY_LABELS[locale.value] ?? WEEKDAY_LABELS.zh!);
const monthFmt = computed(() => MONTH_TITLE_FMT[locale.value] ?? MONTH_TITLE_FMT.zh!);

const today = computed(() => $dayjs().startOf('day'));
const minDay = computed(() => (props.minDate ? $dayjs(props.minDate) : today.value));
const maxDay = computed(() =>
  props.maxDate ? $dayjs(props.maxDate) : today.value.add(60, 'day')
);

// 當前顯示的月份（以該月 1 號為錨）
const viewMonth = ref($dayjs(props.modelValue || today.value).startOf('month'));

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return;
    const d = $dayjs(v).startOf('month');
    if (!d.isSame(viewMonth.value, 'month')) viewMonth.value = d;
  }
);

const monthTitle = computed(() => viewMonth.value.format(monthFmt.value));

// 補齊 6 週 = 42 格
const cells = computed(() => {
  const firstOfMonth = viewMonth.value;
  const startOffset = firstOfMonth.day(); // 0 = Sun
  const gridStart = firstOfMonth.subtract(startOffset, 'day');

  const list: {
    date: string;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isDisabled: boolean;
  }[] = [];

  for (let i = 0; i < 42; i++) {
    const d = gridStart.add(i, 'day');
    const dateStr = d.format('YYYY-MM-DD');
    const beforeMin = d.isBefore(minDay.value, 'day');
    const afterMax = d.isAfter(maxDay.value, 'day');
    const inDisabledList = props.disabledDates.includes(dateStr);
    list.push({
      date: dateStr,
      day: d.date(),
      isCurrentMonth: d.isSame(firstOfMonth, 'month'),
      isToday: d.isSame(today.value, 'day'),
      isSelected: dateStr === props.modelValue,
      isDisabled: beforeMin || afterMax || inDisabledList
    });
  }
  return list;
});

const canPrevMonth = computed(() => {
  const prevLast = viewMonth.value.subtract(1, 'day');
  return !prevLast.isBefore(minDay.value, 'day');
});
const canNextMonth = computed(() => {
  const nextFirst = viewMonth.value.add(1, 'month');
  return !nextFirst.isAfter(maxDay.value, 'day');
});

const ClickPrev = () => {
  if (!canPrevMonth.value) return;
  viewMonth.value = viewMonth.value.subtract(1, 'month');
};
const ClickNext = () => {
  if (!canNextMonth.value) return;
  viewMonth.value = viewMonth.value.add(1, 'month');
};
const ClickPick = (date: string, isCurrentMonth: boolean, isDisabled: boolean) => {
  if (isDisabled) return;
  if (!isCurrentMonth) {
    viewMonth.value = $dayjs(date).startOf('month');
  }
  emit('update:modelValue', date);
};
</script>

<template lang="pug">
.BizDatePickerCalendar
  .BizDatePickerCalendar__header
    button.BizDatePickerCalendar__navBtn(
      type="button"
      :disabled="!canPrevMonth"
      :aria-label="$t('booking.calendar.prevMonth')"
      @click="ClickPrev"
    ) ‹
    .BizDatePickerCalendar__title {{ monthTitle }}
    button.BizDatePickerCalendar__navBtn(
      type="button"
      :disabled="!canNextMonth"
      :aria-label="$t('booking.calendar.nextMonth')"
      @click="ClickNext"
    ) ›

  .BizDatePickerCalendar__weekdays
    span.BizDatePickerCalendar__weekday(
      v-for="(label, i) in weekdayLabels"
      :key="WEEKDAY_KEYS[i]"
    ) {{ label }}

  .BizDatePickerCalendar__grid
    button.BizDatePickerCalendar__cell(
      v-for="c in cells"
      :key="c.date"
      type="button"
      :class="{ 'is-outside': !c.isCurrentMonth, 'is-today': c.isToday, 'is-active': c.isSelected, 'is-disabled': c.isDisabled }"
      :disabled="c.isDisabled"
      @click="ClickPick(c.date, c.isCurrentMonth, c.isDisabled)"
    )
      span.BizDatePickerCalendar__cellDay {{ c.day }}
      span.BizDatePickerCalendar__cellBadge(v-if="c.isToday") {{ $t('booking.calendar.today') }}
</template>

<style lang="scss" scoped>
.BizDatePickerCalendar {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.BizDatePickerCalendar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 0;
}

.BizDatePickerCalendar__navBtn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: $primary;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.BizDatePickerCalendar__navBtn:hover:not(:disabled) {
  border-color: $primary;
  background-color: rgba(53, 77, 123, 0.06);
}

.BizDatePickerCalendar__navBtn:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
  background: #f5f7fa;
}

.BizDatePickerCalendar__title {
  font-size: 15px;
  font-weight: 700;
  color: $primary;
  letter-spacing: 0.005em;
}

.BizDatePickerCalendar__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 12px;
  color: rgba(69, 69, 69, 0.55);
  padding: 0 4px;
}

.BizDatePickerCalendar__weekday {
  padding: 6px 0;
  font-weight: 600;
}

.BizDatePickerCalendar__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  padding: 0 4px 4px;
}

.BizDatePickerCalendar__cell {
  position: relative;
  aspect-ratio: 1 / 1;
  min-height: 42px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #303133;
  transition: all 0.12s ease;
}

.BizDatePickerCalendar__cell:hover:not(.is-disabled):not(.is-active) {
  border-color: $primary;
  color: $primary;
}

.BizDatePickerCalendar__cell.is-outside {
  opacity: 0.35;
}

.BizDatePickerCalendar__cell.is-today:not(.is-active) {
  border-color: rgba(245, 108, 108, 0.5);
  color: #f56c6c;
  font-weight: 600;
}

.BizDatePickerCalendar__cell.is-active {
  background: $primary;
  border-color: $primary;
  color: #fff;
  font-weight: 700;
}

.BizDatePickerCalendar__cell.is-disabled {
  background: #f5f7fa;
  color: #c0c4cc;
  cursor: not-allowed;
  border-color: #ebeef5;
}

.BizDatePickerCalendar__cellDay {
  line-height: 1;
}

.BizDatePickerCalendar__cellBadge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f56c6c;
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 8px;
  line-height: 1.2;
}

@media (max-width: 640px) {
  .BizDatePickerCalendar__cell {
    min-height: 38px;
    font-size: 13px;
    border-radius: 8px;
  }
  .BizDatePickerCalendar__navBtn {
    width: 36px;
    height: 36px;
  }
  .BizDatePickerCalendar__title {
    font-size: 14px;
  }
}
</style>
