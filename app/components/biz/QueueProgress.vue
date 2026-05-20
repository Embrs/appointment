<script setup lang="ts">
// BizQueueProgress — 號碼牌等待進度視覺
// 四節點：起點 → 目前叫號 → 你 → 隊尾
// 邊界：currentServing=0 顯示「尚未開始叫號」；myNumber < currentServing 顯示「已過號」

interface QueueProgressProps {
  /** 起算號碼，MVP 一律 1 */
  startNumber?: number;
  /** 目前叫到的號碼；0 表示尚未開始 */
  currentServing: number;
  /** 我的號碼 */
  myNumber: number;
  /** 當日已發出總數 */
  totalTaken: number;
  /** 我的當前 status（用於判斷已過號樣式） */
  myStatus?: 'WAITING' | 'CALLED' | 'DONE' | 'SKIPPED' | 'CANCELED';
}

const props = withDefaults(defineProps<QueueProgressProps>(), {
  startNumber: 1,
  myStatus: 'WAITING'
});

const NotStarted = computed(() => props.currentServing === 0);
const Passed = computed(() =>
  props.myStatus === 'WAITING' && props.currentServing > props.myNumber
);
const Ahead = computed(() => Math.max(0, props.myNumber - props.currentServing - 1));

/** 將號碼映射到 0–100 之間的百分比；start..end 為已知端點 */
const Percent = (n: number) => {
  const lo = props.startNumber;
  const hi = Math.max(props.totalTaken, props.myNumber, props.currentServing, lo + 1);
  if (hi <= lo) return 0;
  return Math.max(0, Math.min(100, ((n - lo) / (hi - lo)) * 100));
};

const ServingPercent = computed(() => Percent(Math.max(props.currentServing, props.startNumber)));
const MyPercent = computed(() => Percent(props.myNumber));
</script>

<template lang="pug">
.BizQueueProgress
  template(v-if="NotStarted")
    .BizQueueProgress__notStarted {{ $t('queue.page.progressNotStarted') }}
  template(v-else-if="Passed")
    .BizQueueProgress__passed {{ $t('queue.page.progressPassed') }}
  template(v-else)
    //- 軌道 + 已過進度
    .BizQueueProgress__track
      .BizQueueProgress__fill(:style="{ width: ServingPercent + '%' }")
      //- 目前叫號指示器
      .BizQueueProgress__marker.BizQueueProgress__marker--serving(
        :style="{ left: ServingPercent + '%' }"
        :aria-label="$t('queue.page.currentServing')"
      )
        .BizQueueProgress__markerDot
        .BizQueueProgress__markerBadge {{ currentServing }}
      //- 我的指示器
      .BizQueueProgress__marker.BizQueueProgress__marker--mine(
        :style="{ left: MyPercent + '%' }"
        :aria-label="$t('queue.page.progressYou')"
      )
        .BizQueueProgress__markerDot
        .BizQueueProgress__markerBadge.BizQueueProgress__markerBadge--mine {{ myNumber }}
    //- 端點標籤
    .BizQueueProgress__legend
      span.BizQueueProgress__legendStart {{ $t('queue.page.progressStart') }}
      span.BizQueueProgress__legendEnd {{ totalTaken || myNumber }}
    //- 前面還有 N 位
    .BizQueueProgress__ahead {{ $t('queue.page.progressAhead', { n: Ahead }) }}
</template>

<style lang="scss" scoped>
.BizQueueProgress {
  background-color: $white;
  padding: 22px 22px 16px;
  border-radius: 14px;
  border: 1px solid rgba(53, 77, 123, 0.08);
  box-shadow: 0 4px 12px -8px rgba(31, 42, 68, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.BizQueueProgress__notStarted,
.BizQueueProgress__passed {
  padding: 14px 12px;
  text-align: center;
  font-size: 13.5px;
  color: rgba(69, 69, 69, 0.7);
  background-color: rgba(53, 77, 123, 0.04);
  border-radius: 10px;
}

.BizQueueProgress__passed {
  color: $tertiary;
  background-color: rgba(235, 139, 45, 0.1);
}

.BizQueueProgress__track {
  position: relative;
  height: 8px;
  background-color: rgba(53, 77, 123, 0.08);
  border-radius: 999px;
  margin: 28px 12px 28px;
}

.BizQueueProgress__fill {
  position: absolute;
  inset: 0;
  height: 100%;
  background: linear-gradient(90deg, $secondary 0%, #4dd0c8 100%);
  border-radius: 999px;
  transition: width 0.6s ease-out;
  max-width: 100%;
}

.BizQueueProgress__marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: left 0.6s ease-out;
}

.BizQueueProgress__markerDot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: $secondary;
  border: 3px solid $white;
  box-shadow: 0 0 0 2px rgba(0, 173, 169, 0.35);
}

.BizQueueProgress__marker--mine .BizQueueProgress__markerDot {
  background-color: $tertiary;
  box-shadow: 0 0 0 2px rgba(235, 139, 45, 0.35);
}

.BizQueueProgress__markerBadge {
  position: absolute;
  bottom: 18px;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: $secondary;
  color: $white;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.BizQueueProgress__markerBadge--mine {
  background-color: $tertiary;
  bottom: auto;
  top: 18px;
}

.BizQueueProgress__legend {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(69, 69, 69, 0.55);
  letter-spacing: 0.04em;
  padding: 0 4px;
}

.BizQueueProgress__ahead {
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: $tertiary;
  background-color: rgba(235, 139, 45, 0.1);
  padding: 8px 14px;
  border-radius: 999px;
  align-self: center;
}

@media (max-width: 360px) {
  .BizQueueProgress {
    padding: 18px 16px 14px;
  }
  .BizQueueProgress__track {
    margin: 24px 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .BizQueueProgress__fill,
  .BizQueueProgress__marker {
    transition: none;
  }
}
</style>
