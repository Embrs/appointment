<script setup lang="ts">
// BizAppointmentTable — 商家後台預約表格
// 操作欄收斂為單一「詳細」link button，所有狀態操作改由 DrawerAppointmentInfo 提供

interface AppointmentTableProps {
  items: AppointmentItem[];
  timezone?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<AppointmentTableProps>(), {
  timezone: 'Asia/Taipei',
  loading: false
});

type Emit = {
  'click-info': [appointment: AppointmentItem];
};
const emit = defineEmits<Emit>();

const { t } = useI18n();

const fmtDateTime = (iso: string) => $dayjs(new Date(iso)).tz(props.timezone).format('MM-DD HH:mm');

const StatusTagType = (status: string): 'primary' | 'success' | 'danger' | 'info' | 'warning' => {
  switch (status) {
    case 'CONFIRMED': return 'primary';
    case 'COMPLETED': return 'success';
    case 'CANCELED': return 'danger';
    case 'NO_SHOW': return 'warning';
    default: return 'info';
  }
};

const StatusLabel = (status: string) => t(`appointment.status.${status}`, status);
const TitleLabel = (title: string) => (title ? t(`appointment.customerTitle.${title}`, '') : '');
</script>

<template lang="pug">
.BizAppointmentTable
  ElTable(
    v-loading="loading"
    :data="items"
    stripe
    element-loading-text="查詢中…"
    style="width: 100%;"
  )
    ElTableColumn(label="時間" width="130")
      template(#default="{ row }")
        span {{ fmtDateTime(row.startAt) }}
    ElTableColumn(label="服務" prop="service.name" min-width="120")
    ElTableColumn(label="資源" width="100")
      template(#default="{ row }")
        span {{ row.resource ? row.resource.name : '—' }}
    ElTableColumn(label="顧客" min-width="140")
      template(#default="{ row }")
        span {{ row.customerLastName }}{{ TitleLabel(row.customerTitle) }} ｜ {{ row.customerPhone }}
    ElTableColumn(label="狀態" width="100")
      template(#default="{ row }")
        ElTag(:type="StatusTagType(row.status)" size="small") {{ StatusLabel(row.status) }}
    ElTableColumn(label="操作" width="120" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link @click="emit('click-info', row)") {{ $t('appointment.actions.detail') }}
</template>

<style lang="scss" scoped>
.BizAppointmentTable {
  width: 100%;
}
</style>
