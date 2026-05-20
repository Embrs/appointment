<script setup lang="ts">
// BizAppointmentCalendar — 商家行事曆（週/日檢視）
// 規範：純前端組件，給定 items 自行 group；切換 mode 與 anchorDate 由 parent 控
// 不可營業時段（holiday / override.isClosed / 排班外）顯示斜紋背景且不可點
// 空白可建立格 hover 高亮並 emit click-empty-cell

interface CalendarMerchantRule {
  weekday: number;       // 0–6（日–六）
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  isActive?: boolean;
}

interface CalendarOverride {
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
}

interface AppointmentCalendarProps {
  items: AppointmentItem[];
  mode: 'week' | 'day';
  /** 基準日 YYYY-MM-DD（week：該週起點；day：當日） */
  anchorDate: string;
  timezone?: string;
  /** 商家整週主規則（scope=MERCHANT）；提供時用於判斷 hour 是否在營業時段 */
  merchantSchedule?: CalendarMerchantRule[];
  /** 整日不營業的日期清單（holiday + override.isClosed） */
  closedDates?: string[];
  /** 特定日期 override（date string → 細節）；非 isClosed 但有 startTime/endTime 時取代當週規則 */
  overridesByDate?: Record<string, CalendarOverride>;
}

const props = withDefaults(defineProps<AppointmentCalendarProps>(), {
  timezone: 'Asia/Taipei',
  merchantSchedule: () => [],
  closedDates: () => [],
  overridesByDate: () => ({})
});

type Emit = {
  'click-cell': [appointment: AppointmentItem];
  'click-empty-cell': [payload: { date: string; startAt?: string }];
};
const emit = defineEmits<Emit>();

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 ~ 20:00

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const days = computed(() => {
  if (props.mode === 'day') {
    return [{ date: props.anchorDate, label: $dayjs(props.anchorDate).format('MM/DD (週' + WEEKDAY_LABELS[$dayjs(props.anchorDate).day()] + ')') }];
  }
  const start = $dayjs(props.anchorDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = start.add(i, 'day');
    return {
      date: d.format('YYYY-MM-DD'),
      label: d.format('MM/DD') + ` 週${WEEKDAY_LABELS[d.day()]}`
    };
  });
});

const fmtTime = (iso: string) => $dayjs(new Date(iso)).tz(props.timezone).format('HH:mm');

const itemsByDateHour = computed(() => {
  const map = new Map<string, AppointmentItem[]>();
  for (const a of props.items) {
    const d = $dayjs(new Date(a.startAt)).tz(props.timezone);
    const key = `${d.format('YYYY-MM-DD')}_${d.hour()}`;
    const arr = map.get(key) ?? [];
    arr.push(a);
    map.set(key, arr);
  }
  return map;
});

const ItemsAt = (date: string, hour: number): AppointmentItem[] =>
  itemsByDateHour.value.get(`${date}_${hour}`) ?? [];

// 取該日的營業時段 intervals（[{ start: 'HH:mm', end: 'HH:mm' }]）
const IntervalsForDate = (date: string): Array<{ start: string; end: string }> => {
  const ov = props.overridesByDate[date];
  if (ov) {
    if (ov.isClosed) return [];
    if (ov.startTime && ov.endTime) return [{ start: ov.startTime, end: ov.endTime }];
    return [];
  }
  const weekday = $dayjs(date).day();
  return props.merchantSchedule
    .filter((r) => r.weekday === weekday && r.isActive !== false)
    .map((r) => ({ start: r.startTime, end: r.endTime }));
};

const closedDateSet = computed(() => new Set(props.closedDates));

// 該 (date, hour) 是否在營業時段內（小時粒度判斷）
const IsHourOpen = (date: string, hour: number): boolean => {
  if (closedDateSet.value.has(date)) return false;
  const intervals = IntervalsForDate(date);
  if (intervals.length === 0) return false;
  return intervals.some(({ start, end }) => {
    const sH = Number(start.split(':')[0]);
    const eH = Number(end.split(':')[0]);
    const eM = Number(end.split(':')[1]);
    // hour 落在 [sH, eH)，若 endTime 是 18:30 則 hour=18 仍算營業
    return hour >= sH && (hour < eH || (hour === eH && eM > 0));
  });
};

const HasItems = (date: string, hour: number): boolean => ItemsAt(date, hour).length > 0;

// 整日 closed（用於畫整欄斜紋；目前每格自己處理足夠）
const IsDateClosed = (date: string): boolean => {
  if (closedDateSet.value.has(date)) return true;
  const ov = props.overridesByDate[date];
  if (ov?.isClosed) return true;
  return false;
};

const ClosedTooltip = (date: string): string => {
  if (closedDateSet.value.has(date)) return '本日休假';
  const ov = props.overridesByDate[date];
  if (ov?.isClosed) return '本日休息';
  return '非營業時段';
};

const CellClassFor = (date: string, hour: number) => {
  if (HasItems(date, hour)) return 'has-items';
  if (!IsHourOpen(date, hour)) return 'is-closed';
  return 'is-empty';
};

const EmitEmptyCellAt = (date: string, hour: number) => {
  const startAt = $dayjs.tz(`${date} ${String(hour).padStart(2, '0')}:00`, props.timezone).toDate().toISOString();
  emit('click-empty-cell', { date, startAt });
};

const ClickCell = (date: string, hour: number) => {
  if (HasItems(date, hour)) return;
  if (!IsHourOpen(date, hour)) return;
  EmitEmptyCellAt(date, hour);
};

