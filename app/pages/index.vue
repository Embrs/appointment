<script setup lang="ts">
// PageIndex
</script>

<template lang="pug">
.PageIndex
  p PageIndex
  ElButton(@click="$open.DialogDemo({demo: 'test'})") OpenDialogDemo

  .PageIndex__demos
    h3.PageIndex__demosTitle Demo 頁面
    ul.PageIndex__demoList
      li
        NuxtLink.PageIndex__demoLink(to="/demo/tinymce-editor") TinyMCE 富文本編輯器 Demo
</template>

<style lang="scss" scoped>
// 佈局 ----
.PageIndex {
  padding: 16px;
}

// 組件 ----
.PageIndex__demos {
  margin-top: 24px;
}

.PageIndex__demosTitle {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.PageIndex__demoList {
  margin: 0;
  padding-left: 20px;
}

.PageIndex__demoLink {
  color: #409eff;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
