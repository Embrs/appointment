<script setup lang="ts">
// BizQueueConnectionBar — 顧客等待頁連線狀態 banner
// 四態：live / reconnecting / fallback / offline
// 固定高度避免 UI 抖動；reconnecting 顯示倒數秒並提供「立即重試」

import type { QueueConnectionState } from '@/stores/7.store-queue-realtime';

interface ConnectionBarProps {
  state: QueueConnectionState;
  /** reconnecting 時的倒數秒；非 reconnecting 為 0 */
  reconnectIn?: number;
}

const props = withDefaults(defineProps<ConnectionBarProps>(), {
  reconnectIn: 0
});

const emit = defineEmits<{
  (e: 'retry'): void;
}>();

const ClickRetry = () => emit('retry');
</script>

<template lang="pug">
.BizQueueConnectionBar(:class="`BizQueueConnectionBar--${state}`" :data-state="state" data-testid="queue-connection-bar")
  template(v-if="state === 'live'")
    span.BizQueueConnectionBar__dot
    span.BizQueueConnectionBar__text {{ $t('queue.page.connLive') }}
  template(v-else-if="state === 'reconnecting'")
    span.BizQueueConnectionBar__dot.BizQueueConnectionBar__dot--warn
    span.BizQueueConnectionBar__text {{ $t('queue.page.connReconnecting', { n: reconnectIn }) }}
    button.BizQueueConnectionBar__btn(
      type="button"
      data-testid="queue-connection-retry"
      @click="ClickRetry"
    ) {{ $t('queue.page.connRetry') }}
  template(v-else-if="state === 'fallback'")
    span.BizQueueConnectionBar__dot.BizQueueConnectionBar__dot--mute
    span.BizQueueConnectionBar__text {{ $t('queue.page.connFallback') }}
    button.BizQueueConnectionBar__btn.BizQueueConnectionBar__btn--ghost(
      type="button"
      data-testid="queue-connection-retry"
      @click="ClickRetry"
    ) {{ $t('queue.page.connRetry') }}
  template(v-else-if="state === 'offline'")
    span.BizQueueConnectionBar__dot.BizQueueConnectionBar__dot--err
    span.BizQueueConnectionBar__text {{ $t('queue.page.connOffline') }}
</template>

<style lang="scss" scoped>
.BizQueueConnectionBar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 600;
  flex-wrap: nowrap;
  overflow: hidden;
  white-space: nowrap;
}

.BizQueueConnectionBar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: $secondary;
  animation: BizQueueConnectionBar-pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}

.BizQueueConnectionBar__dot--warn {
  background-color: $tertiary;
}

.BizQueueConnectionBar__dot--mute {
  background-color: rgba(69, 69, 69, 0.45);
  animation: none;
}

.BizQueueConnectionBar__dot--err {
  background-color: #ee5151;
  animation: none;
}

.BizQueueConnectionBar__text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.BizQueueConnectionBar__btn {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background-color: $white;
  color: $tertiary;
  border: 1px solid rgba(235, 139, 45, 0.4);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.BizQueueConnectionBar__btn:hover {
  background-color: rgba(235, 139, 45, 0.08);
}

.BizQueueConnectionBar__btn--ghost {
  color: rgba(69, 69, 69, 0.7);
  border-color: rgba(69, 69, 69, 0.25);
}

.BizQueueConnectionBar--live {
  background-color: rgba(0, 173, 169, 0.1);
  color: $secondary;
  height: 32px;
  font-size: 12px;
}

.BizQueueConnectionBar--reconnecting {
  background-color: rgba(235, 139, 45, 0.12);
  color: $tertiary;
}

.BizQueueConnectionBar--fallback {
  background-color: rgba(69, 69, 69, 0.06);
  color: rgba(69, 69, 69, 0.75);
}

.BizQueueConnectionBar--offline {
  background-color: rgba(238, 81, 81, 0.1);
  color: #ee5151;
}

@keyframes BizQueueConnectionBar-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.82); }
}

@media (prefers-reduced-motion: reduce) {
  .BizQueueConnectionBar__dot {
    animation: none;
  }
}
</style>
