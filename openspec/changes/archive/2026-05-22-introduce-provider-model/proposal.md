## Why

本平台是多商家通用 SaaS，目前 `Resource` 模型同時承擔「醫師、設備、包廂」三種語意（schema 註解可見），但實務上商家普遍把 Resource 當「**診間 / 工位**」在用（A 診、B 診、1 號床）。

顧客真正在乎、想預約的不是「在哪一間」，而是「**由誰服務**」——同一位服務人員不同時段可能在不同診間。當前模型把「人」與「地」混在同一張表，導致：

1. 顧客預約時看到的是「A 診 / B 診」這類對外無意義的代號，而不是醫師/技師本人；
2. 排班只能綁診間，不能描述「王醫師週一早診，週二在分院」；
3. 服務無法表達「指定服務人員」與「不指定」兩種模式；
4. 跨產業稱呼差異（牙醫=醫師、美甲店=技師、健身房=教練、修車廠=師傅）無法在 UI 動態渲染。

本 change 引進獨立的 **Provider（服務人員）** 模型，與既有 Resource（診間）平行存在；以**商家層級開關**（`providerModeEnabled`）控管啟用，預設關閉，**對未啟用商家行為 100% 不變**。

## What Changes

### 資料模型（純新增、不破壞既有）

- 新增 `Provider` 模型（id / merchantId / name / title / bio / avatarUrl / isActive / displayOrder / createdAt / updatedAt / deletedAt）
- 新增 `ProviderService` 多對多關聯表（providerId + serviceId 複合主鍵）
- `Merchant` 新增欄位：
  - `providerModeEnabled: Boolean @default(false)`
  - `providerLabel: Json @default("{}")` — 三語自訂稱呼（zh/en/ja），空則 fallback 到 i18n 預設
- `Service` 新增欄位：`requiresProvider: Boolean @default(false)` — 啟用時建立預約必須帶 providerId
- `ScheduleRule` / `ScheduleOverride` 新增 `providerId: String?`（nullable，向後相容）；`resourceId` 語意改為「該排班預綁診間（選填）」
- `Appointment` 新增 `providerId: String?`（nullable）
- **`Resource`、`ServiceResource`、`QueueTicket`、`QueueCounter` 完全不動**

### 商家後台

- 新增頁面 `/admin/providers`（Provider CRUD：列表、新增、編輯、軟刪、停用、頭像上傳、displayOrder 排序）
- `/admin/settings` 新增「啟用服務人員制」開關 + 三語自訂稱呼欄位
- `/admin/services` 服務編輯彈窗新增「需指定服務人員」開關；啟用時必須勾選至少 1 位 Provider（透過 ProviderService 寫入）
- `/admin/schedule` 排班頁主軸從「以資源為主」改為「以 Provider 為主」（啟用 Provider 制後）；每條規則 / 覆寫可選填預綁診間
- 啟用精靈：商家在設定頁切開 `providerModeEnabled` → 引導建立第一位 Provider + 提示把既有排班搬到 Provider 上

### 顧客預約流程（`m/[slug]/booking/*`）

- **未啟用 Provider 制**：流程 100% 不變
- **啟用 Provider 制**：
  - 服務 `requiresProvider=true` 時，於「選時段」前插入「**選服務人員**」步驟，顯示卡片（頭像、職稱、簡介、最近可預約日）
  - 服務 `requiresProvider=false` 時，提供「**任一位**」選項 + 「指定服務人員」選項

### 可用時段引擎（`server/utils/availability.ts`）

- 商家啟用 Provider 制 + 服務 `requiresProvider=true` 時：以「**該 Provider 的排班**」為基準計算可用時段，並排除該 Provider 同時段既有 Appointment
- 其他情況：行為與現狀完全一致（以 Resource 排班為基準）

### API

- 新增 `server/routes/nuxt-api/provider/*` 模組（列表 / 詳情 / 新增 / 更新 / 軟刪 / 啟停 / 改順序）
- `server/routes/nuxt-api/schedule/*` 端點補 `providerId` 入參與驗證
- `server/routes/nuxt-api/appointment/*` 寫入 / 查詢 / 列表補 `providerId` 欄位
- `server/routes/nuxt-api/public/availability/*` 補 `providerId` query 參數
- `server/routes/nuxt-api/merchant/*` PUT 補 `providerModeEnabled` / `providerLabel`
- `server/routes/nuxt-api/service/*` POST / PUT 補 `requiresProvider` 與 `providerIds[]`

### i18n

- 三語新增「服務人員」相關 key（含未指定時的 fallback 預設稱呼）
- 全站凡顯示「服務人員」字樣處改用 helper：商家有自訂 label 用商家 label、無則 fallback i18n 預設

### 範圍外（明確不做）

