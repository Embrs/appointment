## ADDED Requirements

### Requirement: 商家現場代客領號

The system SHALL provide an authenticated endpoint `POST /nuxt-api/queue/create-for-customer` that allows a logged-in merchant to create a QueueTicket on behalf of a walk-in customer for one of the merchant's own QUEUE-mode services. The endpoint SHALL share the same concurrency-safe number assignment as the public take path (single shared `internalCreateTicket` implementation in `server/utils/queue.ts`), but SHALL relax constraints that are inappropriate for a counter-side workflow: `customerPhone` is optional, and `QueueWindow` time-range check is skipped. The endpoint MUST broadcast `TICKET_TAKEN` so that other peers (display boards, customer landing pages) update in real time.

#### Scenario: 商家代建成功（含電話）

- **GIVEN** 商家已登入、`serviceId` 屬於該商家、服務 `bookingMode=QUEUE`、當日 counter 未達 `maxTickets`
- **WHEN** 商家 POST `/nuxt-api/queue/create-for-customer` 帶 `{ serviceId, lastName, title, phone }`
- **THEN** 透過共用 `internalCreateTicket` 在交易內以 `SELECT ... FOR UPDATE` 鎖 QueueCounter，自增 `lastTicketNumber`，寫入 QueueTicket（`createdByMerchant=true`、`customerPhone=phone`），回 `{ ticketId, ticketNumber, ticketDate, currentServing }`，並廣播 `TICKET_TAKEN`

#### Scenario: 商家代建成功（不留電話）

- **GIVEN** 同上條件
- **WHEN** 商家 POST 帶 `{ serviceId, lastName, title }`（無 `phone`）
- **THEN** 票券寫入時 `customerPhone=null`、`createdByMerchant=true`，回號碼如常；廣播 `TICKET_TAKEN`

#### Scenario: 跳過 QueueWindow 時間窗校驗

- **GIVEN** 服務當日 QueueWindow 啟用但當前時間在窗外（例如午休時段）、至少存在一筆 QueueWindow 設定
- **WHEN** 商家 POST create-for-customer
- **THEN** **不**回 `MSG_QUEUE_WINDOW_CLOSED`，照常建票（容許櫃台補單）

#### Scenario: QueueWindow 全空仍視為關閉

- **GIVEN** 服務當日無任何 QueueWindow 設定（陣列空 = 商家明確關閉此服務的號碼牌）
- **WHEN** 商家 POST create-for-customer
- **THEN** 回 400 `MSG_QUEUE_WINDOW_CLOSED`

#### Scenario: 達當日上限拒絕

- **GIVEN** 當日 counter 已達 `maxTickets`
- **WHEN** 商家 POST create-for-customer
- **THEN** 回 409 `MSG_QUEUE_FULL`（與公開端一致；商家不應繞過自己設的上限）

#### Scenario: 非 QUEUE 模式拒絕

- **GIVEN** 服務 `bookingMode != QUEUE`
- **WHEN** 商家 POST create-for-customer
- **THEN** 回 400 `MSG_NOT_QUEUE_SERVICE`

#### Scenario: 跨商家越權

- **GIVEN** 商家 A 已登入、`serviceId` 屬於商家 B
- **WHEN** 商家 A POST create-for-customer
- **THEN** 回 404 `MSG_SERVICE_NOT_FOUND`（不洩漏存在與否）

#### Scenario: 未登入拒絕

- **GIVEN** 無 token 或 token 無效
- **WHEN** POST create-for-customer
- **THEN** `requireMerchant` 守衛回 401（與其他商家端點一致）

#### Scenario: 同人同日重複領號（有電話時仍套用）

- **GIVEN** 商家代建時帶 `phone`，且同 service 當日已有同 phone、status=WAITING 的票
- **WHEN** POST create-for-customer 帶相同 `phone`
- **THEN** 回 409 `MSG_QUEUE_ALREADY_TAKEN`，body 含現有 `ticketId`（與公開端一致）

#### Scenario: 不留電話不套用重複領號規則

- **GIVEN** 商家代建時未帶 `phone`，且當日已有多張 `customerPhone=null` 的票
- **WHEN** POST create-for-customer 不帶 `phone`
- **THEN** 正常建立新票（null 不參與「同人同日」判定）

#### Scenario: 兩員工同時代建編號不重複

- **GIVEN** 同商家兩個 admin tab、當前 lastTicketNumber=5
- **WHEN** 兩 request 幾乎同時 POST create-for-customer（同 service）
- **THEN** 共用 `internalCreateTicket` 內 `FOR UPDATE` 序列化兩交易，分別得到號碼 6 與 7（無重複、無跳號）

#### Scenario: 公開端與商家端號碼共用同一序號池

- **GIVEN** 當前 lastTicketNumber=5
- **WHEN** 一個顧客 POST `/public/queue/take` 與一個商家 POST `/queue/create-for-customer` 同時抵達
- **THEN** 兩條路徑共用同一 `QueueCounter`、共用同一 advisory lock，分別拿到 6 與 7；不會兩條路線各自從 5 自增

### Requirement: QueueTicket 票券來源與電話欄位

`QueueTicket` SHALL allow `customerPhone` to be NULL to support walk-in tickets created by merchants without a recorded phone number, and SHALL carry a `createdByMerchant` boolean flag (default `false`) that distinguishes tickets created by merchants on customers' behalf from tickets created by customers themselves through the public path.

