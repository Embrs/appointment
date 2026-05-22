<script setup lang="ts">
// OpenDialogQueueWalkIn — 商家現場代客領號表單
// 流程：櫃台填 lastName / title / phone? → POST /nuxt-api/queue/create-for-customer
//      成功後在彈窗內呈現已領號碼，提供「列印小單」（window.print() + @media print）
import type { FormInstance, FormRules } from 'element-plus';

type Props = {
  params: DialogQueueWalkInParams;
  resolve: (value: { done: boolean; ticketId?: string; ticketNumber?: number }) => void;
  level: number;
};
const props = defineProps<Props>();

const { t } = useI18n();
const formRef = ref<FormInstance | null>(null);
const submitting = ref(false);
const printing = ref(false);

type TicketResult = {
  ticketId: string;
  ticketNumber: number;
  ticketDate: string;
  takenAt: string;
  claimToken: string;
};
const issued = ref<TicketResult | null>(null);
const printQrCanvas = ref<HTMLCanvasElement | null>(null);
const slugForClaim = computed(() => {
  // 走前端 route 取得 slug；walk-in dialog 由商家後台開啟，但顧客掃碼仍指向 m/[slug]
  // 商家可在 params.merchantSlug 提供；缺省則 fallback 空字串，dialog 仍可顯示短碼
  return props.params.merchantSlug ?? '';
});
const ClaimUrl = computed(() => {
  if (!issued.value || !slugForClaim.value) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/m/${slugForClaim.value}/queue/status?token=${encodeURIComponent(issued.value.claimToken)}`;
});

const RenderPrintQr = async () => {
  if (!printQrCanvas.value || !ClaimUrl.value) return;
  try {
    const QRCode = await import('qrcode');
    await QRCode.toCanvas(printQrCanvas.value, ClaimUrl.value, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch {
    // 列印 QR 失敗時保留短碼與 URL 文字，仍可手動輸入
  }
};

const form = reactive({
  lastName: '',
  title: 'MR' as CustomerTitleType,
  phone: ''
});

const rules = computed<FormRules>(() => ({
  lastName: [
    { required: true, message: t('booking.validation.lastNameRequired'), trigger: 'blur' },
    { max: 20, message: t('booking.validation.lastNameMaxLength'), trigger: 'blur' }
  ],
  title: [{ required: true, message: t('booking.validation.titleRequired'), trigger: 'change' }],
  // phone 可為空；填了才驗格式
  phone: [
    {
      validator: (_rule: unknown, value: string, cb: (err?: Error) => void) => {
        if (!value) return cb();
        if (/^[0-9+\s-]{6,20}$/.test(value)) return cb();
        cb(new Error(t('booking.validation.phoneFormat')));
      },
      trigger: 'blur'
    }
  ]
}));

const titleOptions = computed(() => [
  { value: 'MR' as const, label: t('booking.customer.titleMr') },
  { value: 'MRS' as const, label: t('booking.customer.titleMrs') },
  { value: 'MISS' as const, label: t('booking.customer.titleMiss') },
  { value: 'MX' as const, label: t('booking.customer.titleMx') }
]);

type Emit = { 'on-close': [] };
const emit = defineEmits<Emit>();

const EmitClose = (done = false) => {
  props.resolve({
    done,
    ticketId: issued.value?.ticketId,
    ticketNumber: issued.value?.ticketNumber
  });
  emit('on-close');
};

const ApiSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    const phone = form.phone.replace(/[\s-]/g, '');
    const res = await $api.CreateQueueTicketForCustomer({
      serviceId: props.params.serviceId,
      ...(props.params.resourceId ? { resourceId: props.params.resourceId } : {}),
      customer: {
        lastName: form.lastName.trim(),
        title: form.title,
        ...(phone ? { phone } : {})
      }
    });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '領號失敗');
      return;
    }
    issued.value = {
      ticketId: res.data.ticketId,
      ticketNumber: res.data.ticketNumber,
      ticketDate: res.data.ticketDate,
      takenAt: new Date().toISOString(),
      claimToken: res.data.claimToken
    };
    ElMessage.success(t('queue.walkIn.success', { ticketNumber: res.data.ticketNumber }));
    // 領號成功後 render 列印區 QR（給後續 ClickPrint 用；canvas 在 v-if=issued 才掛載）
    await nextTick();
    await RenderPrintQr();
  } finally {
    submitting.value = false;
  }
};

// 領號時間顯示用：依 merchant timezone 格式化
const FormatTakenAt = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('zh-TW', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(iso));

const ClickPrint = () => {
  if (!issued.value) return;
  printing.value = true;
  // 給瀏覽器一個 frame 渲染 .print-only 區塊
  requestAnimationFrame(() => {
    try {
      window.print();
    } finally {
      printing.value = false;
    }
  });
};
</script>

<template lang="pug">
.OpenDialogQueueWalkIn
  .OpenDialogQueueWalkIn__mask(v-motion-fade)
  .OpenDialogQueueWalkIn__content(v-motion-roll-bottom)
    .OpenDialogQueueWalkIn__header
      span.OpenDialogQueueWalkIn__title {{ $t('queue.walkIn.title') }}
      button.OpenDialogQueueWalkIn__close(type="button" :disabled="submitting" @click="EmitClose(!!issued)") ✕

    // 領號表單階段
    .OpenDialogQueueWalkIn__body(v-if="!issued")
      .OpenDialogQueueWalkIn__service
        span.OpenDialogQueueWalkIn__serviceLabel {{ $t('queue.walkIn.printTicket.serviceLabel') }}
        span.OpenDialogQueueWalkIn__serviceName
          | {{ params.serviceName }}
          template(v-if="params.resourceName")
            | &nbsp;・&nbsp;{{ params.resourceName }}
      p.OpenDialogQueueWalkIn__hint {{ $t('queue.walkIn.hint') }}
      ElForm(ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="ApiSubmit")
        ElFormItem(:label="$t('queue.walkIn.fields.lastName')" prop="lastName")
          ElInput(
            v-model="form.lastName"
            maxlength="20"
            :placeholder="$t('queue.walkIn.fields.lastNamePlaceholder')"
          )
        ElFormItem(:label="$t('queue.walkIn.fields.title')" prop="title")
          ElSelect(v-model="form.title" style="width: 100%;")
            ElOption(v-for="opt in titleOptions" :key="opt.value" :label="opt.label" :value="opt.value")
        ElFormItem(:label="$t('queue.walkIn.fields.phone')" prop="phone")
          ElInput(
            v-model="form.phone"
            maxlength="20"
            inputmode="numeric"
            :placeholder="$t('queue.walkIn.fields.phonePlaceholder')"
          )
          .OpenDialogQueueWalkIn__phoneHint {{ $t('queue.walkIn.fields.phoneHint') }}

    // 領號成功階段
    .OpenDialogQueueWalkIn__body.OpenDialogQueueWalkIn__body--issued(v-else)
      .OpenDialogQueueWalkIn__numberCard
        span.OpenDialogQueueWalkIn__numberLabel {{ $t('queue.walkIn.printTicket.numberLabel') }}
        span.OpenDialogQueueWalkIn__numberValue {{ String(issued.ticketNumber).padStart(2, '0') }}
        span.OpenDialogQueueWalkIn__numberService {{ params.serviceName }}

    // footer
    .OpenDialogQueueWalkIn__footer(v-if="!issued")
      ElButton(:disabled="submitting" @click="EmitClose(false)") {{ $t('queue.walkIn.actions.cancel') }}
      ElButton(
        type="primary"
        :loading="submitting"
        data-testid="queue-walk-in-submit"
        @click="ApiSubmit"
      ) {{ $t('queue.walkIn.actions.submit') }}
    .OpenDialogQueueWalkIn__footer(v-else)
      ElButton(:loading="printing" data-testid="queue-walk-in-print" @click="ClickPrint")
        | {{ $t('queue.walkIn.actions.print') }}
      ElButton(type="primary" @click="EmitClose(true)") {{ $t('queue.walkIn.actions.close') }}

  // 列印區（@media print 才顯示）
  .OpenDialogQueueWalkIn__printOnly(v-if="issued")
    .OpenDialogQueueWalkIn__printRow(v-if="params.merchantName")
      span.OpenDialogQueueWalkIn__printKey {{ $t('queue.walkIn.printTicket.merchantLabel') }}
      span.OpenDialogQueueWalkIn__printVal {{ params.merchantName }}
    .OpenDialogQueueWalkIn__printRow
      span.OpenDialogQueueWalkIn__printKey {{ $t('queue.walkIn.printTicket.serviceLabel') }}
      span.OpenDialogQueueWalkIn__printVal {{ params.serviceName }}
    .OpenDialogQueueWalkIn__printNumberBlock
      span.OpenDialogQueueWalkIn__printNumberLabel {{ $t('queue.walkIn.printTicket.numberLabel') }}
      span.OpenDialogQueueWalkIn__printNumber {{ String(issued.ticketNumber).padStart(2, '0') }}
    .OpenDialogQueueWalkIn__printRow
      span.OpenDialogQueueWalkIn__printKey {{ $t('queue.walkIn.printTicket.timeLabel') }}
      span.OpenDialogQueueWalkIn__printVal {{ FormatTakenAt(issued.takenAt, params.timezone || 'Asia/Taipei') }}
    // QR Code 區（claimToken 存在才印；slug 缺省則只印短碼）
    .OpenDialogQueueWalkIn__printQrBlock(v-if="issued.claimToken" data-testid="queue-walk-in-print-qr")
      canvas.OpenDialogQueueWalkIn__printQrCanvas(v-if="slugForClaim" ref="printQrCanvas")
      .OpenDialogQueueWalkIn__printShortCode
        span.OpenDialogQueueWalkIn__printShortCodeLabel {{ $t('queue.claim.shortCode') }}
        span.OpenDialogQueueWalkIn__printShortCodeValue {{ issued.claimToken }}
      .OpenDialogQueueWalkIn__printQrHint {{ $t('queue.claim.scanToTrack') }}
      .OpenDialogQueueWalkIn__printQrValidity {{ $t('queue.claim.todayOnly') }}
</template>

<style lang="scss" scoped>
.OpenDialogQueueWalkIn {
  @include fixed("fill");
  @include center;
}

.OpenDialogQueueWalkIn__mask {
  @include absolute("fill");
  background-color: rgb(0 0 0 / 50%);
}

.OpenDialogQueueWalkIn__content {
  position: relative;
  z-index: 1;
  width: min(420px, calc(100vw - 32px));
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.OpenDialogQueueWalkIn__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.OpenDialogQueueWalkIn__title {
  font-size: 16px;
  font-weight: 600;
}

.OpenDialogQueueWalkIn__close {
  background: transparent;
  border: 0;
  font-size: 16px;
  cursor: pointer;
  color: #909399;
}

.OpenDialogQueueWalkIn__body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.OpenDialogQueueWalkIn__service {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 12px;
  background: #f6f8fa;
  border-radius: 8px;
}

.OpenDialogQueueWalkIn__serviceLabel {
  font-size: 12px;
  color: #909399;
}

.OpenDialogQueueWalkIn__serviceName {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.OpenDialogQueueWalkIn__hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.OpenDialogQueueWalkIn__phoneHint {
  font-size: 12px;
  color: #b88a44;
  margin-top: 4px;
  line-height: 1.4;
}

.OpenDialogQueueWalkIn__body--issued {
  align-items: center;
  padding-top: 28px;
  padding-bottom: 28px;
}

.OpenDialogQueueWalkIn__numberCard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border: 2px solid #00ada9;
  border-radius: 12px;
  min-width: 200px;
}

.OpenDialogQueueWalkIn__numberLabel {
  font-size: 13px;
  color: #909399;
}

.OpenDialogQueueWalkIn__numberValue {
  font-size: 64px;
  font-weight: 700;
  color: #00ada9;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.OpenDialogQueueWalkIn__numberService {
  font-size: 13px;
  color: #606266;
}

.OpenDialogQueueWalkIn__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid #ebeef5;
}

// 列印區：螢幕上隱藏；列印時取代整個畫面
.OpenDialogQueueWalkIn__printOnly {
  display: none;
}

@media print {
  // 列印時隱藏一切，僅顯示小單區
  :global(body > *) {
    display: none !important;
  }
  :global(#OpenGroup) {
    display: block !important;
    position: static !important;
    pointer-events: auto !important;
  }
  .OpenDialogQueueWalkIn__mask,
  .OpenDialogQueueWalkIn__content {
    display: none !important;
  }

  .OpenDialogQueueWalkIn__printOnly {
    display: block;
    width: 80mm;
    padding: 8mm 6mm;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #000;
  }

  .OpenDialogQueueWalkIn__printRow {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4mm;
    font-size: 12pt;
  }

  .OpenDialogQueueWalkIn__printKey {
    color: #555;
  }

  .OpenDialogQueueWalkIn__printVal {
    font-weight: 600;
    text-align: right;
    max-width: 60%;
  }

  .OpenDialogQueueWalkIn__printNumberBlock {
    text-align: center;
    margin: 6mm 0;
    padding: 4mm 0;
    border-top: 1px dashed #000;
    border-bottom: 1px dashed #000;
  }

  .OpenDialogQueueWalkIn__printNumberLabel {
    display: block;
    font-size: 11pt;
    color: #555;
    margin-bottom: 2mm;
  }

  .OpenDialogQueueWalkIn__printNumber {
    display: block;
    font-size: 64pt;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .OpenDialogQueueWalkIn__printQrBlock {
    margin-top: 6mm;
    padding: 4mm 0 2mm;
    border-top: 1px dashed #000;
    text-align: center;
    page-break-inside: avoid;
    background-color: #fff;
  }

  .OpenDialogQueueWalkIn__printQrCanvas {
    display: block;
    margin: 0 auto;
    width: 32mm;
    height: 32mm;
    image-rendering: pixelated;
  }

  .OpenDialogQueueWalkIn__printShortCode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1mm;
    margin-top: 3mm;
  }

  .OpenDialogQueueWalkIn__printShortCodeLabel {
    font-size: 9pt;
    color: #555;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  .OpenDialogQueueWalkIn__printShortCodeValue {
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    font-family: ui-monospace, "Courier New", monospace;
  }

  .OpenDialogQueueWalkIn__printQrHint {
    margin-top: 2mm;
    font-size: 9.5pt;
    color: #333;
    line-height: 1.4;
  }

  .OpenDialogQueueWalkIn__printQrValidity {
    margin-top: 1mm;
    font-size: 8.5pt;
    color: #777;
  }
}

// 螢幕上預覽：列印 QR 區塊隱藏（透過 .OpenDialogQueueWalkIn__printOnly 的 display:none 已生效）

</style>
