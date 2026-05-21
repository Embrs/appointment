## ADDED Requirements

### Requirement: 顧客端 claim token 查回票

The system SHALL provide a public endpoint `GET /nuxt-api/public/queue/claim/[token]` that allows a customer to load their own ticket using only the `claimToken` printed on the take slip (no phone digits required), and SHALL return the same payload shape as `GET /nuxt-api/public/queue/[id]` plus `estimatedWaitMinutes` (computed via the shared `estimateWaitMinutes` pure function from `server/utils/availability.ts`).

The endpoint MUST: (a) match QueueTicket where `claimToken = token`, `ticketDate = today (merchant timezone)`, and `status IN ('WAITING','CALLED')`; (b) return `notFoundError` for any other case (token missing, token expired, ticket past-day, ticket DONE/SKIPPED) without distinguishing the cause; (c) NOT leak `customerPhone`, `customerLastName`, or `customerTitle` in any response field; (d) enforce dual RateLimit buckets — `queue-claim-ip:{ip}` (30 hits / 60s) and `queue-claim-token:{token}` (20 hits / 60s) — replying 429 + `Retry-After` when either bucket is exceeded.

#### Scenario: 以 token 載入當日 WAITING 票

- **GIVEN** 顧客當日領號得到 `claimToken="K7m4Tp9Q"`、票 `status=WAITING`
- **WHEN** GET `/nuxt-api/public/queue/claim/K7m4Tp9Q`
- **THEN** 回應 body 含 `{ ticket: { id, ticketNumber, status, ticketDate, serviceId, serviceName, ... }, currentServing, waitingAhead, estimatedWaitMinutes }`，不含 `customerPhone/customerLastName/customerTitle`

#### Scenario: ETA 與既有純函式一致

- **GIVEN** 顧客 token 對應 ticketNumber=8、counter.lastCalledNumber=5、service.avgServiceMinutes=10
- **WHEN** GET claim 端點
- **THEN** `estimatedWaitMinutes = 20`（前面 2 人 × 10 分鐘，與 Change B 的 ETA 純函式輸出一致）

#### Scenario: token 不存在

- **WHEN** GET `/nuxt-api/public/queue/claim/UNKNOWN1`
- **THEN** 回 404 `notFoundError`，不洩漏 token 是否存在的差異

#### Scenario: 跨日 token 過期

- **GIVEN** `claimToken` 對應的票 `ticketDate = 昨日`
- **WHEN** GET claim 端點
- **THEN** 回 404（不允許跨日查詢，縮短洩漏視窗）

#### Scenario: 終止狀態票拒絕

- **GIVEN** `claimToken` 對應的票 `status IN ('DONE','SKIPPED')`
- **WHEN** GET claim 端點
- **THEN** 回 404（不允許事後回顧，縮小可被掃描的票池）

#### Scenario: IP RateLimit 觸發

- **WHEN** 同 IP 1 分鐘內第 31 次 GET claim
- **THEN** 回 429 + `Retry-After`（`queue-claim-ip:` 桶上限 30/60s）

#### Scenario: token RateLimit 觸發

- **WHEN** 同一 token 1 分鐘內被任意 IP 第 21 次查詢
- **THEN** 回 429 + `Retry-After`（`queue-claim-token:` 桶上限 20/60s）

#### Scenario: 回應不洩漏顧客個資

- **GIVEN** 任意 claim 端點命中
- **WHEN** 顧客拿到 response
- **THEN** body 內絕不包含 `customerPhone`、`customerLastName`、`customerTitle` 任一欄位（與「手機末 4 碼查回票」一致的隱私基準）

### Requirement: 顧客領號頁顯示 QR Code 對話框

After a successful take on `/m/{slug}/queue`, the customer queue landing page SHALL surface a modal that contains: (a) a client-side rendered QR Code whose payload is `${origin}/m/{slug}/queue/status?token={claimToken}`, (b) the 8-character `claimToken` rendered in a large, easily readable monospace style, and (c) i18n-driven helper copy explaining「掃碼即可在手機追蹤叫號／今日有效」. The modal SHALL load the `qrcode` npm package via dynamic import so the take-form bundle is not bloated.

