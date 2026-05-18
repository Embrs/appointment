<script setup lang="ts">
// PageSysAdmins — 平台管理員帳號清單與管理
definePageMeta({
  layout: 'back-desk',
  middleware: ['admin']
});

const storeSelf = StoreSelf();
const useAsk = UseAsk();

const loading = ref(false);
const items = ref<AdminItem[]>([]);

const ApiLoad = async () => {
  loading.value = true;
  try {
    const res = await $api.GetAdminList();
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '載入失敗');
      return;
    }
    items.value = res.data.items ?? [];
  } finally {
    loading.value = false;
  }
};

const ClickCreate = async () => {
  const res = await $open.DialogAdminEdit({ mode: 'create' });
  if (res.done) ApiLoad();
};

const ClickEdit = async (row: AdminItem) => {
  const res = await $open.DialogAdminEdit({ mode: 'edit', admin: row });
  if (res.done) ApiLoad();
};

const ToggleFlow = async (row: AdminItem) => {
  // 不能停用自己：以登入時記下的 email 比對；後端也會擋（id===auth.sub 回 400）
  if (row.email === storeSelf.userEmail) {
    ElMessage.warning('不能停用自己');
    return;
  }
  const action = row.isActive ? '停用' : '啟用';
  const ok = await useAsk.Any(`確定要${action}「${row.name}」嗎？`, `${action}管理員`, '取消', `確認${action}`, 'warning');
  if (!ok) return;
  const res = await $api.ToggleAdminActive({ id: row.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '操作失敗');
    return;
  }
  ElMessage.success(`已${action}`);
  ApiLoad();
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageSysAdmins
  BizPageHeader(title="平台管理員" subtitle="新增、編輯與停用平台管理員帳號")
    template(#actions)
      ElButton(type="primary" @click="ClickCreate") + 新增管理員
  ElTable(
    :data="items"
    v-loading="loading"
    stripe
    style="width: 100%"
  )
    ElTableColumn(prop="name" label="姓名" min-width="140")
    ElTableColumn(prop="email" label="Email" min-width="220")
    ElTableColumn(prop="isActive" label="狀態" width="100")
      template(#default="{ row }")
        ElTag(:type="row.isActive ? 'success' : 'info'" size="small")
          | {{ row.isActive ? '啟用中' : '已停用' }}
    ElTableColumn(prop="createdAt" label="建立時間" min-width="170")
      template(#default="{ row }")
        | {{ $dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}
    ElTableColumn(label="操作" width="200" fixed="right")
      template(#default="{ row }")
        .PageSysAdmins__actions
          ElButton(size="small" link @click="ClickEdit(row)") 編輯
          ElButton(
            size="small"
            :type="row.isActive ? 'warning' : 'success'"
            plain
            @click="ToggleFlow(row)"
          ) {{ row.isActive ? '停用' : '啟用' }}
</template>

<style lang="scss" scoped>
.PageSysAdmins__actions {
  display: flex;
  gap: 4px;
}
</style>
