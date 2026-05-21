---
name: Stores、Composables 與全局工具
description: Pinia stores 清單、composables 用途、Nuxt 自動導入規則、彈窗系統、加密 cookie/storage、UseWS
type: reference
---

# Stores、Composables 與全局工具

Pinia 狀態、Nuxt 自動導入規則、彈窗體系、加密儲存與 WebSocket 工具。

## Pinia Stores

`app/stores/` 檔名以數字前綴排序初始化順序；全部以函式形式直接呼叫（已自動導入）：

| Store | 用途 | 持久化 |
|-------|------|--------|
| `StoreEnv()` | 環境變數（NUXT_PUBLIC_*） | — |
| `StoreTool()` | RWD 斷點、滾動位置偵測 | — |
| `StoreTheme()` | 主題色（搭配 `@nuxtjs/color-mode`） | — |
| `StoreSelf()` | 認證身分、Token、`HasRule(rule)` 權限檢查、`SetIdentity`、`SignOut` | 加密 cookie（`ss_*`） |
| `StoreOpen()` | 業務彈窗管理（`OnOpen` / `OnClose`） | — |
| `StoreCustomerSession()` | 顧客端 triplet（lastName/title/phone）+ 造訪過的 slug（最多 50） | 加密 localStorage（`cs_t`） |
| `StoreQueueRealtime()` | 號碼牌 WebSocket 即時狀態 + 15s 輪詢兜底 | — |

> 編號預留位置（如 `6.*`）供未來插入新 store 使用。

### StoreSelf 權限規則

`HasRule(rule)` 邏輯（見 [auth-and-rbac.md](./auth-and-rbac.md) 完整說明）：

- `admin`：永遠 `true`
- `merchant` + `OWNER`：所有 `merchant.*` 為 `true`
- `merchant` + `STAFF`：除 `merchant.staff.*` / `merchant.settings.*` / `merchant.billing.*` 字首外的 `merchant.*` 為 `true`
- `guest`：永遠 `false`

## Composables

| 路徑 | 用途 |
|------|------|
| `app/use-ask.ts` → `UseAsk()` | 確認對話框（取代 `ElMessageBox.confirm`） |
| `app/use-impersonation.ts` → `UseImpersonation()` | 平台管理員代理進入商家後台；備份 `ss_back_*` 於 cookie，退出時還原 |
| `app/use-verify.ts` | 表單欄位驗證輔助 |
| `app/use-open-com-option.ts` | 彈窗開關通用選項 |
| `app/use-customer-queue-recent.ts` | 顧客端最近領號紀錄（多商家）的本地保存 |
| `app/use-slot-reason.ts` | availability slot 不可用原因（past / taken / closed）轉 i18n 文案 |
| `app/use-tts.ts` → `UseTts()` | 店面大螢幕語音播報（`window.speechSynthesis` + i18n BCP47 對應；持久化開關） |
| `system/use-element-i18n.ts` | Element Plus 語系切換 |
| `system/use-inapp-browser/` | 偵測 in-app browser（LINE / FB 內嵌等）並提示用外部瀏覽器開啟 |
| `tool/use-encrypt-cookie.ts` → `UseEncryptCookie<T>(key, default)` | 加密 cookie（取代 `useCookie`） |
| `tool/use-encrypt-storage.ts` → `UseEncryptStorage<T>(key, default)` | 加密 localStorage |
| `tool/use-mitt.ts` | mitt event bus 包裝 |
| `tool/use-ws.ts` → `UseWS(url, options)` | WebSocket 自動重連、心跳、JSON parse |

## 自動導入（無需 import）

由 `nuxt.config.ts` 的 `imports.dirs` + `components` 設定：

| 來源 | 內容 |
|------|------|
| `app/stores/` | 所有 `Store*()` 函式 |
| `app/utils/` | `$api`、`$dayjs`、`$tool`、`$lodash`、`$encrypt`、`$enum`、`$open` |
| `app/composables/**` | 所有 `Use*()` 函式 |
| `app/components/` | 全局組件（排除 `loading/page.vue` 與 `open/group/index.vue`） |
| Vue 核心 | `ref`、`computed`、`watch`、`reactive`、`onMounted` 等 |

## 全局 SCSS 工具

下列 SCSS 由 Vite `additionalData` 自動 `@use` 至所有組件，可直接使用其中的 mixin / 變數，**不需 `@use` 或 `@import`**：

- `config.scss`、`colors.scss`、`fn.scss`、`mixin.scss`、`font-size.scss`、`rwd.scss`、`element-plus/index.scss`

## 彈窗系統

業務彈窗統一透過 `$open` 全局工具開啟，組件位於 `app/components/open/`：

- 命名規則：`OpenDialog{業務名稱}{模式}.vue`（`Info` / `Edit` / `Create`）
- 開關狀態由 `StoreOpen()` 集中管理（`OnOpen(componentName, props)` / `OnClose`）
- 確認對話框：必須用 `UseAsk()`，**禁止** `ElMessageBox.confirm/prompt`

## $api 呼叫範式

API 定義在 `app/protocol/fetch-api/api/`，按業務模組分目錄。已內建 Token 注入、錯誤處理、401 自動跳轉登入：

```typescript
const res = await $api.GetUserList({ page: 1 });
if (res.status.code !== $enum.apiStatus.success) return false;
// res.data 為實際資料；null 已被後端 sanitizeNulls 轉成 ''
```

判斷成功失敗一律用 `status.code !== $enum.apiStatus.success`，**不要**用 `try/catch` 包 `$api.*` 呼叫。
