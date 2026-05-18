<script setup lang="ts">
// BizSlotPicker — 時段選擇 grid
// 規範：slot 以 startAt ISO 為 key；剩餘 0 時 disabled 並標「滿」

interface SlotItem {
  startAt: string;
  endAt: string;
  capacity: number;
  remaining: number;
}

interface SlotPickerProps {
  modelValue: string | null; // 已選 slot 的 startAt ISO
  slots: SlotItem[];
  timezone: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<SlotPickerProps>(), {
  loading: false
});

type Emit = { 'update:modelValue': [startAt: string] };
const emit = defineEmits<Emit>();

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return $dayjs(d).tz(props.timezone).format('HH:mm');
  } catch {
    return iso;
  }
};

const ClickPick = (slot: SlotItem) => {
  if (slot.remaining <= 0) return;
  emit('update:modelValue', slot.startAt);
};
</script>

<template lang="pug">
.BizSlotPicker
  .BizSlotPicker__loading(v-if="loading") 載入中…
  .BizSlotPicker__empty(v-else-if="slots.length === 0") 該日無可預約時段
  .BizSlotPicker__grid(v-else)
    button.BizSlotPicker__slot(
      v-for="slot in slots"
      :key="slot.startAt"
      type="button"
      :class="{ 'is-active': slot.startAt === modelValue, 'is-full': slot.remaining <= 0 }"
      :disabled="slot.remaining <= 0"
      @click="ClickPick(slot)"
    )
      span.BizSlotPicker__time {{ fmtTime(slot.startAt) }}
      span.BizSlotPicker__cap(v-if="slot.capacity > 1") 剩 {{ slot.remaining }}
      span.BizSlotPicker__cap(v-else-if="slot.remaining <= 0") 滿
</template>

<style lang="scss" scoped>
.BizSlotPicker {
  width: 100%;
}

.BizSlotPicker__loading,
.BizSlotPicker__empty {
  padding: 24px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.BizSlotPicker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 8px;
}

.BizSlotPicker__slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.BizSlotPicker__slot:hover:not(.is-active):not(.is-full) {
  border-color: #409eff;
  color: #409eff;
}

.BizSlotPicker__slot.is-active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.BizSlotPicker__slot.is-full {
  background: #f5f7fa;
  color: #c0c4cc;
  cursor: not-allowed;
}

.BizSlotPicker__time {
  font-size: 15px;
  font-weight: 600;
}

.BizSlotPicker__cap {
  font-size: 11px;
  opacity: 0.8;
}
</style>
