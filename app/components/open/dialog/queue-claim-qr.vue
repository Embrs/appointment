<script setup lang="ts">
// OpenDialogQueueClaimQr — 顧客領號成功 QR Code 對話框
// 用途：領號當下顯示 QR Code + 8 碼短碼，讓顧客掃碼到 status 頁追蹤、可離場
type Props = {
  params: DialogQueueClaimQrParams;
  resolve: (value: { done: boolean }) => void;
  level: number;
};
const props = defineProps<Props>();

const { t } = useI18n();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const qrReady = ref(false);
const qrError = ref(false);

// QR 內容：絕對 URL（同時支援多商家自訂網域與 dev/prod）
const ClaimUrl = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/m/${props.params.slug}/queue/status?token=${encodeURIComponent(props.params.claimToken)}`;
});

const RenderQr = async () => {
  if (!canvasRef.value) return;
  try {
    // 動態 import 避免拖慢領號表單 bundle
    const QRCode = await import('qrcode');
    await QRCode.toCanvas(canvasRef.value, ClaimUrl.value, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1f2a44', light: '#ffffff' }
    });
    qrReady.value = true;
  } catch {
    qrError.value = true;
  }
};

const CopyLink = async () => {
  try {
    await navigator.clipboard.writeText(ClaimUrl.value);
    ElMessage.success(t('queue.claim.copyLink'));
  } catch {
    // 部分瀏覽器拒絕；忽略以不打斷流程
  }
};

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = () => {
  props.resolve({ done: true });
  emit('on-close');
};

onMounted(() => {
  // 給 DOM 一個 frame 再 render（避免 canvas 還沒掛上）
  requestAnimationFrame(() => {
    RenderQr();
  });
});
</script>

<template lang="pug">
.OpenDialogQueueClaimQr
  .OpenDialogQueueClaimQr__mask(v-motion-fade)
  .OpenDialogQueueClaimQr__content(v-motion-roll-bottom)
    .OpenDialogQueueClaimQr__header
      span.OpenDialogQueueClaimQr__title {{ $t('queue.claim.title') }}
      button.OpenDialogQueueClaimQr__close(type="button" @click="EmitClose") ✕

    .OpenDialogQueueClaimQr__body
      .OpenDialogQueueClaimQr__numberRow(v-if="params.ticketNumber")
        span.OpenDialogQueueClaimQr__numberLabel {{ $t('queue.walkIn.printTicket.numberLabel') }}
        span.OpenDialogQueueClaimQr__numberValue {{ String(params.ticketNumber).padStart(2, '0') }}

      p.OpenDialogQueueClaimQr__hint {{ $t('queue.claim.qrHint') }}

      .OpenDialogQueueClaimQr__qrWrap(:class="{ 'OpenDialogQueueClaimQr__qrWrap--error': qrError }")
        canvas.OpenDialogQueueClaimQr__canvas(v-show="!qrError" ref="canvasRef" data-testid="queue-claim-qr-canvas")
        .OpenDialogQueueClaimQr__qrFallback(v-if="qrError")
          .OpenDialogQueueClaimQr__qrFallbackTitle {{ $t('queue.claim.qrFallbackLabel') }}
          .OpenDialogQueueClaimQr__qrFallbackUrl {{ ClaimUrl }}

      .OpenDialogQueueClaimQr__shortCodeBlock
        span.OpenDialogQueueClaimQr__shortCodeLabel {{ $t('queue.claim.shortCode') }}
        span.OpenDialogQueueClaimQr__shortCodeValue(data-testid="queue-claim-short-code") {{ params.claimToken }}
        span.OpenDialogQueueClaimQr__shortCodeHint {{ $t('queue.claim.shortCodeHint') }}

      .OpenDialogQueueClaimQr__validity {{ $t('queue.claim.todayOnly') }}

    .OpenDialogQueueClaimQr__footer
      ElButton(@click="CopyLink") {{ $t('queue.claim.copyLink') }}
      ElButton(type="primary" data-testid="queue-claim-got-it" @click="EmitClose") {{ $t('queue.claim.gotIt') }}
</template>

<style lang="scss" scoped>
.OpenDialogQueueClaimQr {
  @include fixed("fill");
  @include center;
}

.OpenDialogQueueClaimQr__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogQueueClaimQr__content {
  position: relative;
  z-index: 1;
  width: min(380px, calc(100vw - 32px));
  background: $white;
  border-radius: 14px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 22%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.OpenDialogQueueClaimQr__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(53, 77, 123, 0.1);
}

.OpenDialogQueueClaimQr__title {
  font-size: 16px;
  font-weight: 700;
  color: $primary;
}

.OpenDialogQueueClaimQr__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: rgba(69, 69, 69, 0.55);
}

.OpenDialogQueueClaimQr__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  text-align: center;
}

.OpenDialogQueueClaimQr__numberRow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.OpenDialogQueueClaimQr__numberLabel {
  font-size: 12px;
  color: rgba(69, 69, 69, 0.6);
}

.OpenDialogQueueClaimQr__numberValue {
  font-size: 36px;
  font-weight: 800;
  color: $secondary;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.OpenDialogQueueClaimQr__hint {
  margin: 0;
  font-size: 13px;
  color: rgba(69, 69, 69, 0.75);
  line-height: 1.55;
}

.OpenDialogQueueClaimQr__qrWrap {
  padding: 10px;
  background: $white;
  border-radius: 12px;
  border: 1px solid rgba(53, 77, 123, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  min-width: 220px;
}

.OpenDialogQueueClaimQr__qrWrap--error {
  background-color: rgba(238, 81, 81, 0.04);
  border-color: rgba(238, 81, 81, 0.2);
}

.OpenDialogQueueClaimQr__canvas {
  display: block;
}

.OpenDialogQueueClaimQr__qrFallback {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
}

.OpenDialogQueueClaimQr__qrFallbackTitle {
  font-size: 12px;
  font-weight: 600;
  color: #ee5151;
}

.OpenDialogQueueClaimQr__qrFallbackUrl {
  font-size: 11.5px;
  word-break: break-all;
  color: $primary;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.OpenDialogQueueClaimQr__shortCodeBlock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  padding: 12px 16px;
  background-color: rgba(0, 173, 169, 0.08);
  border: 1px dashed rgba(0, 173, 169, 0.45);
  border-radius: 10px;
  width: 100%;
}

.OpenDialogQueueClaimQr__shortCodeLabel {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: $secondary;
  text-transform: uppercase;
}

.OpenDialogQueueClaimQr__shortCodeValue {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.18em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: $primary;
}

.OpenDialogQueueClaimQr__shortCodeHint {
  font-size: 11.5px;
  color: rgba(69, 69, 69, 0.6);
  line-height: 1.5;
}

.OpenDialogQueueClaimQr__validity {
  font-size: 12px;
  color: rgba(69, 69, 69, 0.55);
}

.OpenDialogQueueClaimQr__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px 16px;
  border-top: 1px solid rgba(53, 77, 123, 0.08);
}
</style>