#### Scenario: 領號成功彈出 QR 對話框

- **GIVEN** 顧客在 `/m/{slug}/queue` 完成領號表單
- **WHEN** 後端回傳含 `claimToken` 的成功 response
- **THEN** 彈出 `ElDialog` 並渲染 QR Code（Canvas），同時以大字顯示 8 碼 claim short code

#### Scenario: QR 內容指向 status 頁

- **GIVEN** 領號成功的 dialog 已開啟
- **WHEN** 任意設備掃碼
- **THEN** 解析出的 URL 為 `${window.location.origin}/m/{slug}/queue/status?token={claimToken}`，且該 URL 直接連到顧客個人狀態頁

#### Scenario: qrcode 套件動態載入失敗 fallback

- **GIVEN** `import('qrcode')` 因網路或 bundle 問題失敗
- **WHEN** dialog 嘗試 render
- **THEN** 顯示「請使用以下連結與短碼追蹤」純文字 fallback（包含 URL 與短碼），不阻斷已領到的票資訊

#### Scenario: i18n 三語覆蓋

- **GIVEN** 顧客語系切換至 `zh / en / ja`
- **WHEN** dialog 開啟
- **THEN** 標題、`掃碼即可在手機追蹤叫號`、`今日有效`、短碼說明等 key（`queue.claim.title / qrHint / shortCode / todayOnly`）皆有翻譯，無 fallback 到英文 key 字串

### Requirement: 顧客等待頁支援 claim token 進入

`/m/{slug}/queue/status` SHALL accept a `token` query parameter as an alternative entry path. When `?token=` is present, the page SHALL load the ticket via `GET /nuxt-api/public/queue/claim/[token]` (skipping phone-last-4 lookup), wire the same WebSocket subscription + ETA display used by the existing `?id=` path, and fall back to the manual phone-last-4 flow only if the token request fails. When `?token=` is absent, behaviour SHALL remain identical to Change B (zero regression on the existing entry path).

#### Scenario: token 載入成功直接進 WS

- **GIVEN** 顧客掃碼或開啟 `/m/{slug}/queue/status?token={claimToken}`
- **WHEN** 頁面初始化
- **THEN** 自動呼叫 `/public/queue/claim/[token]` 取得票券與 `estimatedWaitMinutes`，並透過 `useQueueWS` / `StoreQueueRealtime` 訂閱該票，所有 ETA 與顯示行為與 `?id=` 路徑一致

#### Scenario: token 失敗降級至手機末 4 碼

- **GIVEN** token 已過期 / 不存在 / RateLimited
- **WHEN** claim 端點回 404 或 429
- **THEN** 顯示一次性提示「票券已過期或不存在，請改用手機末 4 碼回查」並導向 `/m/{slug}/queue/find`，不在當前頁阻塞

#### Scenario: 無 token query 完全沿用既有流程

- **GIVEN** 顧客直接造訪 `/m/{slug}/queue/status?id=...`（無 `token`）
- **WHEN** 頁面初始化
- **THEN** 走原本的 ticketId 載入路徑，WS / ETA / 蓋層 / 標題等行為 100% 與 Change B 結果相同（零回歸）

#### Scenario: token 與 id 同時提供以 token 為主

- **GIVEN** URL 同時帶 `?token=...&id=...`
- **WHEN** 頁面初始化
- **THEN** 優先使用 `token` 走 claim 端點（id 視為被覆蓋），失敗才回退到 id 載入；目的是讓 QR 流程的 URL 不需手動清理 query

### Requirement: 商家現場領號小單包含 QR Code

The walk-in print slip rendered by `OpenDialogQueueWalkIn`（`app/components/open/dialog/queue-walk-in.vue`） SHALL include, when the issued ticket carries a `claimToken`, a print-friendly QR Code block plus a large short-code text, along with i18n copy「掃碼即可在手機追蹤叫號／今日有效」. The print CSS (`@media print`) SHALL ensure the QR block is large enough to scan reliably and is not cropped by page margins.

#### Scenario: 列印小單含 QR Code 與短碼

