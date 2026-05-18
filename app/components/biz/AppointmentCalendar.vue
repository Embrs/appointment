<script setup lang="ts">
// BizAppointmentCalendar — 商家行事曆（週/日檢視）
// 規範：純前端組件，給定 items 自行 group；切換 mode 與 anchorDate 由 parent 控

interface AppointmentCalendarProps {
  items: AppointmentItem[];
  mode: 'week' | 'day';
  /** 基準日 YYYY-MM-DD（week：該週起點；day：當日） */
  anchorDate: string;
  timezone?: string;
}

const props = withDefaults(defineProps<AppointmentCalendarProps>(), {
  timezone: 'Asia/Taipei'
});

type Emit = {
  'click-cell': [appointment: AppointmentItem];
};
const emit = defineEmits<Emit>();

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 ~ 20:00

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const days = computed(() => {
  if (props.mode === 'day') {
    return [{ date: props.anchorDate, label: $dayjs(props.anchorDate).format('MM/DD (週' + WEEKDAY_LABELS[$dayjs(props.anchorDate).day()] + ')') }];
  }
  // week：自 anchorDate 起算 7 天
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
    .BizAppointmentCalendar__day-header(v-for="d in days" :key="d.date") {{ d.label }}
    //- body
    template(v-for="h in HOURS" :key="h")
      .BizAppointmentCalendar__time-label {{ String(h).padStart(2, '0') }}:00
      .BizAppointmentCalendar__cell(
        v-for="d in days"
        :key="`${d.date}_${h}`"
      )
        .BizAppointmentCalendar__chip(
          v-for="a in ItemsAt(d.date, h)"
          :key="a.id"
          :style="{ borderLeftColor: StatusColor(a.status) }"
          @click="emit('click-cell', a)"
        )
          .BizAppointmentCalendar__chip-time {{ fmtTime(a.startAt) }}
          .BizAppointmentCalendar__chip-name {{ a.customerLastName }} ｜ {{ a.service.name }}
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
