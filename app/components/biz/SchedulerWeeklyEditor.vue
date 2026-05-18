<script setup lang="ts">
// BizSchedulerWeeklyEditor — 七天網格時段編輯器
// 桌機：七列橫排；手機：折疊清單
// 父元件用 v-model:rules 取得整週 rules 後呼叫 UpdateScheduleRules 儲存

type RuleInput = {
  weekday: number;
  startTime: string;
  endTime: string;
};

type Props = {
  rules: RuleInput[];
  scope: ScheduleScopeType;
  resourceId?: string | null;
};

const props = defineProps<Props>();

type Emit = {
  'update:rules': [rules: RuleInput[]];
};
const emit = defineEmits<Emit>();

const storeTool = StoreTool();

const WEEKDAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

const rulesByDay = computed<Record<number, RuleInput[]>>(() => {
  const map: Record<number, RuleInput[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const r of props.rules) {
    if (r.weekday >= 0 && r.weekday <= 6) {
      map[r.weekday]!.push(r);
    }
  }
  for (const day of Object.keys(map)) {
    map[Number(day)]!.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return map;
});

const ClickAdd = async (weekday: number) => {
  const res = await $open.DialogScheduleRuleEdit({ mode: 'create', weekday });
  if (!res || !res.done || !res.rule) return;
  const next = [...props.rules, { weekday: res.rule.weekday, startTime: res.rule.startTime, endTime: res.rule.endTime }];
  emit('update:rules', next);
};

const ClickRemove = (rule: RuleInput) => {
  const next = props.rules.filter((r) =>
    !(r.weekday === rule.weekday && r.startTime === rule.startTime && r.endTime === rule.endTime)
  );
  emit('update:rules', next);
};

const activeCollapse = ref<number[]>([1, 2, 3, 4, 5]);
</script>

<template lang="pug">
.BizSchedulerWeeklyEditor
  //- 桌機版：七列橫排
  template(v-if="!storeTool.isMobile")
    .BizSchedulerWeeklyEditor__row(v-for="day in 7" :key="day - 1")
      .BizSchedulerWeeklyEditor__day {{ WEEKDAY_NAMES[day - 1] }}
      .BizSchedulerWeeklyEditor__slots
        .BizSchedulerWeeklyEditor__chip(
          v-for="rule in rulesByDay[day - 1]"
          :key="`${rule.startTime}-${rule.endTime}`"
        )
          span {{ rule.startTime }} – {{ rule.endTime }}
          button.BizSchedulerWeeklyEditor__remove(
            type="button"
            @click="ClickRemove(rule)"
          ) ✕
        ElButton(
          size="small"
          plain
          @click="ClickAdd(day - 1)"
        ) + 新增時段
  //- 手機版：折疊清單
  template(v-else)
    ElCollapse(v-model="activeCollapse")
      ElCollapseItem(
        v-for="day in 7"
        :key="day - 1"
        :name="day - 1"
      )
        template(#title)
          .BizSchedulerWeeklyEditor__collapse-title
            span {{ WEEKDAY_NAMES[day - 1] }}
            span.BizSchedulerWeeklyEditor__collapse-count {{ rulesByDay[day - 1].length }} 段
        .BizSchedulerWeeklyEditor__collapse-body
          .BizSchedulerWeeklyEditor__chip(
            v-for="rule in rulesByDay[day - 1]"
            :key="`${rule.startTime}-${rule.endTime}`"
          )
            span {{ rule.startTime }} – {{ rule.endTime }}
            button.BizSchedulerWeeklyEditor__remove(
              type="button"
              @click="ClickRemove(rule)"
            ) ✕
          ElButton(
            size="small"
            plain
            @click="ClickAdd(day - 1)"
          ) + 新增時段
</template>

<style lang="scss" scoped>
.BizSchedulerWeeklyEditor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.BizSchedulerWeeklyEditor__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background-color: #fafbfc;
  border-radius: 4px;
}

.BizSchedulerWeeklyEditor__day {
  flex-shrink: 0;
  width: 64px;
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.BizSchedulerWeeklyEditor__slots {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.BizSchedulerWeeklyEditor__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background-color: #ecf5ff;
  color: #409eff;
  border-radius: 4px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.BizSchedulerWeeklyEditor__remove {
  background: transparent;
  border: 0;
  color: #909399;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.BizSchedulerWeeklyEditor__remove:hover {
  color: #f56c6c;
}

.BizSchedulerWeeklyEditor__collapse-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.BizSchedulerWeeklyEditor__collapse-count {
  font-size: 12px;
  color: #909399;
  font-weight: 400;
}

.BizSchedulerWeeklyEditor__collapse-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  padding: 4px 0;
}
</style>
