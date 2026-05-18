<script setup lang="ts">
// BizAppointmentTable — 商家後台預約表格

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
  'click-cancel': [appointment: AppointmentItem];
};
const emit = defineEmits<Emit>();

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

const TitleLabel = (title: string) => {
  switch (title) {
    case 'MR': return '先生';
    case 'MRS': return '女士';
    case 'MISS': return '小姐';
    case 'MX': return '客人';
    default: return '';
  }
};
</script>

<template lang="pug">
.BizAppointmentTable
  ElTable(
    :data="items"
    :loading="loading"
    stripe
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
        ElTag(:type="StatusTagType(row.status)" size="small") {{ row.status }}
    ElTableColumn(label="操作" width="140" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link @click="emit('click-info', row)") 詳細
        ElButton(
          v-if="row.status === 'CONFIRMED'"
          size="small"
          link
          type="danger"
          @click="emit('click-cancel', row)"
        ) 取消
</template>

<style lang="scss" scoped>
.BizAppointmentTable {
  width: 100%;
}
</style>
