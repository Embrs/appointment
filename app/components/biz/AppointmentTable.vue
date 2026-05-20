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
  'click-complete': [appointment: AppointmentItem];
  'click-no-show': [appointment: AppointmentItem];
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

// 是否顯示「更多」下拉：只有 CONFIRMED 才有後續動作
const HasMore = (row: AppointmentItem) => row.status === 'CONFIRMED';

// 是否到達可標記時間（開始時間已過）
const IsMarkable = (row: AppointmentItem) =>
  row.status === 'CONFIRMED' && new Date(row.startAt).getTime() <= Date.now();

type MoreCommand = 'cancel' | 'complete' | 'no-show';
const HandleMore = (command: MoreCommand, row: AppointmentItem) => {
  if (command === 'cancel') emit('click-cancel', row);
  else if (command === 'complete') emit('click-complete', row);
  else if (command === 'no-show') emit('click-no-show', row);
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
        ElTag(:type="StatusTagType(row.status)" size="small") {{ StatusLabel(row.status) }}
    ElTableColumn(label="操作" width="220" fixed="right")
      template(#default="{ row }")
        .BizAppointmentTable__actions
          ElButton(size="small" link @click="emit('click-info', row)") {{ $t('appointment.actions.detail') }}
          ElDropdown(
            v-if="HasMore(row)"
            trigger="click"
            @command="(cmd: MoreCommand) => HandleMore(cmd, row)"
          )
            ElButton(size="small" link) {{ $t('appointment.actions.more') }} ▾
            template(#dropdown)
              ElDropdownMenu
                ElDropdownItem(command="cancel") {{ $t('appointment.actions.cancel') }}
                template(v-if="IsMarkable(row)")
                  ElDropdownItem(command="complete") {{ $t('appointment.actions.complete') }}
                  ElDropdownItem(command="no-show") {{ $t('appointment.actions.noShow') }}
</template>

<style lang="scss" scoped>
.BizAppointmentTable {
  width: 100%;
}

.BizAppointmentTable__actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  line-height: 1;

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}
</style>