- **GIVEN** 商家在 `OpenDialogQueueWalkIn` 完成代客領號、API 回應含 `claimToken`
- **WHEN** 商家點擊「列印小單」並進入瀏覽器列印預覽
- **THEN** 預覽畫面含票號、目前叫到號、QR Code（內容 `${origin}/m/{slug}/queue/status?token={claimToken}`）、8 碼短碼，與三語「掃碼追蹤」說明

#### Scenario: 無 claimToken 時不顯示 QR 區塊

- **GIVEN** 任何情況下 API 回應未含 `claimToken`（例如部署中後端尚未更新）
- **WHEN** 列印預覽
- **THEN** 不渲染 QR 與短碼區塊（不可顯示空白方框或 broken canvas），其餘列印內容沿用 Change A 既有版型

#### Scenario: 列印 CSS 確保 QR 可掃

- **GIVEN** 列印預覽
- **WHEN** 觀察 @media print 規則套用後的 QR 區塊
- **THEN** QR 邊長 ≥ 30mm、無 page-break-inside 切割、底色為純白以利掃描

## MODIFIED Requirements

### Requirement: 顧客拿號

The system SHALL allow customers to take a queue ticket via public API without authentication, using the same triplet (lastName, title, phone), with concurrent-safe number assignment per (merchantId, serviceId, ticketDate). The number assignment SHALL be delegated to the shared `internalCreateTicket` function so that the public and merchant paths share a single counter and lock. The successful response SHALL additionally include `claimToken: string` (the unguessable 8-character nanoid generated by `internalCreateTicket`) so that the client can render the QR Code and short code for離場追蹤.

#### Scenario: 拿號成功

- **Given** 商家 ACTIVE、服務 `bookingMode=QUEUE`、當日 QueueWindow 啟用且當前時間在窗內
- **When** 顧客 POST `/nuxt-api/public/queue/take` 帶 `slug/serviceId/lastName/title/phone`
- **Then** Handler 通過外層校驗後委派 `internalCreateTicket`，後者在交易內以 `SELECT ... FOR UPDATE` 鎖 QueueCounter，自增 `lastTicketNumber`，寫入 QueueTicket（`createdByMerchant=false`、`customerPhone=phone`、`claimToken=<nanoid>`），回 `{ ticketId, ticketNumber, ticketDate, currentServing, claimToken }`，並廣播 `TICKET_TAKEN`

#### Scenario: 兩人同時拿號編號不重複

- **Given** 當前 lastTicketNumber=5
- **When** 兩個 request 幾乎同時提交
- **Then** `internalCreateTicket` 內 FOR UPDATE 序列化兩交易，最終得到號碼 6 與 7（無重複、無跳號），兩張票各自獲得獨立 `claimToken`

#### Scenario: 跨日重置

- **Given** 昨日 counter lastTicketNumber=20、今日尚無 counter
- **When** 顧客今日首次拿號
- **Then** 自動建立今日 counter（lastTicketNumber=0 → 1），新票號碼為 1，並寫入 `claimToken`

#### Scenario: 同人同日重複領號

- **Given** 同 phone 同日同 service 已有 status=WAITING 票
- **When** 再次 POST take
- **Then** 回 409 `MSG_QUEUE_ALREADY_TAKEN`，body 含現有 `ticketId`（不重發 `claimToken`，因尚未建新票）

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

#### Scenario: claimToken 為不可猜測 nanoid

