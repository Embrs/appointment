# queue-tickets Specification

## Purpose
TBD - created by archiving change queue-tickets. Update Purpose after archive.
## Requirements
### Requirement: 顧客拿號

The system SHALL allow customers to take a queue ticket via public API without authentication, using the same triplet (lastName, title, phone), with concurrent-safe number assignment per (merchantId, serviceId, ticketDate).

#### Scenario: 拿號成功

- **Given** 商家 ACTIVE、服務 `bookingMode=QUEUE`、當日 QueueWindow 啟用且當前時間在窗內
- **When** 顧客 POST `/nuxt-api/public/queue/take` 帶 `slug/serviceId/lastName/title/phone`
- **Then** 後端在交易內以 `SELECT ... FOR UPDATE` 鎖 QueueCounter，自增 `lastTicketNumber`，寫入 QueueTicket，回 `{ ticketId, ticketNumber, ticketDate, currentServing }`，並廣播 `TICKET_TAKEN`

#### Scenario: 兩人同時拿號編號不重複

- **Given** 當前 lastTicketNumber=5
- **When** 兩個 request 幾乎同時提交
- **Then** FOR UPDATE 序列化兩交易，最終得到號碼 6 與 7（無重複、無跳號）

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
- **Then** 回 400 `MSG_QUEUE_WINDOW_CLOSED`

#### Scenario: 達當日上限

- **Given** QueueWindow `maxTickets=10`、當日已發 10 張
- **When** POST take
- **Then** 回 409 `MSG_QUEUE_FULL`

#### Scenario: RateLimit 觸發

- **When** 同 IP 1 分鐘內第 6 次 take
- **Then** 回 429 + `Retry-After`

### Requirement: 顧客查詢票狀態

The system SHALL allow public lookup of a single queue ticket by id, returning the ticket state and current serving number for the same (merchantId, serviceId, ticketDate).

#### Scenario: 等待頁兜底輪詢

- **Given** 顧客有 ticketId
- **When** GET `/public/queue/[id]`
- **Then** 回 `{ ticket: { status, ticketNumber, ... }, currentServing, waitingAhead }`

#### Scenario: 票不存在

- **When** GET 未知 id
- **Then** 回 404 `MSG_QUEUE_TICKET_NOT_FOUND`

### Requirement: 商家叫號

The system SHALL allow merchants to call the next waiting ticket for a service, with concurrent-safe transition WAITING → CALLED.

#### Scenario: 叫下一號

- **Given** 商家 token、當日有 WAITING 票（最小號碼=5）
- **When** POST `/nuxt-api/queue/call-next` 帶 `serviceId`
- **Then** 鎖 counter → 找最小 WAITING 票 → 更新為 CALLED + calledAt + counter.lastCalledNumber=5；廣播 `CALL_NEXT { serviceId, current: 5, servingTicketId, timestamp }`；回該票資訊

#### Scenario: 無等待中票

- **Given** 當日所有票皆 DONE/SKIPPED 或無票
- **When** POST call-next
- **Then** 回 400 `MSG_QUEUE_NO_WAITING`

#### Scenario: 兩員工同按

- **Given** 兩個商家 tab 同時 POST call-next
- **When** 兩 request 抵達後端
- **Then** FOR UPDATE 序列化；其中一個成功進到下一號，另一個收到下下一號（或當已無 WAITING 票時收 400）；不會兩個都成功取同一號

### Requirement: 商家標記完成或過號

The system SHALL allow merchants to mark a CALLED ticket as DONE or SKIPPED, with each operation broadcasting to subscribed peers.

#### Scenario: 標完成

- **Given** ticket status=CALLED
- **When** POST `/nuxt-api/queue/[id]/done`
- **Then** status=DONE、doneAt=now()、廣播 `TICKET_DONE`；回該票

#### Scenario: 標過號

- **When** POST `/nuxt-api/queue/[id]/skip`
- **Then** status=SKIPPED、廣播 `TICKET_SKIPPED`

#### Scenario: 狀態非 CALLED

- **Given** ticket status=WAITING
- **When** POST done
- **Then** 回 400 `MSG_QUEUE_INVALID_TRANSITION`

### Requirement: 商家當日總覽

The system SHALL provide merchants with the day's tickets grouped by service, including each service's counter state.

#### Scenario: 當日總覽

- **When** GET `/nuxt-api/queue/today`
- **Then** 回 `{ services: [{ serviceId, serviceName, counter: { lastTicketNumber, lastCalledNumber }, tickets: [...] }] }`

### Requirement: WebSocket 即時推播

The system SHALL provide a WebSocket endpoint that broadcasts queue events to all peers subscribed by merchantId.

#### Scenario: 連線訂閱

- **When** 客戶端 `wss://.../nuxt-api/queue/ws?merchantId=xxx`
- **Then** 後端 `open` 事件將 peer 加入 `peerMap[merchantId]`

#### Scenario: 叫號廣播

- **When** 商家叫號觸發 `broadcastQueue(merchantId, payload)`
- **Then** 所有 `peerMap[merchantId]` 內 peer 收到 JSON `{ type, serviceId, current, servingTicketId, timestamp }`

#### Scenario: 心跳

- **When** 客戶端送 `ping`
- **Then** 後端回 `pong`

#### Scenario: 離開清除

- **When** peer 連線關閉
- **Then** 從 `peerMap[merchantId]` 移除；空 set 自動清除

### Requirement: 顧客等待頁 WS 兜底

The customer waiting page SHALL connect via WebSocket for live updates and fall back to 15-second polling if disconnected.

#### Scenario: WS 推播即時更新

- **Given** 等待頁已連線、自己的票號=5
- **When** 商家叫號 5
- **Then** 等待頁無需手動重整即顯示「服務中：5、請進入」

#### Scenario: WS 斷線輪詢兜底

- **Given** WS 因網路問題斷線、自己的票號=5
- **When** 商家叫號 5
- **Then** 等待頁透過每 15 秒 `GET /public/queue/[id]` 取得最新 currentServing，最遲 15 秒內顯示「服務中：5」

### Requirement: 商家叫號頁

The merchant queue page SHALL display the current serving number for each QUEUE service and provide controls to call next, mark done, and skip.

#### Scenario: 控制台呈現

- **Given** 商家當日有 QUEUE 服務 A（current=5）、服務 B（current=3）
- **When** 進入 `/admin/queue`
- **Then** 顯示兩張卡，各自大顯示當前 current、列出該服務 WAITING 票、提供「叫下一號/完成/過號」按鈕

#### Scenario: 自身叫號後即時更新

- **When** 點「叫下一號」成功
- **Then** 該卡 current 更新、票列表移除被叫的票；同時其他 tab（含顧客等待頁）收到 WS 推播

### Requirement: 領號頁

The customer queue landing page SHALL list QUEUE-mode services and allow taking a ticket via triplet form.

#### Scenario: 列服務

- **Given** 商家有多個服務，僅 2 個是 QUEUE
- **When** 訪客進入 `/m/{slug}/queue`
- **Then** 僅顯示 2 個 QUEUE 服務卡

#### Scenario: 領號流程

- **When** 點服務卡 → 填三元組 → 送出
- **Then** 後端拿號成功 → 自動導向 `/m/{slug}/queue/status?id=...`