const ClickAddInCell = (date: string, hour: number) => {
  if (!IsHourOpen(date, hour)) return;
  EmitEmptyCellAt(date, hour);
};

const StatusColor = (status: string) => {
  switch (status) {
    case 'CONFIRMED': return '#409eff';
    case 'CANCELED': return '#f56c6c';
    case 'COMPLETED': return '#67c23a';
    case 'NO_SHOW': return '#e6a23c';
    default: return '#909399';
  }
};
</script>

<template lang="pug">
.BizAppointmentCalendar(:class="`is-${mode}`")
  .BizAppointmentCalendar__grid(:style="{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }")
    //- header row
    .BizAppointmentCalendar__corner
    .BizAppointmentCalendar__day-header(
      v-for="d in days"
      :key="d.date"
      :class="{ 'is-closed': IsDateClosed(d.date) }"
      :title="IsDateClosed(d.date) ? ClosedTooltip(d.date) : ''"
    ) {{ d.label }}
    //- body
    template(v-for="h in HOURS" :key="h")
      .BizAppointmentCalendar__time-label {{ String(h).padStart(2, '0') }}:00
      .BizAppointmentCalendar__cell(
        v-for="d in days"
        :key="`${d.date}_${h}`"
        :class="CellClassFor(d.date, h)"
        :title="!IsHourOpen(d.date, h) && !HasItems(d.date, h) ? ClosedTooltip(d.date) : ''"
        @click="ClickCell(d.date, h)"
      )
        template(v-if="HasItems(d.date, h)")
          .BizAppointmentCalendar__chip(
            v-for="a in ItemsAt(d.date, h)"
            :key="a.id"
            :style="{ borderLeftColor: StatusColor(a.status) }"
            @click.stop="emit('click-cell', a)"
          )
            .BizAppointmentCalendar__chip-time {{ fmtTime(a.startAt) }}
            .BizAppointmentCalendar__chip-name {{ a.customerLastName }} ｜ {{ a.service.name }}
          .BizAppointmentCalendar__add-btn(
            v-if="IsHourOpen(d.date, h)"
            title="於此時段代客預約"
            @click.stop="ClickAddInCell(d.date, h)"
          ) + 代客預約
        template(v-else-if="CellClassFor(d.date, h) === 'is-empty'")
          .BizAppointmentCalendar__add-hint + 代客預約
</template>

<style lang="scss" scoped>
.BizAppointmentCalendar {
  width: 100%;
  overflow-x: auto;
}

.BizAppointmentCalendar__grid {
  display: grid;
  min-width: 720px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.BizAppointmentCalendar__corner,
.BizAppointmentCalendar__day-header {
  background: #f5f7fa;
  padding: 8px 6px;
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  text-align: center;
  border-bottom: 1px solid #ebeef5;
  border-left: 1px solid #ebeef5;
}

.BizAppointmentCalendar__day-header.is-closed {
  color: #c0c4cc;
  background: repeating-linear-gradient(
    45deg,
    #f5f7fa,
    #f5f7fa 6px,
    #e4e7ed 6px,
    #e4e7ed 7px
  );
}

.BizAppointmentCalendar__corner {
  border-left: 0;
}

.BizAppointmentCalendar__time-label {
  padding: 6px 4px;
  font-size: 11px;
  color: #909399;
  text-align: right;
  border-top: 1px solid #f0f2f5;
}

.BizAppointmentCalendar__cell {
  min-height: 56px;
  padding: 4px;
  border-left: 1px solid #f0f2f5;
  border-top: 1px solid #f0f2f5;
  display: flex;
  flex-direction: column;
  gap: 3px;
  position: relative;
  transition: background-color 0.15s;
}

.BizAppointmentCalendar__cell.is-empty {
  cursor: pointer;
}

.BizAppointmentCalendar__cell.is-empty:hover {
  background: #ecf5ff;
  outline: 1px solid #b3d8ff;
  outline-offset: -1px;
}

.BizAppointmentCalendar__cell.is-closed {
  cursor: default;
  background: repeating-linear-gradient(
    45deg,
    #fafafa,
    #fafafa 6px,
    #ececec 6px,
    #ececec 7px
  );
}

.BizAppointmentCalendar__cell.has-items {
  cursor: default;
}

.BizAppointmentCalendar__add-btn {
  opacity: 0;
  margin-top: auto;
  padding: 2px 6px;
  font-size: 11px;
  color: #409eff;
  text-align: center;
  background: rgba(236, 245, 255, 0.85);
  border: 1px dashed #b3d8ff;
  border-radius: 3px;
  cursor: pointer;
  transition: opacity 0.15s, background-color 0.15s;
}

.BizAppointmentCalendar__cell.has-items:hover .BizAppointmentCalendar__add-btn {
  opacity: 1;
}

.BizAppointmentCalendar__add-btn:hover {
  background: #d9ecff;
}

.BizAppointmentCalendar__add-hint {
  opacity: 0;
  font-size: 11px;
  color: #409eff;
  text-align: center;
  align-self: center;
  pointer-events: none;
  transition: opacity 0.15s;
}

.BizAppointmentCalendar__cell.is-empty:hover .BizAppointmentCalendar__add-hint {
  opacity: 1;
}

.BizAppointmentCalendar__chip {
  border-left: 3px solid #409eff;
  background: #f5f7fa;
  padding: 4px 6px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 11px;
}

.BizAppointmentCalendar__chip:hover {
  background: #ecf5ff;
}

.BizAppointmentCalendar__chip-time {
  font-weight: 600;
  color: #303133;
}

.BizAppointmentCalendar__chip-name {
  color: #606266;
}
</style>