- **不動 `QueueTicket` / `QueueCounter` 模型**：號碼牌仍按診間分群（與本 change 無關，留給後續 change）
- **不動報到 / 叫號 UI**：Provider 與診間的動態指派 UX 由後續 change `wire-provider-to-checkin-and-display` 負責
- **不刪除 `Resource`、不重命名為「診間」**：避免破壞既有商家認知與資料
- **不做 Provider 與 MerchantUser（員工帳號）的綁定**：Provider 是「對顧客展示的服務人員」，與是否擁有後台登入帳號脫鉤；本 change 不處理（可能後續 change 補）

## Capabilities

### New Capabilities

（無——Provider 是橫跨既有三個 capability 的延伸，不獨立成 capability）

### Modified Capabilities

- `merchant-platform`：
  - 新增 Provider CRUD requirement
  - 新增「商家啟用 Provider 制與自訂稱呼」requirement（含 `Merchant.providerModeEnabled` / `providerLabel` 寫入）
  - 服務 CRUD requirement 擴充 `requiresProvider` + `providerIds[]` 欄位與驗證 scenario
  - 整週時段規則 / 特定日期覆寫 requirement 擴充 `providerId` 入參
  - 商家後台配置頁面 requirement 新增 `/admin/providers` 頁與設定頁開關 UI
- `public-availability`：
  - 「可預約時段查詢」requirement 擴充：商家啟用 Provider 制 + 服務 `requiresProvider=true` 時以 Provider 排班為基準
  - 「公開商家資訊查詢」requirement 擴充：回傳 `providerModeEnabled` / `providerLabel`，並於 Provider 制啟用時提供 Provider 列表端點
- `customer-booking`：
  - 「步驟式預約流程」requirement 擴充：啟用 Provider 制 + `requiresProvider=true` 時插入「選服務人員」步驟
  - 「顧客建立預約」requirement 擴充：寫入 `providerId`、驗證該 Provider 屬於該服務、檢查衝堂

## Impact

### 受影響的程式碼

- `prisma/schema.prisma` — 新增 Provider / ProviderService、Merchant / Service / ScheduleRule / ScheduleOverride / Appointment 加欄位
- `prisma/migrations/` — 新增一支純新增 migration（不改既有欄位、不破壞既有資料）
- `app/pages/admin/providers/index.vue` — **新建**
- `app/pages/admin/services/index.vue` + 服務編輯彈窗 — 加「需指定服務人員」開關 + Provider 多選
- `app/pages/admin/schedule/*` — 排班主軸換成 Provider，加預綁診間欄位
- `app/pages/admin/settings.vue` — 加 Provider 制開關 + 三語 label 欄位 + 啟用精靈
- `app/pages/m/[slug]/booking/*` — 啟用 Provider 制時插入新步驟
- `app/components/biz/*` — Service 編輯、Schedule 編輯元件擴充
- `server/routes/nuxt-api/provider/*` — **新建** API 模組
- `server/routes/nuxt-api/schedule/*` — 補 providerId
- `server/routes/nuxt-api/appointment/*` — 補 providerId
- `server/routes/nuxt-api/public/availability/*` — 補 providerId query
- `server/routes/nuxt-api/merchant/*` PUT — 補 providerModeEnabled / providerLabel
- `server/routes/nuxt-api/service/*` — 補 requiresProvider / providerIds[]
- `server/utils/availability.ts` — Provider 排班分支
- `server/utils/booking.ts` — `createAppointment` 補 providerId 驗證
- `app/protocol/fetch-api/api/provider/` — **新建** 型別
- `app/protocol/fetch-api/api/service/`、`schedule/`、`appointment/`、`merchant/`、`availability/` — 型別擴充
- `app/stores/*` — 既有商家 store 補 providerModeEnabled / providerLabel 欄位、新增 provider store
- `i18n/locales/{zh,en,ja}.js` — 三語 key

### 資料相容性

- 既有 prod / test 商家：`providerModeEnabled=false` → 所有 UI 與 API 行為與現狀完全一致
- Migration 純新增欄位 / 表，無 ALTER 既有欄位、無 DROP、無資料搬遷
- 既有 Service / ScheduleRule / Appointment 的新增欄位皆 nullable 或 default false

### 風險

- **排班雙軸混淆**：啟用 Provider 制後，同一商家可能 ScheduleRule 既有「以資源為主」舊資料、又有「以 Provider 為主」新資料；需明確規範可用時段引擎的優先序（見 design.md）
- **i18n fallback 邏輯**：自訂 label 為三語 Json，部分語言可能缺值；需明確 fallback 鏈（自訂 → 商家偏好語 → i18n 預設）
- **Service.requiresProvider 切換**：服務已被預約後切換此旗標的影響需明確規範（建議僅影響新預約）