#### Scenario: 公開端建票來源標記

- **GIVEN** 顧客 POST `/public/queue/take` 成功
- **WHEN** 票券寫入資料庫
- **THEN** `createdByMerchant=false`、`customerPhone` 為顧客提供的非空字串

#### Scenario: 商家代建來源標記

- **GIVEN** 商家 POST `/queue/create-for-customer` 成功
- **WHEN** 票券寫入資料庫
- **THEN** `createdByMerchant=true`、`customerPhone` 為顧客電話或 `null`

#### Scenario: 既有資料不受 migration 影響

- **GIVEN** migration 套用前已存在的 QueueTicket（皆為公開端建立、phone 非空）
- **WHEN** migration 套用後
- **THEN** 既有票券的 `customerPhone` 保持原值不變、`createdByMerchant=false`（DEFAULT 套用）

### Requirement: 共用建票流程封裝

The number assignment, advisory lock, unique-key collision handling, and `TICKET_TAKEN` broadcast SHALL be encapsulated in a single function `internalCreateTicket` exported from `server/utils/queue.ts`. The public take endpoint and the merchant create-for-customer endpoint SHALL both delegate to this function after performing their own path-specific validation (e.g. RateLimit and QueueWindow time-range check for the public path; `requireMerchant` and ownership check for the merchant path). No alternate implementation of counter increment or ticket insertion is permitted in route handlers.

#### Scenario: 公開端委派共用函式

- **GIVEN** `take.post.ts` 通過 RateLimit / QueueWindow / `bookingMode=QUEUE` / 同人同日校驗
- **WHEN** 進入建票階段
- **THEN** 呼叫 `internalCreateTicket(input)`，不在 handler 內直接寫 `prisma.queueCounter.update` 或 `prisma.queueTicket.create`

#### Scenario: 商家端委派共用函式

- **GIVEN** `create-for-customer.post.ts` 通過 `requireMerchant` / ownership / `bookingMode=QUEUE` / `maxTickets` / QueueWindow 存在性校驗
- **WHEN** 進入建票階段
- **THEN** 呼叫同一 `internalCreateTicket(input)`，不複製 Counter 鎖邏輯

#### Scenario: 共用函式之外無其他建票路徑

- **GIVEN** codebase 任何位置
- **WHEN** 搜尋 `prisma.queueTicket.create` 呼叫
- **THEN** 僅出現在 `internalCreateTicket` 內部一次（不含測試 fixtures 與 seed 腳本）

## MODIFIED Requirements

### Requirement: 顧客拿號

The system SHALL allow customers to take a queue ticket via public API without authentication, using the same triplet (lastName, title, phone), with concurrent-safe number assignment per (merchantId, serviceId, ticketDate). The number assignment SHALL be delegated to the shared `internalCreateTicket` function so that the public and merchant paths share a single counter and lock.

#### Scenario: 拿號成功

- **Given** 商家 ACTIVE、服務 `bookingMode=QUEUE`、當日 QueueWindow 啟用且當前時間在窗內
- **When** 顧客 POST `/nuxt-api/public/queue/take` 帶 `slug/serviceId/lastName/title/phone`
- **Then** Handler 通過外層校驗後委派 `internalCreateTicket`，後者在交易內以 `SELECT ... FOR UPDATE` 鎖 QueueCounter，自增 `lastTicketNumber`，寫入 QueueTicket（`createdByMerchant=false`、`customerPhone=phone`），回 `{ ticketId, ticketNumber, ticketDate, currentServing }`，並廣播 `TICKET_TAKEN`

#### Scenario: 兩人同時拿號編號不重複

- **Given** 當前 lastTicketNumber=5
- **When** 兩個 request 幾乎同時提交
- **Then** `internalCreateTicket` 內 FOR UPDATE 序列化兩交易，最終得到號碼 6 與 7（無重複、無跳號）

#### Scenario: 跨日重置

- **Given** 昨日 counter lastTicketNumber=20、今日尚無 counter
- **When** 顧客今日首次拿號
- **Then** 自動建立今日 counter（lastTicketNumber=0 → 1），新票號碼為 1

#### Scenario: 同人同日重複領號

- **Given** 同 phone 同日同 service 已有 status=WAITING 票
- **When** 再次 POST take
- **Then** 回 409 `MSG_QUEUE_ALREADY_TAKEN`，body 含現有 `ticketId`

#### Scenario: 非 QUEUE 模式拒絕

- **Given** 服務 `bookingMode=TIME_SLOT`
- **When** POST take
- **Then** 回 400 `MSG_NOT_QUEUE_SERVICE`

#### Scenario: 領號時間窗外

- **Given** 當日無啟用的 QueueWindow，或當前時間在窗外
- **When** POST take
- **Then** 回 400 `MSG_QUEUE_WINDOW_CLOSED`（公開端嚴格校驗時間窗；商家代建端不套用此規則）

#### Scenario: 達當日上限

- **Given** QueueWindow `maxTickets=10`、當日已發 10 張
- **When** POST take
- **Then** 回 409 `MSG_QUEUE_FULL`

#### Scenario: RateLimit 觸發

- **When** 同 IP 1 分鐘內第 6 次 take
- **Then** 回 429 + `Retry-After`（RateLimit 僅作用於公開端；商家代建端不套用）