- **Given** 任一次拿號成功
- **When** 觀察 response 中的 `claimToken`
- **Then** 長度 8、僅由 alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz`（排除 `0/O/o/1/I/l`）組成，且與序號 / phone 無可推導關係

### Requirement: 商家現場代客領號

The system SHALL provide an authenticated endpoint `POST /nuxt-api/queue/create-for-customer` that allows a logged-in merchant to create a QueueTicket on behalf of a walk-in customer for one of the merchant's own QUEUE-mode services. The endpoint SHALL share the same concurrency-safe number assignment as the public take path (single shared `internalCreateTicket` implementation in `server/utils/queue.ts`), but SHALL relax constraints that are inappropriate for a counter-side workflow: `customerPhone` is optional, and `QueueWindow` time-range check is skipped. The endpoint MUST broadcast `TICKET_TAKEN` so that other peers (display boards, customer landing pages) update in real time. The successful response SHALL additionally include `claimToken: string` so that the walk-in dialog can render a QR Code and short code on the printed slip for the walk-in customer to scan and track remotely.

#### Scenario: 商家代建成功（含電話）

- **GIVEN** 商家已登入、`serviceId` 屬於該商家、服務 `bookingMode=QUEUE`、當日 counter 未達 `maxTickets`
- **WHEN** 商家 POST `/nuxt-api/queue/create-for-customer` 帶 `{ serviceId, lastName, title, phone }`
- **THEN** 透過共用 `internalCreateTicket` 在交易內以 `SELECT ... FOR UPDATE` 鎖 QueueCounter，自增 `lastTicketNumber`，寫入 QueueTicket（`createdByMerchant=true`、`customerPhone=phone`、`claimToken=<nanoid>`），回 `{ ticketId, ticketNumber, ticketDate, currentServing, claimToken }`，並廣播 `TICKET_TAKEN`

#### Scenario: 商家代建成功（不留電話）

- **GIVEN** 同上條件
- **WHEN** 商家 POST 帶 `{ serviceId, lastName, title }`（無 `phone`）
- **THEN** 票券寫入時 `customerPhone=null`、`createdByMerchant=true`、`claimToken=<nanoid>`，回號碼如常與 `claimToken`；廣播 `TICKET_TAKEN`（不留電話的場景特別需要 token 讓顧客自助追蹤）

#### Scenario: 跳過 QueueWindow 時間窗校驗

- **GIVEN** 服務當日 QueueWindow 啟用但當前時間在窗外（例如午休時段）、至少存在一筆 QueueWindow 設定
- **WHEN** 商家 POST create-for-customer
- **THEN** **不**回 `MSG_QUEUE_WINDOW_CLOSED`，照常建票（容許櫃台補單），仍回 `claimToken`

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
- **THEN** 正常建立新票（null 不參與「同人同日」判定），每張新票仍各自獲得獨立 `claimToken`

#### Scenario: 兩員工同時代建編號不重複

- **GIVEN** 同商家兩個 admin tab、當前 lastTicketNumber=5
- **WHEN** 兩 request 幾乎同時 POST create-for-customer（同 service）
- **THEN** 共用 `internalCreateTicket` 內 `FOR UPDATE` 序列化兩交易，分別得到號碼 6 與 7（無重複、無跳號），兩張票各自獲得不同 `claimToken`

#### Scenario: 公開端與商家端號碼共用同一序號池

- **GIVEN** 當前 lastTicketNumber=5
- **WHEN** 一個顧客 POST `/public/queue/take` 與一個商家 POST `/queue/create-for-customer` 同時抵達
- **THEN** 兩條路徑共用同一 `QueueCounter`、共用同一 advisory lock，分別拿到 6 與 7；不會兩條路線各自從 5 自增；兩張票皆各自獲得 `claimToken`

### Requirement: QueueTicket 票券來源與電話欄位

`QueueTicket` SHALL allow `customerPhone` to be NULL to support walk-in tickets created by merchants without a recorded phone number, and SHALL carry a `createdByMerchant` boolean flag (default `false`) that distinguishes tickets created by merchants on customers' behalf from tickets created by customers themselves through the public path. `QueueTicket` SHALL additionally carry a `claimToken: String?` column with a partial unique index `WHERE "claimToken" IS NOT NULL`, populated by `internalCreateTicket` for every newly created ticket and left NULL for pre-migration historical rows (no backfill).

#### Scenario: 公開端建票來源標記

- **GIVEN** 顧客 POST `/public/queue/take` 成功
- **WHEN** 票券寫入資料庫
- **THEN** `createdByMerchant=false`、`customerPhone` 為顧客提供的非空字串、`claimToken` 為 8 碼 nanoid

#### Scenario: 商家代建來源標記

- **GIVEN** 商家 POST `/queue/create-for-customer` 成功
- **WHEN** 票券寫入資料庫
- **THEN** `createdByMerchant=true`、`customerPhone` 為顧客電話或 `null`、`claimToken` 為 8 碼 nanoid

#### Scenario: claimToken 唯一索引

- **GIVEN** Prisma schema `QueueTicket.claimToken String? @unique`
- **WHEN** migration 套用
- **THEN** PostgreSQL 建立 partial unique index `WHERE "claimToken" IS NOT NULL`，允許歷史 row 共存 NULL 且新 row 之間強制唯一

#### Scenario: 既有資料不受 migration 影響

- **GIVEN** migration 套用前已存在的 QueueTicket（皆為公開端建立、phone 非空）
- **WHEN** migration 套用後
- **THEN** 既有票券的 `customerPhone` 保持原值不變、`createdByMerchant=false`（DEFAULT 套用）、`claimToken=null`（不回填）

#### Scenario: 既有票 claim 端點無法命中

- **GIVEN** migration 後的歷史票（`claimToken=null`）
- **WHEN** 任意 GET `/public/queue/claim/[token]` 嘗試命中
- **THEN** 因 `claimToken` 欄位為 null 而不被任何 token 比對命中（NULL ≠ 任何字串），歷史票仍維持「手機末 4 碼」唯一回查管道

### Requirement: 共用建票流程封裝

The number assignment, advisory lock, unique-key collision handling, `claimToken` generation, and `TICKET_TAKEN` broadcast SHALL be encapsulated in a single function `internalCreateTicket` exported from `server/utils/queue.ts`. The public take endpoint and the merchant create-for-customer endpoint SHALL both delegate to this function after performing their own path-specific validation (e.g. RateLimit and QueueWindow time-range check for the public path; `requireMerchant` and ownership check for the merchant path). No alternate implementation of counter increment, ticket insertion, or `claimToken` generation is permitted in route handlers. `internalCreateTicket` SHALL generate `claimToken` via a `nanoid` custom alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz` (length 8), write it inside the same `Serializable` transaction as the ticket row, and retry once if a `P2002` unique collision occurs.

