<script setup lang="ts">
// BizQueueDisplay — 大號碼顯示（您的號碼 / 服務中號碼）
// 顧客等待頁與商家叫號台共用

interface QueueDisplayProps {
  /** 大字呈現的標題（例如 "您的號碼"、"服務中"） */
  primaryLabel: string;
  /** 大字數字（0 顯示 - -） */
  primaryNumber: number;
  /** 副標題（例如 "目前服務中"） */
  secondaryLabel?: string;
  /** 副數字 */
  secondaryNumber?: number;
  /** 高亮主數字（自己被叫到時用） */
  highlight?: boolean;
  /** 補充提示文字 */
  hint?: string;
  /** 服務名稱（顯示在標題上方） */
  serviceName?: string;
}

const props = withDefaults(defineProps<QueueDisplayProps>(), {
  secondaryLabel: '',
  secondaryNumber: 0,
  highlight: false,
  hint: '',
  serviceName: ''
});

const PrimaryText = computed(() => {
  return props.primaryNumber > 0 ? String(props.primaryNumber).padStart(2, '0') : '--';
});

const SecondaryText = computed(() => {
  return props.secondaryNumber > 0 ? String(props.secondaryNumber).padStart(2, '0') : '--';
});
</script>

<template lang="pug">
.BizQueueDisplay(:class="{ 'BizQueueDisplay--highlight': highlight }")
  .BizQueueDisplay__service(v-if="serviceName") {{ serviceName }}
  .BizQueueDisplay__primary-label {{ primaryLabel }}
  .BizQueueDisplay__primary-number {{ PrimaryText }}
  .BizQueueDisplay__secondary(v-if="secondaryLabel")
    .BizQueueDisplay__secondary-label {{ secondaryLabel }}
    .BizQueueDisplay__secondary-number {{ SecondaryText }}
  .BizQueueDisplay__hint(v-if="hint") {{ hint }}
</template>

<style lang="scss" scoped>
.BizQueueDisplay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 16px;
  background: linear-gradient(180deg, #f5f7fa 0%, #ffffff 100%);
  border-radius: 12px;
  border: 1px solid #ebeef5;
  text-align: center;
}

.BizQueueDisplay--highlight {
  background: linear-gradient(180deg, #fff5f5 0%, #ffe4e4 100%);
  border-color: #f56c6c;
  animation: BizQueueDisplay-pulse 1.5s ease-in-out infinite;
}

.BizQueueDisplay__service {
  font-size: 16px;
  color: #606266;
}

.BizQueueDisplay__primary-label {
  font-size: 18px;
  color: #303133;
  letter-spacing: 4px;
}

.BizQueueDisplay__primary-number {
  font-size: 120px;
  font-weight: 800;
  line-height: 1;
  color: #303133;
  letter-spacing: 4px;
  font-variant-numeric: tabular-nums;
}

.BizQueueDisplay--highlight .BizQueueDisplay__primary-number {
  color: #f56c6c;
}

.BizQueueDisplay__secondary {
  margin-top: 8px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.BizQueueDisplay__secondary-label {
  font-size: 14px;
  color: #909399;
}

.BizQueueDisplay__secondary-number {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
  font-variant-numeric: tabular-nums;
}

.BizQueueDisplay__hint {
  margin-top: 12px;
  font-size: 14px;
  color: #909399;
}

@keyframes BizQueueDisplay-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(245 108 108 / 30%); }
  50% { box-shadow: 0 0 0 16px rgb(245 108 108 / 0%); }
}

@media (max-width: 600px) {
  .BizQueueDisplay__primary-number {
    font-size: 88px;
  }
}
</style>
