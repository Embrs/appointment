---
name: 前端編碼規範
description: SFC 結構、命名慣例、Pug/SCSS BEM、Element Plus 限制、TinyEditor、客製 v- 指令
type: reference
---

# 前端編碼規範

Nuxt 4 + Vue 3 Composition API + TypeScript + Element Plus 的 SFC 撰寫規範。

## SFC 結構順序

模板使用 **Pug**（`lang="pug"`），樣式使用 **SCSS scoped**。`<script setup lang="ts">` 必須依此順序：

```vue
<script setup lang="ts">
// 1. Imports
// 2. Props / Refs / State
// 3. Watch / Event Handlers（Click* 前綴）
// 4. Flow Control（*Flow 後綴）
// 5. Helpers
// 6. API Requests（Api* 前綴）
// 7. Lifecycle
// 8. Emits
// 9. Expose
</script>

<template lang="pug">
.ComponentName
  //- 內容
</template>

<style lang="scss" scoped>
.ComponentName { }
</style>
```

## 函式命名慣例

| 類型 | 命名前綴/後綴 | 範例 |
|------|--------------|------|
| 點擊事件 | `Click*` | `ClickSave`, `ClickDelete` |
| 流程控制 | `*Flow` | `SaveFlow`, `DeleteFlow` |
| API 呼叫 | `Api*` | `ApiSave`, `ApiGetList` |

## SCSS 規範

- 類名採 BEM 變體：`.ComponentName`、`.ComponentName__element`、`.ComponentName__element--modifier`
- **禁止** `&__` 嵌套寫法，必須**展平寫**
- **禁止** `!important`、內聯 `style=""`、`@import`
- 覆蓋 Element Plus 樣式只能在 `scoped` 內用 `:deep()`
- 全局 SCSS（`config`、`colors`、`fn`、`mixin`、`font-size`、`rwd`、`element-plus/index`）已由 `vite.css.preprocessorOptions.scss.additionalData` 自動注入，直接使用 mixin/變數即可

## Element Plus 限制

- **禁止** `ElMessageBox.confirm/prompt` → 改用 `UseAsk()` composable
- `ElInput` 必須加 `maxlength`
- `ElSelect` 搭配 `clearable` 時必須加 `value-on-clear=""`（避免清空變 `null` 觸發後端驗證錯誤）
- 數字輸入必須加 `inputmode="numeric"`（手機鍵盤體驗）
- 透過 `@element-plus/nuxt` module + `importStyle: 'scss'` 載入，無需手動 import 組件

## 自動 v- 指令（plugins）

`app/plugins/directives_*.ts` 內以 `directives_xxx` 為檔名的指令會自動註冊：

| 指令 | 用途 |
|------|------|
| `v-click-outside` | 偵測點擊組件外部 |
| `v-copy` | 點擊複製文字 |
| `v-from` | 入場動畫（搭配 @vueuse/motion） |
| `v-lazy-load` | 圖片懶載入 |
| `v-lock-img-download` | 禁止圖片右鍵下載 |
| `v-mounted-focus` | 掛載後自動 focus |
| `v-resize` | 監聽元素 resize |
| `v-scroll-more` | 滾到底觸發載入更多 |

## 彈窗系統

- 業務彈窗透過 `$open` 全局工具開啟（詳見 [stores-and-globals.md](./stores-and-globals.md)）
- 確認對話框一律用 `UseAsk()`，**不要**用 `ElMessageBox.confirm`

## TinyEditor 富文本編輯器

全局組件 `TinyEditor` 基於 TinyMCE 8 self-hosted（GPLv2）＋ `@tinymce/tinymce-vue` wrapper。

**基本用法**：
```vue
<TinyEditor v-model="content" />
```

**Props**：
| Prop | 型別 | 說明 |
|------|------|------|
| `modelValue` | `string` | HTML 字串（v-model） |
| `initOverrides` | `Record<string, any>` | 覆寫 TinyMCE init 配置 |
| `disabled` | `boolean` | 進入唯讀狀態 |

**客製工具列／plugins**：修改 `app/utils/tinymce-config.ts`（`tinymceToolbar`、`tinymcePlugins`、`tinymceDefaultInit`），組件端無感。單頁覆寫則傳 `initOverrides`。

**圖片上傳**：內建 `images_upload_handler` 呼叫 `$api.ApiTinymceUpload`（`POST /nuxt-api/tinymce/upload`，回傳 `{ data: { url }, status }`）。

**SSR 安全**：組件內部以 `<ClientOnly>` 包裹，伺服器端渲染時顯示 loading placeholder，不存取 `window`/`document`。

**靜態資源**：`postinstall` 階段執行 `scripts/copy-tinymce.mjs` 把 `node_modules/tinymce/` 複製到 `public/tinymce/`（已 gitignore）。升級 TinyMCE 僅需 `npm update tinymce`。
