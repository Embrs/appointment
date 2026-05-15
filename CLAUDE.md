# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 語言規則

- 所有對話、回覆、註解說明一律使用**繁體中文**
- 程式碼中的變數名稱、函式名稱維持英文
- Git commit message 使用繁體中文，遵循 Conventional Commits 格式（`feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `chore:`）
  - 範例：`feat: 新增使用者列表分頁`、`fix: 修正登入後 Token 未更新問題`

## 常用指令

```bash
npm run dev          # 開發伺服器（使用 .env.dev，端口 3000）
npm run build        # 生產構建
npm run preview      # 本地預覽生產構建
npm run lint         # ESLint 檢查
npm run lint:fix     # ESLint 自動修復
```

- 環境需求：Node.js >= 24.13.0
- 本專案**未配置測試框架**，無 `npm test`
- `npm run dev` 會載入 `.env.dev`；新環境需先自行建立該檔

## 專案架構

企業級 Nuxt 4 前端框架，使用 Vue 3 Composition API + TypeScript + Element Plus + Pinia。

### 目錄結構

- `app/` — 應用程式核心（pages、components、composables、stores、utils、plugins、protocol）
- `server/` — Nitro 伺服器端（API 路由使用 `@@` 別名）
- `i18n/locales/` — 多語系翻譯檔（zh、en、ja）
- `types/` — 全局 TypeScript 型別定義
- `shared/` — 前後端共享程式碼（以 `~shared` 別名引用）
- `openspec/` — OpenSpec 規格系統，新增功能或重構時透過 openspec skill 建立變更提案

### 路徑別名

| 別名 | 對應路徑 |
|------|---------|
| `~` / `~/` | `./app` |
| `@` / `@/` | `./app/assets` |
| `@@` | `./server` |
| `~shared` | `./shared` |

### 自動導入

以下目錄的模組會自動導入，**無需 import**：
- `app/stores/` — Pinia stores
- `app/utils/` — 工具函式（`$api`、`$dayjs`、`$tool`、`$lodash`、`$encrypt`、`$enum`、`$open`）
- `app/composables/**` — Composition API
- `app/components/` — 全局組件（排除 `loading/page.vue` 和 `open/group/index.vue`）
- Vue 核心函式（`ref`、`computed`、`watch` 等不需從 vue 匯入）

### 全局 SCSS 工具

以下 SCSS 檔案已透過 Vite 自動注入，可在任何組件中直接使用 mixin/變數：
- `config.scss`、`colors.scss`、`fn.scss`、`mixin.scss`、`font-size.scss`、`rwd.scss`、`element-plus/index.scss`

## 前端編碼規範

### SFC 結構順序

模板語言使用 **Pug**，樣式使用 **SCSS scoped**：

```vue
<script setup lang="ts">
// 1. Imports
// 2. Props/Refs/State
// 3. Watch/Event Handlers（Click* 前綴）
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

### 函式命名慣例

| 類型 | 命名 | 範例 |
|------|------|------|
| 點擊事件 | `Click*` | `ClickSave`, `ClickDelete` |
| 流程控制 | `*Flow` | `SaveFlow`, `DeleteFlow` |
| API 呼叫 | `Api*` | `ApiSave`, `ApiGetList` |

### SCSS 規範

- 類名使用 BEM 變體：`.ComponentName`、`.ComponentName__element`、`.ComponentName__element--modifier`
- **禁止** `&__` 嵌套寫法，必須展平寫
- **禁止** `!important`、內聯樣式、`@import`
- 覆蓋 Element Plus 樣式只能在 scoped 內用 `:deep()`

### Element Plus 注意事項

- **禁止** `ElMessageBox.confirm/prompt`，使用 `UseAsk()` composable
- `ElInput` 必須加 `maxlength`
- `ElSelect` 搭配 `clearable` 時必須加 `value-on-clear=""`
- 數字輸入必須加 `inputmode="numeric"`

## 後端編碼規範（Server API）

### API 路由結構

```
server/routes/nuxt-api/{資源}/
  index.get.ts    — 列表
  index.post.ts   — 新增
  [id].get.ts     — 詳情
  [id].put.ts     — 更新
  [id].delete.ts  — 刪除
```

### 錯誤處理

- **使用 `return` 回傳錯誤，禁止 `throw`**
- 使用 `@@/utils/response` 的工具函式：`successResponse`、`notFoundError`、`badRequestError`、`forbiddenError` 等
- 錯誤訊息必須提供三語言（zh_tw、en、ja）
- 後端返回資料中的 null 值應轉為空字串

### 統一響應格式

```typescript
{ data: T, status: { code: number, message: { zh_tw, en, ja } } }
```

## 狀態管理（Pinia）

Store 檔案以數字前綴排序初始化順序，直接以函式形式使用：
- `StoreEnv()` — 環境變數
- `StoreTool()` — RWD、滾動偵測
- `StoreTheme()` — 主題色
- `StoreSelf()` — 使用者認證、Token、權限檢查 `HasRule()`
- `StoreOpen()` — 彈窗管理（`OnOpen`、`OnClose`）

## 彈窗系統

使用 `$open` 全局工具開啟業務彈窗，組件位於 `app/components/open/`：
- 命名規則：`OpenDialog{業務名稱}{模式}.vue`（Info/Edit/Create）
- 確認對話框使用 `UseAsk()` composable

## API 請求

API 定義在 `app/protocol/fetch-api/api/` 下，按業務模組分目錄。已內建 Token 注入、錯誤處理、401 自動跳轉登入。

```typescript
const res = await $api.GetUserList({ page: 1 });
if (res.status.code !== $enum.apiStatus.success) return false;
```

## 多語系

三語系支援（繁中 zh、英文 en、日文 ja），預設繁中。路由策略 `prefix_except_default`（預設語言不加 URL 前綴）。翻譯檔位於 `i18n/locales/`。

## 知識庫

詳細規範與技術知識存放於 `.claude/knowledge/`，按需讀取以減少上下文消耗：

| 文件 | 內容 | 建議閱讀時機 |
|------|------|-------------|
| [frontend-conventions.md](.claude/knowledge/frontend-conventions.md) | SFC 結構、命名慣例、SCSS BEM、Element Plus 限制、自動導入、彈窗系統、TinyEditor 富文本編輯器 | 撰寫或修改 Vue 組件、頁面、SCSS 樣式時 |
| [backend-conventions.md](.claude/knowledge/backend-conventions.md) | API 路由結構、錯誤處理（`return` 非 `throw`）、統一響應格式、三語言錯誤訊息 | 撰寫 `server/routes/nuxt-api/*` 端點時 |

> 最後更新時間：2026-04-20
