<script setup lang="ts">
// BizQueueCallOverlay — 顧客被叫號時的全螢幕蓋層
// 觸發條件：使用者自己的票 status=CALLED 時由父層條件渲染
// 動畫：滿版漸層背景 + 號碼脈動 3 次後停（避免長時間刺激）
// 無障礙：響應 prefers-reduced-motion；按 ESC 或按鈕 dismiss
import { onMounted, onBeforeUnmount } from 'vue';

interface CallOverlayProps {
  ticketNumber: number;
  serviceName?: string;
}

const props = withDefaults(defineProps<CallOverlayProps>(), {
  serviceName: ''
});

const emit = defineEmits<{
  (e: 'dismiss'): void;
}>();

const PrimaryText = computed(() =>
  props.ticketNumber > 0 ? String(props.ticketNumber).padStart(2, '0') : '--'
);

const ClickDismiss = () => emit('dismiss');

// 鍵盤 ESC 關閉
const HandleKeyDown = (ev: KeyboardEvent) => {
  if (ev.key === 'Escape') emit('dismiss');
};

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', HandleKeyDown);
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', HandleKeyDown);
  }
});
</script>

<template lang="pug">
.BizQueueCallOverlay(role="dialog" aria-modal="true" data-testid="queue-call-overlay")
  .BizQueueCallOverlay__inner
    .BizQueueCallOverlay__bell 🔔
    h2.BizQueueCallOverlay__title {{ $t('queue.page.callOverlayTitle') }}
    .BizQueueCallOverlay__service(v-if="serviceName") {{ serviceName }}
    .BizQueueCallOverlay__number {{ PrimaryText }}
    p.BizQueueCallOverlay__subtitle {{ $t('queue.page.callOverlaySubtitle') }}
    button.BizQueueCallOverlay__dismiss(
      type="button"
      data-testid="queue-call-overlay-dismiss"
      @click="ClickDismiss"
    ) {{ $t('queue.page.callOverlayDismiss') }}
</template>

<style lang="scss" scoped>
.BizQueueCallOverlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff7a2a 0%, #ff5a36 60%, #ff3d3d 100%);
  color: $white;
  animation: BizQueueCallOverlay-pulse 1s ease-in-out 3;
  animation-fill-mode: forwards;
  padding: 24px;
  overflow: hidden;
}

.BizQueueCallOverlay::before,
.BizQueueCallOverlay::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.BizQueueCallOverlay::before {
  width: 60vmin;
  height: 60vmin;
  top: -20vmin;
  left: -20vmin;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.18), transparent 60%);
}

.BizQueueCallOverlay::after {
  width: 50vmin;
  height: 50vmin;
  bottom: -16vmin;
  right: -16vmin;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.14), transparent 60%);
}

.BizQueueCallOverlay__inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  max-width: 100%;
}

.BizQueueCallOverlay__bell {
  font-size: clamp(36px, 9vw, 56px);
  animation: BizQueueCallOverlay-bell 0.6s ease-in-out 3;
  animation-fill-mode: forwards;
}

.BizQueueCallOverlay__title {
  margin: 0;
  font-size: clamp(28px, 8vw, 56px);
  font-weight: 800;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.BizQueueCallOverlay__service {
  font-size: clamp(14px, 4vw, 20px);
  opacity: 0.86;
  padding: 4px 14px;
  border-radius: 999px;
  background-color: rgba(255, 255, 255, 0.18);
  max-width: 80vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.BizQueueCallOverlay__number {
  font-size: min(60vmin, 360px);
  line-height: 0.95;
  font-weight: 900;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  margin: -8px 0;
}

.BizQueueCallOverlay__subtitle {
  margin: 0;
  font-size: clamp(15px, 4.5vw, 22px);
  font-weight: 600;
  opacity: 0.94;
  max-width: 90vw;
}

.BizQueueCallOverlay__dismiss {
  margin-top: 16px;
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 700;
  color: #ff3d3d;
  background-color: $white;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.BizQueueCallOverlay__dismiss:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}

@keyframes BizQueueCallOverlay-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.18); }
}

@keyframes BizQueueCallOverlay-bell {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(-12deg); }
  75% { transform: rotate(12deg); }
}

// 小螢幕優化
@media (max-width: 360px) {
  .BizQueueCallOverlay__number {
    font-size: 40vmin;
  }
}

// 動畫降級（無障礙）
@media (prefers-reduced-motion: reduce) {
  .BizQueueCallOverlay,
  .BizQueueCallOverlay__bell {
    animation: none;
  }
  .BizQueueCallOverlay__dismiss {
    transition: none;
  }
}
</style>
