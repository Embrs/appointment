<script setup lang="ts">
// BizResourcePicker — 資源選擇
// allowAny=true 時於最上方顯示「不指定（由系統自動分配）」固定項，sentinel 為 '__any__'

interface ResourceItem {
  id: string;
  name: string;
  description: string | null;
}

interface ResourcePickerProps {
  modelValue: string | null;
  resources: ResourceItem[];
  allowAny?: boolean;
  anyLabel?: string;
  anyDescription?: string;
}

withDefaults(defineProps<ResourcePickerProps>(), {
  allowAny: false,
  anyLabel: '不指定（由系統自動分配）',
  anyDescription: ''
});

type Emit = { 'update:modelValue': [id: string] };
const emit = defineEmits<Emit>();
</script>

<template lang="pug">
.BizResourcePicker
  .BizResourcePicker__empty(v-if="resources.length === 0 && !allowAny") 此服務尚未綁定資源
  .BizResourcePicker__list(v-else)
    button.BizResourcePicker__item.BizResourcePicker__item--any(
      v-if="allowAny"
      type="button"
      :class="{ 'is-active': modelValue === '__any__' }"
      @click="emit('update:modelValue', '__any__')"
    )
      .BizResourcePicker__name {{ anyLabel }}
      .BizResourcePicker__desc(v-if="anyDescription") {{ anyDescription }}
    button.BizResourcePicker__item(
      v-for="r in resources"
      :key="r.id"
      type="button"
      :class="{ 'is-active': r.id === modelValue }"
      @click="emit('update:modelValue', r.id)"
    )
      .BizResourcePicker__name {{ r.name }}
      .BizResourcePicker__desc(v-if="r.description") {{ r.description }}
</template>

<style lang="scss" scoped>
.BizResourcePicker {
  width: 100%;
}

.BizResourcePicker__empty {
  padding: 16px;
  text-align: center;
  color: #909399;
}

.BizResourcePicker__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

.BizResourcePicker__item {
  text-align: left;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.BizResourcePicker__item:hover:not(.is-active) {
  border-color: #409eff;
}

.BizResourcePicker__item.is-active {
  background: #ecf5ff;
  border-color: #409eff;
}

.BizResourcePicker__item--any {
  border-style: dashed;
}

.BizResourcePicker__item--any.is-active {
  border-style: solid;
}

.BizResourcePicker__name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.BizResourcePicker__desc {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
</style>
