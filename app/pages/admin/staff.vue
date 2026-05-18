<script setup lang="ts">
// PageAdminStaff — 商家成員管理（OWNER only）
definePageMeta({
  layout: 'back-desk',
  middleware: ['merchant']
});

const storeSelf = StoreSelf();
const useAsk = UseAsk();
const isOwner = computed(() => storeSelf.role === 'OWNER');

const items = ref<MerchantStaffItem[]>([]);
const loading = ref(true);

const ApiLoad = async () => {
  if (!isOwner.value) return;
  loading.value = true;
  try {
    const res = await $api.GetStaffList();
    if (res.status.code !== $enum.apiStatus.success) return;
    items.value = res.data.items;
  } finally {
    loading.value = false;
  }
};

const ClickCreate = async () => {
  const res = await $open.DialogStaffEdit({ mode: 'create' });
  if (res?.done) await ApiLoad();
};

const ClickEdit = async (u: MerchantStaffItem) => {
  const res = await $open.DialogStaffEdit({ mode: 'edit', user: u });
  if (res?.done) await ApiLoad();
};

const ClickToggle = async (u: MerchantStaffItem) => {
  const action = u.isActive ? '停用' : '啟用';
  const ok = await useAsk.Any(`確定要${action}「${u.name}」嗎？`, `${action}成員`);
  if (!ok) return;
  const res = await $api.ToggleStaffActive({ id: u.id });
  if (res.status.code !== $enum.apiStatus.success) {
    ElMessage.error(res.status.message?.zh_tw || '操作失敗');
    return;
  }
  ElMessage.success(res.data.user.isActive ? '已啟用' : '已停用');
  await ApiLoad();
};

onMounted(() => {
  ApiLoad();
});
</script>

<template lang="pug">
.PageAdminStaff
  .PageAdminStaff__header
    h1.PageAdminStaff__title 成員管理
    ElButton(v-if="isOwner" type="primary" @click="ClickCreate") + 新增成員
  .PageAdminStaff__no-permission(v-if="!isOwner")
    | 此頁僅限 OWNER 操作；目前帳號為 STAFF。
  ElTable(
    v-else
    :data="items"
    v-loading="loading"
    style="width: 100%;"
    stripe
  )
    ElTableColumn(label="姓名" prop="name" min-width="120")
    ElTableColumn(label="Email" prop="email" min-width="200")
    ElTableColumn(label="角色" width="100")
      template(#default="{ row }")
        ElTag(:type="row.role === 'OWNER' ? 'success' : 'info'" size="small") {{ row.role }}
    ElTableColumn(label="狀態" width="100")
      template(#default="{ row }")
        ElTag(:type="row.isActive ? 'success' : 'info'" size="small") {{ row.isActive ? '啟用' : '停用' }}
    ElTableColumn(label="操作" width="180" fixed="right")
      template(#default="{ row }")
        ElButton(size="small" link type="primary" @click="ClickEdit(row)") 編輯
        ElButton(
          size="small"
          link
          :type="row.isActive ? 'danger' : 'success'"
          @click="ClickToggle(row)"
        ) {{ row.isActive ? '停用' : '啟用' }}
</template>

<style lang="scss" scoped>
.PageAdminStaff {
  padding: 8px;
}

.PageAdminStaff__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.PageAdminStaff__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.PageAdminStaff__no-permission {
  background-color: #fff;
  padding: 24px;
  border-radius: 8px;
  color: #e6a23c;
  font-size: 14px;
}
</style>
