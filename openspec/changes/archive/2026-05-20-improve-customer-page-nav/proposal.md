# improve-customer-page-nav — Proposal

## Why

顧客面 `/m/{slug}/*` 目前沒有一致的「返回」入口：

- `lookup.vue`、`my-bookings.vue` 完全沒有返回按鈕，使用者進入後只能靠瀏覽器上一頁離開，操作極不直覺。
- `book.vue` 步驟內已有「上一步」，但 step=service 時無法回到商家首頁；要離開預約流程必須走完或按瀏覽器返回。
- `queue/index.vue` 有 `← {merchantName}` 連結、`queue/status.vue` 有「回首頁」、`sign-in/sign-up/forgot-password` 有「← 回首頁／返回登入」連結——三套寫法、三套樣式、三套位置。
- 顧客動線分散在 layout 頂部（品牌名 + 語系）與頁面內標題（h2/h3 各異），沒有共用頁首，標題層級和返回語意各頁不同。

UX 後果：跳轉到子頁後找不到清楚出口、流程一致性差，影響轉換與信任。

## What Changes

### 新增共用元件
- **新增 `BizCustomerPageHeader`**：顧客面（front-desk layout 與公開頁）統一頁首元件
  - props：`title`、`subtitle?`、`backTo?: string | null`、`backLabel?: string`
  - 左側「← 返回」（`backTo` 為非空字串時顯示，點擊呼叫 `navigateTo(backTo)`），中間 title/subtitle，右側 `#actions` slot
  - `backTo` 一律走「固定父路徑」策略，不使用 `router.back()`（避免外部連結進入後 back 出站）
  - 響應式樣式：手機版返回按鈕保留為左上 icon，標題壓縮

- **擴充 `BizPageHeader`（後台用）**：新增 `backTo?: string | null` 與 `backLabel?: string` props，與 `BizCustomerPageHeader` 對齊；後台多數頁仍可不傳 `backTo`（保持原本側邊欄導航），但二級頁（如 `admin/merchants/[id]`、`admin/appointments/calendar`）可選擇性使用

### 顧客面 `/m/{slug}/*` 套用一致返回入口

| 頁面 | `backTo` | 備註 |
|------|---------|------|
| `m/[slug]/index.vue` | （不顯示返回）| 商家首頁本身是根 |
| `m/[slug]/book.vue` | `/m/${slug}`（PageHeader 層）| header 返回 = 離開預約流程；step 內的「上一步」保留 |
| `m/[slug]/lookup.vue` | `/m/${slug}` | 補返回入口 |
| `m/[slug]/my-bookings.vue` | `/m/${slug}` | 補返回入口 |
| `m/[slug]/queue/index.vue` | `/m/${slug}` | 把現有 `← {merchantName}` 連結改為使用 BizCustomerPageHeader |
| `m/[slug]/queue/status.vue` | `/m/${slug}/queue` | 從個別號碼牌返回該商家叫號頁 |

### 公開頁套用一致返回入口

| 頁面 | `backTo` | 備註 |
|------|---------|------|
| `index.vue`（landing） | （不顯示返回）| 站台首頁本身是根 |
| `sign-in.vue` | `/` | 取代現有左欄「← 回首頁」連結 |
| `sign-up.vue` | `/` | 同上 |
| `forgot-password.vue` | `/sign-in` | 取代現有「返回登入」連結 |

### 後台頁面（admin/*、sys/*）
- 沿用既有 `BizPageHeader` + sidebar 導航為主，不強制每頁加 `backTo`
- **二級詳情頁**選擇性套用 `backTo`，本次只改 `sys/merchants/[id].vue`（`backTo = /sys/merchants`）作示範與一致性收斂

### PageBook 內部行為
- header 返回鈕 = 離開預約流程到 `m/[slug]`（保留 step=service 也能直接離開）
- step ≥ 2 時，header 仍然只負責離開；既有「上一步」按鈕維持原行為（在頁面內，不在 header）
- 若預約流程已部分填寫，header 點返回**不**跳警示視窗（本次需求未涵蓋表單防離脫；列為 design.md Open Question 紀錄但不實作）

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `customer-booking`：顧客面預約相關頁面新增「統一返回入口」requirement，明確各頁 backTo 行為與 PageBook header 返回與內部「上一步」的職責切分
- `queue-tickets`：`/m/{slug}/queue` 與 `/m/{slug}/queue/status` 兩頁套用統一 PageHeader 與返回入口，覆蓋既有 ad-hoc 連結寫法
- `auth-flow`：sign-in / sign-up / forgot-password 三頁的返回連結改用 BizCustomerPageHeader，requirement 中說明返回路徑收斂
- `platform-admin`：`sys/merchants/[id]` 二級詳情頁套用 `BizPageHeader` 的 `backTo`，requirement 補上「平台管理員二級詳情頁應提供回到列表的入口」

> 註：`merchant-platform`、`finalize-deploy` 等其他 spec 暫不變動。

## Impact

### 程式碼
- `app/components/biz/CustomerPageHeader.vue` — **新增**
- `app/components/biz/PageHeader.vue` — 擴充 `backTo` / `backLabel` props，左側顯示返回箭頭（仍向後相容：未傳 backTo 時行為與現在完全相同）
- `app/pages/m/[slug]/book.vue` — 包入 `BizCustomerPageHeader`
- `app/pages/m/[slug]/lookup.vue` — 包入 `BizCustomerPageHeader`
- `app/pages/m/[slug]/my-bookings.vue` — 包入 `BizCustomerPageHeader`（並保留現有「切換身份」按鈕至 `#actions` slot）
- `app/pages/m/[slug]/queue/index.vue` — 移除自製 `← {name}` 連結，改用 `BizCustomerPageHeader`
- `app/pages/m/[slug]/queue/status.vue` — 改用 `BizCustomerPageHeader`，移除自製「回首頁」按鈕
- `app/pages/sign-in.vue` / `sign-up.vue` / `forgot-password.vue` — 改用 `BizCustomerPageHeader`，移除左欄手刻連結
- `app/pages/sys/merchants/[id].vue` — `BizPageHeader` 增 `backTo="/sys/merchants"`

### 系統 / 資料
- **無 Prisma schema 變更**；不需要 `prisma migrate`。
- **無 API 變更**；不影響 Nitro 路由。
- 部署到測試／正式站走既有 Docker / Railway 流程即可。
- 使用者提醒的「資料結構變化要自動同步到測試／正式」條款本次**不觸發**，會在 design.md 與 tasks.md 顯式紀錄「無 migration」結論。

### i18n
- 新增 key：`common.back`（繁中「返回」/ en「Back」/ ja「戻る」）。
- 沿用既有 key：`common.backToSignIn`（繁中「返回登入」/ en「Back to sign-in」/ ja「ログインに戻る」），forgot-password 透過 `backLabel` 覆蓋預設文案使用此 key。
- 既有 `← 回首頁`、`返回登入`、`回首頁`、`← {merchantName}` 等手刻文案統一改用 `common.back` 或經 `backLabel` 注入既有 i18n key。

### 驗收
- Playwright MCP 桌機 1024×768 + 手機 375×812 跑「顧客面 6 頁 + 公開頁 3 頁 + sys 二級頁」的返回鈕點擊測試，截圖存 `screenshots/improve-customer-page-nav/`。
- 既有 Vitest（`server/__tests__/`）保持綠燈。
- `npm run lint` 通過。
