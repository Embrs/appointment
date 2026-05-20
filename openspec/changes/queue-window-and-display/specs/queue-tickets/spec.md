## ADDED Requirements

### Requirement: 商家管理 QueueWindow

系統 SHALL 提供商家後台讀取與整批覆寫某服務每週領號時間窗的端點，僅 `requireMerchant` 商家可操作自己的資料。

#### Scenario: 讀取列表

- **GIVEN** 已登入商家、選定 `serviceId`
- **WHEN** GET `/nuxt-api/merchant/queue-window?serviceId=xxx`
- **THEN** 回 `{ windows: [{ weekday, startTime, endTime, maxTickets, isActive }] }`，按 weekday 升序

#### Scenario: 整批覆寫

- **GIVEN** 已登入商家
- **WHEN** PUT `/nuxt-api/merchant/queue-window` body `{ serviceId, windows: [...] }`
- **THEN** 事務內 `deleteMany({ merchantId, serviceId })` → `createMany(windows)`，原子；回 200 + 新列表

#### Scenario: 跨商家越權

- **GIVEN** 商家 A 已登入、`serviceId` 屬於商家 B
- **WHEN** PUT
- **THEN** 回 404 `MSG_SERVICE_NOT_FOUND`（不洩漏存在與否）

#### Scenario: 非 QUEUE 服務拒絕

- **GIVEN** 服務 `bookingMode != QUEUE`
- **WHEN** PUT
- **THEN** 回 400 `MSG_NOT_QUEUE_SERVICE`

#### Scenario: 欄位格式驗證

- **WHEN** body 含 `weekday=8` 或 `startTime='25:00'` 或 `maxTickets=-1`
- **THEN** 回 400（Zod 驗證失敗）

#### Scenario: 空陣列代表全停用

- **WHEN** PUT body `windows: []`
- **THEN** 該服務所有 QueueWindow 被刪除；顧客領號回 `MSG_QUEUE_WINDOW_CLOSED`

### Requirement: 公開查詢當前叫號

公開 `GET /nuxt-api/public/m/[slug]` SHALL 對每個 `bookingMode=QUEUE` 服務多回傳當日 `currentServing` 與 `waitingCount`，讓領號頁顯示即時叫號狀態。

#### Scenario: 含 counter 資訊

- **GIVEN** 商家當日 QUEUE 服務 A 已發 10 號、叫到 5 號
- **WHEN** GET `/public/m/[slug]`
- **THEN** services 內 A 物件多含 `currentServing: 5`、`waitingCount: 5`、`ticketsTaken: 10`

#### Scenario: 當日無 counter

- **GIVEN** QUEUE 服務 B 當日無人領號
- **WHEN** GET
- **THEN** 物件含 `currentServing: 0`、`waitingCount: 0`、`ticketsTaken: 0`

#### Scenario: 非 QUEUE 服務不含這些欄位

- **GIVEN** 服務 C 是 TIME_SLOT
- **WHEN** GET
- **THEN** C 物件**不**含 `currentServing`、`waitingCount`、`ticketsTaken`（避免誤導）

#### Scenario: 公開端點不需鑑權

- **WHEN** 無 token 呼叫
- **THEN** 仍正常回傳（與既有 public endpoint 一致）

## MODIFIED Requirements

### Requirement: 領號頁

The customer queue landing page SHALL list QUEUE-mode services, display current serving number with live updates via WebSocket, and allow taking a ticket via triplet form.

#### Scenario: 列服務

- **Given** 商家有多個服務，僅 2 個是 QUEUE
- **When** 訪客進入 `/m/{slug}/queue`
- **Then** 僅顯示 2 個 QUEUE 服務卡

#### Scenario: 領號流程

- **When** 點服務卡 → 填三元組 → 送出
- **Then** 後端拿號成功 → 自動導向 `/m/{slug}/queue/status?id=...`

#### Scenario: 顯示當前叫號

- **Given** 服務 A 當日已叫到 5 號、發到 10 號
- **When** 顧客進入 `/m/{slug}/queue`
- **Then** 服務 A 卡片顯示「目前叫到 5 號 · 等待 5 人」

#### Scenario: 尚未開始服務

- **Given** 當日尚無人領號（lastTicketNumber=0）
- **When** 進入頁面
- **Then** 卡片顯示「尚未開始服務」（不顯示數字）

#### Scenario: 已發號未叫號

- **Given** lastTicketNumber=3、lastCalledNumber=0
- **When** 進入頁面
- **Then** 卡片顯示「目前叫到 — · 等待 3 人」

#### Scenario: WebSocket 即時更新

- **Given** 顧客已進入 `/m/{slug}/queue`、看到「目前叫到 5 號」
- **When** 商家透過後台叫到 6 號
- **Then** 不需重新整理，卡片自動更新為「目前叫到 6 號 · 等待 4 人」（透過 `StoreQueueRealtime` WS 推播 `CALL_NEXT`）

#### Scenario: 新顧客領號廣播

- **Given** 顧客 A 在頁面上、看到「等待 3 人」
- **When** 顧客 B 從另一裝置領號成功（`TICKET_TAKEN` 廣播）
- **Then** A 的頁面更新為「等待 4 人」

#### Scenario: WebSocket 斷線降級

- **Given** WS 因網路斷線
- **When** 商家叫號
- **Then** 領號頁透過 `StoreQueueRealtime` 既有 15 秒輪詢 fallback，最遲 15 秒內更新顯示

#### Scenario: 離開頁面清理連線

- **When** 顧客離開 `/m/{slug}/queue`
- **Then** `onBeforeUnmount` 呼叫 `queueStore.Disconnect()`，peer 從 `peerMap` 移除
