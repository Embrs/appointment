<script setup lang="ts">
// BizImageUploader — 通用圖片上傳；v-model 為 R2 URL 字串

type Props = {
  /** 當前圖片 URL（v-model） */
  modelValue: string;
  /** 上傳分類，影響 R2 key 前綴 */
  kind?: UploadImageKind;
  /** 提示文字 */
  hint?: string;
  /** 預覽圖建議尺寸（CSS） */
  width?: string;
  height?: string;
};

const props = withDefaults(defineProps<Props>(), {
  kind: 'other',
  hint: '建議上傳 PNG / JPEG / WebP，5MB 以下',
  width: '160px',
  height: '160px'
});

type Emit = {
  'update:modelValue': [url: string];
};
const emit = defineEmits<Emit>();

const inputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

const ClickPick = () => {
  inputRef.value?.click();
};

const ClickClear = () => {
  emit('update:modelValue', '');
};

const ApiUpload = async (file: File) => {
  uploading.value = true;
  try {
    const res = await $api.UploadImage({ file, kind: props.kind });
    if (res.status.code !== $enum.apiStatus.success) {
      ElMessage.error(res.status.message?.zh_tw || '上傳失敗');
      return;
    }
    emit('update:modelValue', res.data.url);
    ElMessage.success('上傳成功');
  } finally {
    uploading.value = false;
  }
};

const ChangeFile = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  ApiUpload(file);
  // 重置允許重覆同檔上傳
  target.value = '';
};
</script>

<template lang="pug">
.BizImageUploader
  .BizImageUploader__preview(
    :style="{ width: props.width, height: props.height }"
    @click="ClickPick"
  )
    ElImage(
      v-if="props.modelValue"
      :src="props.modelValue"
      fit="cover"
      style="width: 100%; height: 100%; border-radius: 4px;"
    )
    span.BizImageUploader__placeholder(v-else) 點擊上傳
    .BizImageUploader__loading(v-if="uploading") 上傳中…
  .BizImageUploader__actions
    ElButton(size="small" :loading="uploading" @click="ClickPick") {{ props.modelValue ? '更換圖片' : '選擇檔案' }}
    ElButton(
      v-if="props.modelValue"
      size="small"
      type="danger"
      plain
      :disabled="uploading"
      @click="ClickClear"
    ) 移除
  p.BizImageUploader__hint {{ props.hint }}
  input.BizImageUploader__input(
    ref="inputRef"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    @change="ChangeFile"
  )
</template>

<style lang="scss" scoped>
.BizImageUploader {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.BizImageUploader__preview {
  position: relative;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  background-color: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.BizImageUploader__preview:hover {
  border-color: #409eff;
}

.BizImageUploader__placeholder {
  color: #909399;
  font-size: 13px;
}

.BizImageUploader__loading {
  position: absolute;
  inset: 0;
  background-color: rgb(255 255 255 / 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606266;
  font-size: 13px;
}

.BizImageUploader__actions {
  display: flex;
  gap: 8px;
}

.BizImageUploader__hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.BizImageUploader__input {
  display: none;
}
</style>