#### Scenario: 公開端委派共用函式

- **GIVEN** `take.post.ts` 通過 RateLimit / QueueWindow / `bookingMode=QUEUE` / 同人同日校驗
- **WHEN** 進入建票階段
- **THEN** 呼叫 `internalCreateTicket(input)`，不在 handler 內直接寫 `prisma.queueCounter.update`、`prisma.queueTicket.create` 或 `nanoid` 生成 token

#### Scenario: 商家端委派共用函式

- **GIVEN** `create-for-customer.post.ts` 通過 `requireMerchant` / ownership / `bookingMode=QUEUE` / `maxTickets` / QueueWindow 存在性校驗
- **WHEN** 進入建票階段
- **THEN** 呼叫同一 `internalCreateTicket(input)`，不複製 Counter 鎖或 token 生成邏輯

#### Scenario: 共用函式之外無其他建票路徑

- **GIVEN** codebase 任何位置
- **WHEN** 搜尋 `prisma.queueTicket.create` 呼叫
- **THEN** 僅出現在 `internalCreateTicket` 內部一次（不含測試 fixtures 與 seed 腳本）

#### Scenario: claimToken 在交易內生成

- **GIVEN** `internalCreateTicket` 執行中
- **WHEN** 寫入新 QueueTicket
- **THEN** 同一 `Serializable` 交易內呼叫 `generateClaimToken()` 產生 token、寫入 `claimToken` 欄位（不是事後 update 補寫）

#### Scenario: token 碰撞自動重試

- **GIVEN** 第一次 nanoid 巧合與既有未過期 token 重複，導致 `P2002` 唯一鍵衝突
- **WHEN** `internalCreateTicket` 偵測到 `P2002`
- **THEN** 整個交易回滾並以全新 token 重試一次；兩次仍衝突才回 5xx（實務不可能）

#### Scenario: 共用函式回傳 claimToken

- **GIVEN** `internalCreateTicket` 成功
- **WHEN** 呼叫端解構回傳
- **THEN** `result.ticket` 上包含 `claimToken: string`（呼叫端 take / create-for-customer 直接放入 response body）
