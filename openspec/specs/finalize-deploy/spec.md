# Capability：finalize-deploy

## ADDED Requirements

### Requirement: i18n 三語完整覆蓋

The system SHALL provide complete translations in zh / en / ja for all customer-facing and back-office UI strings. The three locale files MUST have identical key structure.

#### Scenario: 切換英文語系

- **Given** 顧客在繁中首頁
- **When** 切換語系到 en
- **Then** 所有業務字串顯示英文（按鈕、提示、欄位 label），不應出現翻譯 key 原文（如 `customer.lookup.title`）

#### Scenario: 切換日文語系

- **Given** 顧客在預約流程任一步
- **When** 切換語系到 ja
- **Then** 所有業務字串顯示日文，layout 不破版

#### Scenario: 後端錯誤訊息 fallback

- **Given** API 回傳 `status.message = { zh_tw, en, ja }`
- **When** UI 顯示錯誤訊息
- **Then** 依當前語系挑對應字串顯示

### Requirement: 廣告插槽元件

The system SHALL provide an `AdSlot` component that conditionally renders advertising content via `StoreEnv().adConfig`. When config is disabled or empty, the slot MUST occupy zero layout space.

#### Scenario: 預設無廣告不破版

- **Given** `StoreEnv().adConfig = {}`（MVP 預設）
- **When** `/m/{slug}` 頁面渲染
- **Then** 頁面頂部無空白區塊、頂部 banner 位置無 DOM 元素被渲染（`v-if` 條件為 false）

#### Scenario: 啟用廣告不破版

- **Given** `adConfig['merchant-page-top'] = { enabled: true, html: '<div style="height:200px">AD</div>' }`
- **When** 頁面渲染
- **Then** 商家頁頂部顯示 200px 高的廣告區塊，下方內容自然下移、無重疊

#### Scenario: 預留 3 個位置

- **Given** 顧客在 `/m/{slug}`、`/m/{slug}/queue/status`、`/m/{slug}/my-bookings`
- **When** DOM 渲染（無論 hasAd 真假）
- **Then** 對應頁面有 `AdSlot` 元件 instance（即使 v-if 為 false 也存在元件實例，方便日後 toggle）

### Requirement: 排程歸檔 API

The system SHALL expose a cron-triggered endpoint at `POST /nuxt-api/cron/archive` that requires `x-cron-secret` header authentication, acquires a JobLock, and archives Appointment older than 90 days into AppointmentArchive in batched transactions.

#### Scenario: 認證通過完成歸檔

- **Given** `CRON_SECRET=xxx`、Appointment 表有 10 筆 startAt < now - 90 days
- **When** `POST /nuxt-api/cron/archive` with `x-cron-secret: xxx`
- **Then** 10 筆 Appointment 全部搬到 AppointmentArchive、原表刪除，回 200 `{ archived: 10, ... }`

#### Scenario: 缺少 secret 拒絕

- **When** `POST /nuxt-api/cron/archive` 無 header 或 header 錯誤
- **Then** 回 401 `MSG_CRON_UNAUTHORIZED`，未啟動任何 DB 操作

#### Scenario: 重複觸發互斥

- **Given** 同名 JobLock 已存在且未過期
- **When** 第二次 POST 進來
- **Then** 回 409 `MSG_ARCHIVE_RUNNING`，不執行歸檔

#### Scenario: 批次處理避免長事務

- **Given** 50,000 筆過期 Appointment
- **When** cron 觸發
- **Then** 每批 500 筆事務處理、迴圈直到無資料，總執行時間記錄於回傳 `durationMs`

#### Scenario: 副清理

- **Given** QueueCounter 含 ticketDate < now - 30 days、RateLimitBucket 含 windowStart < now - 1 hour
- **When** cron 觸發
- **Then** 過期 QueueCounter 與 RateLimitBucket 被 deleteMany 清除，數量回傳於 response

### Requirement: Docker 與部署可重現

The Dockerfile SHALL run `npx prisma generate` at build time and `npx prisma migrate deploy` at container startup. A `.env.example` SHALL list every required environment variable with comments.

#### Scenario: docker build 成功

- **When** `docker build -t appointment .`
- **Then** builder stage 成功跑 `npm ci` → `npx prisma generate` → `npm run build`，產物含 `node_modules/.prisma/client`

#### Scenario: 容器啟動跑 migration

- **Given** Railway 新部署
- **When** 容器啟動
- **Then** 先跑 `npx prisma migrate deploy`，成功後啟動 Nitro server

#### Scenario: .env.example 完整

- **Given** README 提及部署需要的環境變數
- **When** 開發者複製 `.env.example` 為 `.env`
- **Then** 含 DATABASE_URL、JWT_SECRET、R2_*、CRON_SECRET、NUXT_API_BASE 等所有變數，附用途註解
