<script setup lang="ts">
// BizQueueWindowEditor — 7 列 weekday 領號時間窗編輯器
// 每列 isActive + startTime + endTime + maxTickets（0=無限）
// 父元件以 v-model 取得目前狀態，自行呼叫 UpdateQueueWindows 儲存

type Props = {
  modelValue: QueueWindowItem[];
};
const props = defineProps<Props>();

type Emit = {
  'update:modelValue': [windows: QueueWindowItem[]];
};
const emit = defineEmits<Emit>();

const { t } = useI18n({ useScope: 'global' });

const FALLBACK_WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const;

// vue-i18n `t('key[N]')` 支援索引語法存取陣列翻譯；逐項取避免 `tm()` 在 nuxt-i18n
// 環境下 reactivity 不穩。任一格取回 key 字串（i18n 未命中）時 fallback 整組硬編碼。
const WEEKDAY_NAMES = computed<readonly string[]>(() => {
  const names: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const v = t(`common.weekdayLong[${i}]`);
    if (typeof v !== 'string' || v.length === 0 || v.startsWith('common.')) {
      return FALLBACK_WEEKDAYS;
    }
    names.push(v);
  }
  return names;
});

const DEFAULT_ROW = (weekday: number): QueueWindowItem => ({
  weekday,
  startTime: '09:00',
  endTime: '18:00',
  maxTickets: 0,
  isActive: false
});

// 把 modelValue 攤平成「每 weekday 一段」陣列；缺的 weekday 用預設值補
const rows = computed<QueueWindowItem[]>(() => {
  const byDay = new Map<number, QueueWindowItem>();
  for (const w of props.modelValue) {
    if (w.weekday >= 0 && w.weekday <= 6 && !byDay.has(w.weekday)) {
      byDay.set(w.weekday, { ...w });
    }
  }
  const out: QueueWindowItem[] = [];
  for (let i = 0; i < 7; i += 1) {
    out.push(byDay.get(i) ?? DEFAULT_ROW(i));
  }
  return out;
});

const firstActiveRow = computed<QueueWindowItem | undefined>(() =>
  rows.value.find((r) => r.isActive)
);

const Update = (weekday: number, patch: Partial<QueueWindowItem>) => {
  const next = rows.value.map((r) => (r.weekday === weekday ? { ...r, ...patch } : { ...r }));
  emit('update:modelValue', next);
};

const ApplyToWeekdays = () => {
  const source = firstActiveRow.value;
  if (!source) return;
  const next = rows.value.map<QueueWindowItem>((r) => {
    if (r.weekday >= 1 && r.weekday <= 5) {
      return {
        weekday: r.weekday,
        startTime: source.startTime,
        endTime: source.endTime,
        maxTickets: source.maxTickets,
        isActive: true
      };
    }
    return { ...r };
  });
  emit('update:modelValue', next);
};

const ApplyToAllDays = async () => {
  const source = firstActiveRow.value;
  if (!source) return;
  try {
    await ElMessageBox.confirm(
      t('admin.queueWindow.applyAllDaysConfirm'),
      t('admin.queueWindow.applyAllDays'),
      {
        confirmButtonText: t('admin.queueWindow.applyAllDays'),
        type: 'warning'
      }
    );
  } catch {
    return;
  }
  const next = rows.value.map<QueueWindowItem>((r) => ({
    weekday: r.weekday,
    startTime: source.startTime,
    endTime: source.endTime,
    maxTickets: source.maxTickets,
    isActive: true
  }));
  emit('update:modelValue', next);
};
</script>

<template lang="pug">
.BizQueueWindowEditor
  .BizQueueWindowEditor__toolbar
    ElTooltip(
      :content="$t('admin.queueWindow.needSourceRow')"
      :disabled="!!firstActiveRow"
      placement="top"
    )
      span.BizQueueWindowEditor__toolbarBtnWrap
        ElButton(
          type="primary"
          plain
          :disabled="!firstActiveRow"
          data-testid="queue-window-apply-weekdays"
          @click="ApplyToWeekdays"
        ) {{ $t('admin.queueWindow.applyWeekdays') }}
    ElTooltip(
      :content="$t('admin.queueWindow.needSourceRow')"
      :disabled="!!firstActiveRow"
      placement="top"
    )
      span.BizQueueWindowEditor__toolbarBtnWrap
        ElButton(
          type="primary"
          plain
          :disabled="!firstActiveRow"
          data-testid="queue-window-apply-all-days"
          @click="ApplyToAllDays"
        ) {{ $t('admin.queueWindow.applyAllDays') }}
  .BizQueueWindowEditor__row(
    v-for="row in rows"
    :key="row.weekday"
    :class="{ 'BizQueueWindowEditor__row--weekend': row.weekday === 0 || row.weekday === 6 }"
  )
    .BizQueueWindowEditor__day {{ WEEKDAY_NAMES[row.weekday] }}
    .BizQueueWindowEditor__cell.BizQueueWindowEditor__cell--switch
      ElSwitch(
        :model-value="row.isActive"
        @update:model-value="(v: boolean | string | number) => Update(row.weekday, { isActive: Boolean(v) })"
      )
    .BizQueueWindowEditor__cell.BizQueueWindowEditor__cell--time
      ElTimePicker(
        :model-value="row.startTime"
        format="HH:mm"
        value-format="HH:mm"
        :clearable="false"
        :disabled="!row.isActive"
        :data-testid="`queue-window-start-${row.weekday}`"
        @update:model-value="(v: string) => Update(row.weekday, { startTime: v })"
      )
      span.BizQueueWindowEditor__sep –
      ElTimePicker(
        :model-value="row.endTime"
        format="HH:mm"
        value-format="HH:mm"
        :clearable="false"
        :disabled="!row.isActive"
        :data-testid="`queue-window-end-${row.weekday}`"
        @update:model-value="(v: string) => Update(row.weekday, { endTime: v })"
      )
    .BizQueueWindowEditor__cell.BizQueueWindowEditor__cell--max
      ElInputNumber(
        :model-value="row.maxTickets"
        :min="0"
        :step="1"
        :disabled="!row.isActive"
        :data-testid="`queue-window-max-${row.weekday}`"
        @update:model-value="(v: number | undefined) => Update(row.weekday, { maxTickets: Number(v ?? 0) })"
      )
      span.BizQueueWindowEditor__hint {{ $t('admin.queueWindow.maxTicketsHint') }}
</template>

<style lang="scss" scoped>
.BizQueueWindowEditor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.BizQueueWindowEditor__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 4px;
  background-color: #f8fafc;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
}

.BizQueueWindowEditor__toolbarBtnWrap {
  display: inline-flex;
}

.BizQueueWindowEditor__row {
  display: grid;
  grid-template-columns: 72px 60px auto auto;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  background-color: #fafbfc;
  border-radius: 6px;
}

.BizQueueWindowEditor__row--weekend {
  background-color: #f4f6fa;

  .BizQueueWindowEditor__day {
    color: #909399;
  }
}

.BizQueueWindowEditor__day {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.BizQueueWindowEditor__cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.BizQueueWindowEditor__sep {
  color: #909399;
  font-size: 14px;
}

.BizQueueWindowEditor__hint {
  font-size: 12px;
  color: #909399;
}

@media (max-width: 760px) {
  .BizQueueWindowEditor__row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .BizQueueWindowEditor__cell {
    flex-wrap: wrap;
  }
}
</style>
