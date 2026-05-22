# Capability：finalize-deploy
## Requirements
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

The Dockerfile SHALL run `npx prisma generate` at build time and `npx prisma migrate deploy` at container startup. The migration step at startup SHALL be the entrypoint's first action, and SHALL exit with a non-zero status if migration fails (preventing the Nitro server from booting against a stale schema). A `.env.example` SHALL list every required environment variable with comments.

#### Scenario: docker build 成功

- **When** `docker build -t appointment .`
- **Then** builder stage 成功跑 `npm ci` → `npx prisma generate` → `npm run build`，產物含 `node_modules/.prisma/client`

#### Scenario: 容器啟動跑 migration

- **Given** Railway / 任意 Docker host 新部署
- **When** 容器啟動
- **Then** entrypoint 先跑 `npx prisma migrate deploy`，成功後啟動 Nitro server；過程在 stdout 印出 `[deploy] migrate deploy OK`

#### Scenario: migration 失敗中止啟動

- **Given** 新部署的 image 含一筆 migration，但執行時失敗（語法錯、constraint 衝突、DATABASE_URL 不通等）
- **When** 容器啟動
- **Then** entrypoint SHALL 以 exit code 非 0 結束，**不**啟動 Nitro server；Railway / orchestrator 偵測 unhealthy 後保留前一版容器繼續服務（rolling deploy 行為），同時於 deploy log 留下完整錯誤訊息供排查

#### Scenario: 本地與 CI 都能重現

- **Given** 開發者本地或 CI 環境
- **When** 執行 `docker run --env-file .env.dev appointment`
- **Then** 行為一致：先 migrate deploy 再啟動 server；migration 失敗不啟動

#### Scenario: .env.example 完整

- **Given** README 提及部署需要的環境變數
- **When** 開發者複製 `.env.example` 為 `.env`
- **Then** 含 DATABASE_URL、JWT_SECRET、R2_*、CRON_SECRET、NUXT_API_BASE 等所有變數，附用途註解

### Requirement: 健康檢查與部署可觀測性端點

系統 SHALL 提供 `GET /nuxt-api/health` 公開端點（無需認證），回報應用啟動狀態與資料庫連線狀態，作為 Railway / 監控/巡檢的入口。當資料庫連線正常時回 200，連線失敗時回 503。回應 SHALL 含當前已套用的最新 migration 名稱與 commit hash（如 build 時注入），方便人工確認部署是否到位。

#### Scenario: 健康檢查正常

- **GIVEN** 應用正常啟動、DB 可連線
- **WHEN** `GET /nuxt-api/health`
- **THEN** 響應 200，`data` 含 `{ status: 'ok', db: 'connected', migration: '<最新 migration name>', commit: '<short sha 或 "unknown">', uptimeSec: <number> }`

#### Scenario: 資料庫斷線

- **GIVEN** 應用已啟動但資料庫無法連線（網路 / 帳密錯）
- **WHEN** `GET /nuxt-api/health`
- **THEN** 響應 503，`data` 含 `{ status: 'degraded', db: 'disconnected' }`，並於 server log 留下錯誤

#### Scenario: 健康檢查不需認證

- **GIVEN** 無 Authorization header
- **WHEN** `GET /nuxt-api/health`
- **THEN** 仍回 200 / 503，**不**回 401；端點不洩漏內部敏感欄位（如 DATABASE_URL、JWT_SECRET）

### Requirement: 啟動日誌印出 migration 與 commit hash

Nitro server 啟動完成時 SHALL 於 stdout 印出當前已套用最新 migration 名稱、應用版本（commit hash 或 `package.json` version），方便部署後快速確認版本到位。

#### Scenario: 啟動日誌可見

- **GIVEN** 容器或 `npm run dev` 啟動
- **WHEN** Nitro server 就緒
- **THEN** stdout 出現一行（或數行）形如 `[boot] migration=20260521xxxxxx commit=<short sha or "dev"> nodeEnv=production`

#### Scenario: 無 commit hash 時退回 dev

- **GIVEN** build 階段未注入 `GIT_COMMIT_SHA` 環境變數（如本地 dev）
- **WHEN** 啟動日誌印出
- **THEN** `commit=dev` 或 `commit=unknown`，**不**讓啟動失敗

### Requirement: 顧客面語系切換 UI

The customer-facing layout (`LayoutFrontDesk`) SHALL provide a working locale switcher that uses `useI18n().setLocale(code)` to switch between zh / en / ja. The switcher MUST be a dropdown showing each locale's display name; the trigger button MUST use a translate icon (`mdi:translate` via `NuxtIcon`) — not arbitrary glyphs such as `⌐`.

#### Scenario: 點擊切換英文

- **GIVEN** 顧客位於 `/m/{slug}`（zh 預設）
- **WHEN** 點擊頂部語系下拉，選擇「English」
- **THEN** 整頁 UI 文字切換為英文（按鈕、卡片標籤、step labels），cookie `i18n_redirected` 寫入 `en`，下次造訪預設仍為英文

#### Scenario: 點擊切換日文

- **GIVEN** 顧客在預約流程任一步
- **WHEN** 切換語系為「日本語」
- **THEN** 步驟 label、按鈕、表單欄位提示全部變日文，沒有出現 i18n key 原文

#### Scenario: 下拉禁用當前語系

- **GIVEN** 當前語系為 zh
- **WHEN** 顧客打開語系下拉
- **THEN** 「繁體中文」項目為 disabled 狀態，無法重複切到相同語系

#### Scenario: Icon 正確呈現

- **GIVEN** 任何顧客面頁面
- **WHEN** header 渲染完成
- **THEN** 語系按鈕內顯示的是 translate icon（地球或翻譯圖示），不是 `⌐` 或其他非預期字符

