# queue-tickets Specification

## Purpose
TBD - created by archiving change queue-tickets. Update Purpose after archive.
## Requirements
### Requirement: 顧客拿號

The system SHALL allow customers to take a queue ticket via public API without authentication, using the same triplet (lastName, title, phone), with concurrent-safe number assignment per `(merchantId, serviceId, resourceId, ticketDate)`. 端點 body SHALL 接受可選 `resourceId: string | null`，是否必填由 `getResourcesForQueueService(serviceId)` 結果動態決定（見 `resourceId 驗證規則`）。號碼分配 SHALL 委派 `internalCreateTicket(input)` 並由其在交易內維持 Counter 序列化、advisory rules、唯一鍵衝突重試；公開端與商家端共用同一份函式。成功回應 SHALL 額外包含 `claimToken: string` 與（若 service 已綁 resource）`resourceId: string` / `resourceName: string` 兩欄位，使前端可印小單／QR Code 與分群顯示。

#### Scenario: 拿號成功（未綁 resource）

- **GIVEN** 商家 ACTIVE、服務 `bookingMode=QUEUE` 未綁 resource、當日 QueueWindow 啟用且當前時間在窗內
- **WHEN** 顧客 POST `/nuxt-api/public/queue/take` 帶 `slug/serviceId/lastName/title/phone`（無 `resourceId`）
- **THEN** Handler 委派 `internalCreateTicket`（`resourceId=null`），鎖 `(s, NULL)` counter，自增 `lastTicketNumber`，寫入 QueueTicket（`createdByMerchant=false`、`customerPhone=phone`、`claimToken=<nanoid>`、`resourceId=null`），回 `{ ticketId, ticketNumber, ticketDate, currentServing, claimToken }`，並廣播 `TICKET_TAKEN { resourceId: null }`

#### Scenario: 拿號成功（綁 resource）

- **GIVEN** 服務綁 Resource X、Y
- **WHEN** 顧客 POST take 帶 `resourceId: X`
- **THEN** 委派 `internalCreateTicket(... resourceId: X ...)`，鎖 `(s, X)` counter；response 含 `{ ticketId, ticketNumber, claimToken, resourceId: X, resourceName: 'X' }`；廣播 `TICKET_TAKEN { resourceId: X, resourceName: 'X' }`

#### Scenario: 兩人同時拿號編號不重複（同 resource）

- **GIVEN** Resource X 當前 lastTicketNumber=5
- **WHEN** 兩個 request 幾乎同時提交、皆帶 `resourceId: X`
- **THEN** `internalCreateTicket` 內 FOR UPDATE 序列化兩交易，最終得到號碼 6 與 7（無重複、無跳號）

#### Scenario: 不同 resource 並發拿號互不阻塞

- **GIVEN** 服務綁 X、Y；兩 request 同時抵達，分別帶 `resourceId: X` 與 `resourceId: Y`
- **WHEN** 後端處理
- **THEN** 兩個交易鎖不同 counter row，互不等待，X 與 Y 各自得到 1 號（若皆當日首次）

#### Scenario: 跨日重置（按 resource 各自）

- **GIVEN** Resource X 昨日 counter lastTicketNumber=20、今日尚無 counter
- **WHEN** 顧客今日首次帶 `resourceId: X` 拿號
- **THEN** 自動建立今日 (s, X) counter（lastTicketNumber=0 → 1），新票號碼為 1

#### Scenario: 同人同日重複領號（同 resource）

- **GIVEN** 同 phone 同日同 service 同 resourceId 已有 status=WAITING 票
- **WHEN** 再次 POST take 帶相同 `resourceId`
- **THEN** 回 409 `MSG_QUEUE_ALREADY_TAKEN`，body 含現有 `ticketId`

#### Scenario: 同人同日不同 resource 允許各自一張

- **GIVEN** 同 phone 在 Resource X 已有 WAITING 票
- **WHEN** 同 phone POST take 帶 `resourceId: Y`
- **THEN** 視為新票(不同號池),建立成功並回新 `ticketNumber`、`claimToken`

#### Scenario: 非 QUEUE 模式拒絕

- **GIVEN** 服務 `bookingMode=TIME_SLOT`
- **WHEN** POST take
- **THEN** 回 400 `MSG_NOT_QUEUE_SERVICE`

#### Scenario: 領號時間窗外

- **GIVEN** 當日無啟用的 QueueWindow，或當前時間在窗外
- **WHEN** POST take
- **THEN** 回 400 `MSG_QUEUE_WINDOW_CLOSED`（公開端嚴格校驗時間窗；商家代建端不套用此規則）

#### Scenario: 達當日上限（service 級總上限）

- **GIVEN** QueueWindow `maxTickets=10`、當日已發 10 張（無論散落在哪個 resource）
- **WHEN** POST take
- **THEN** 回 409 `MSG_QUEUE_FULL`（`maxTickets` 仍解釋為 service 總上限，與計畫一致）

#### Scenario: resourceId 必填／驗證錯誤回 400

- **GIVEN** service 已綁 Resource X、Y
- **WHEN** POST take 不帶 `resourceId` 或帶非該 service 的 resource
- **THEN** 回 400 `MSG_QUEUE_RESOURCE_REQUIRED` 或 `MSG_QUEUE_RESOURCE_INVALID`（見「resourceId 驗證規則」requirement）

#### Scenario: RateLimit 觸發

- **WHEN** 同 IP 1 分鐘內第 6 次 take
- **THEN** 回 429 + `Retry-After`（RateLimit 僅作用於公開端；商家代建端不套用）

#### Scenario: claimToken 為不可猜測 nanoid

- **GIVEN** 任一次拿號成功
- **WHEN** 觀察 response 中的 `claimToken`
- **THEN** 長度 8、僅由 alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz`（排除 `0/O/o/1/I/l`）組成，且與序號 / phone 無可推導關係

### Requirement: 顧客查詢票狀態

The system SHALL allow public lookup of a single queue ticket by id, returning the ticket state and current serving number for the same `(merchantId, serviceId, resourceId, ticketDate)`。回應 body SHALL 多帶 `resourceId: string | null`、`resourceName: string | null` 兩欄位，讓顧客頁顯示「請至 {resourceName}」。`currentServing` 與 `waitingAhead` SHALL 從該票對應的 `(serviceId, resourceId)` counter 計算（不混入其他 resource 的數據）。

#### Scenario: 等待頁兜底輪詢（未綁 resource）

- **GIVEN** 顧客有 ticketId、票的 resourceId=null
- **WHEN** GET `/public/queue/[id]`
- **THEN** 回 `{ ticket: { status, ticketNumber, resourceId: null, resourceName: null, ... }, currentServing, waitingAhead }`，currentServing 取自 `(s, NULL)` counter

#### Scenario: 等待頁兜底輪詢（綁 resource）

- **GIVEN** 票 resourceId=X
- **WHEN** GET
- **THEN** 回應含 `resourceId: X, resourceName: 'X'`；`currentServing` 取自 `(s, X)` counter；`waitingAhead` 為 X 上前面尚未叫到的人數

#### Scenario: 票不存在

- **WHEN** GET 未知 id
- **THEN** 回 404 `MSG_QUEUE_TICKET_NOT_FOUND`

### Requirement: 商家叫號

The system SHALL allow merchants to call the next waiting ticket for a `(serviceId, resourceId)` pair, with concurrent-safe transition WAITING → CALLED. body SHALL 接受可選 `resourceId: string | null`，必填規則沿用「resourceId 驗證規則」requirement。叫號 SHALL 在 `Serializable` 交易內以 `SELECT ... FOR UPDATE` 鎖**對應 `(s, r)`** 的 counter row（不同 resource 的 counter 為不同 row，鎖粒度天然下降；計畫檔提到的「advisory lock key `queue-call:{m}:{s}:{r ?? 'null'}`」概念由 counter row-level lock 滿足）。最小 WAITING 票 SHALL 在 where 中加 `resourceId` 過濾。廣播 payload SHALL 帶上 `resourceId` 與 `resourceName`。

#### Scenario: 叫下一號（單 resource）

- **GIVEN** 商家 token、service 綁 Resource X、X 當日有 WAITING 票（最小號碼=5）
- **WHEN** POST `/nuxt-api/queue/call-next` 帶 `{ serviceId, resourceId: X }`
- **THEN** 鎖 (s, X) counter → 找 X 上最小 WAITING 票 → 更新為 CALLED + calledAt + counter.lastCalledNumber=5；廣播 `CALL_NEXT { serviceId, resourceId: X, resourceName: 'X', current: 5, servingTicketId, timestamp, avgServiceMinutes, nextWaitMinutes }`；回該票資訊

#### Scenario: 叫下一號（未綁 resource service）

- **GIVEN** service 未綁 resource、當日有 WAITING 票
- **WHEN** POST 不帶 `resourceId`
- **THEN** 鎖 (s, NULL) counter，原行為不變；廣播 payload `resourceId: null, resourceName: undefined`

#### Scenario: 無等待中票

- **GIVEN** 對應 `(s, r)` 當日所有票皆 DONE/SKIPPED 或無票
- **WHEN** POST call-next 帶該 `resourceId`
- **THEN** 回 400 `MSG_QUEUE_NO_WAITING`（即便其他 resource 有 WAITING 票也不算）

#### Scenario: 兩員工同按（同 resource）

- **GIVEN** 兩個商家 tab 同時 POST call-next 帶相同 `resourceId=X`
- **WHEN** 兩 request 抵達後端
- **THEN** FOR UPDATE 序列化；其中一個成功進到下一號，另一個收到下下一號（或當已無 WAITING 票時收 400）；不會兩個都成功取同一號

#### Scenario: 兩員工同按（不同 resource）並行不互鎖

- **GIVEN** 員工 A 對 `(s, X)` 叫號、員工 B 對 `(s, Y)` 叫號同時抵達
- **WHEN** 兩 request 並發
- **THEN** 兩交易鎖不同 counter row，並行完成；分別取到各自 resource 的最小 WAITING 票（不互相阻塞）

#### Scenario: resourceId 必填／驗證錯誤回 400

- **GIVEN** service 綁 resource
- **WHEN** POST call-next 不帶 `resourceId` 或帶非該 service 的 resource
- **THEN** 回 400 `MSG_QUEUE_RESOURCE_REQUIRED` 或 `MSG_QUEUE_RESOURCE_INVALID`

### Requirement: 商家標記完成或過號

The system SHALL allow merchants to mark any CALLED ticket as DONE or SKIPPED by ticket id, with each operation broadcasting to subscribed peers. The merchant queue console SHALL expose per-ticket DONE/SKIP controls so that when multiple tickets are simultaneously in CALLED status, the merchant can target a specific ticket without being forced to operate on the most-recently-called one.

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

#### Scenario: 多張 CALLED 共存時可指定任一張完成

- **Given** 同一 service 當日同時存在 CALLED 票 A（ticketNumber=5）、B（ticketNumber=7）、C（ticketNumber=9）
- **When** 商家在 `/admin/queue` 對 ticket B 點「完成」
- **Then** 僅 ticket B 變 DONE、A 與 C 仍為 CALLED；廣播 `TICKET_DONE` 帶 `servingTicketId=B.id`
- **And** UI 從「服務中」區移除 B 但保留 A 與 C

#### Scenario: 多張 CALLED 共存時可指定任一張過號

- **Given** 同一 service 當日同時存在 CALLED 票 A（ticketNumber=5）、B（ticketNumber=7）
- **When** 商家對 ticket A 點「過號」並通過確認
- **Then** 僅 ticket A 變 SKIPPED、B 仍為 CALLED；廣播 `TICKET_SKIPPED`

#### Scenario: row 級 loading 不互鎖

- **Given** 商家對 ticket A 點「完成」、請求仍在進行中
- **When** 同時對 ticket B 點「完成」
- **Then** ticket B 的請求正常發起、不被 A 的 loading 阻擋；A、B 各自 row 內按鈕分別呈現 loading 狀態

### Requirement: 商家當日總覽

The system SHALL provide merchants with the day's tickets grouped by service AND by resourceId. response 結構 SHALL 以「每 service 多回 `resources` 陣列」呈現（詳見「queue/today 回 resources 陣列分群」requirement），陣列項各自帶 `counter` 與 `tickets`。未綁 resource 的 service SHALL 走 fallback `resources: [{ id: null, ... }]`。

#### Scenario: 當日總覽（多 resource）

- **GIVEN** service A 綁 X、Y；當日 X 上 3 張 ticket（其中 1 CALLED 2 WAITING）、Y 上 2 張 WAITING
- **WHEN** GET `/nuxt-api/queue/today`
- **THEN** 回 `{ services: [{ serviceId, serviceName, avgServiceMinutes, resources: [{ id: X, name, counter, tickets:[3 張] }, { id: Y, name, counter, tickets:[2 張] }] }] }`

#### Scenario: 當日總覽（未綁 resource）

- **GIVEN** service B 未綁 resource、當日有 4 張 ticket
- **WHEN** GET
- **THEN** B 物件 `resources` 為 `[{ id: null, name: null, counter, tickets:[4 張] }]`

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

The merchant queue page SHALL display the current serving tickets for each QUEUE service and provide controls to call next, mark any CALLED ticket done or skipped, register a walk-in, and filter the per-service ticket list. When a service has one or more bound active resources, the page SHALL render one sub-card per resource within the service's card area, each sub-card independently tracking its own currentServing, CALLED list, WAITING / called / history tabs, search input, call-next action, and walk-in registration action. When a service has no resources bound (or the backend returns `resources: [{ id: null, ... }]` fallback), the page SHALL render a single card preserving the existing single-card UX. The page SHALL remain usable on tablet portrait viewports (≥ 768px) for on-site touch operation.

#### Scenario: 控制台呈現（單一 service、無 resource）

- **Given** 商家當日有 QUEUE 服務 A（無綁定 resource、current=5）、服務 B（無綁定 resource、current=3）
- **When** 進入 `/admin/queue`
- **Then** 顯示兩張卡，各自呈現：
  - 卡片頂層動作：主按鈕「叫下一號」+ 次按鈕「現場登記」（共 2 顆）
  - 「服務中」區：列出該服務當前所有 status=CALLED 的票（多張時並列垂直顯示），每張掛獨立「完成 / 過號」操作
  - WAITING 列表加上狀態 tabs 與搜尋框
  - **不**顯示 segmented control「目前操作」

#### Scenario: 控制台呈現（service 綁多個 resource）

- **Given** 商家當日有 QUEUE 服務「看診」綁定 Resource A（current=5）與 Resource B（current=3）
- **When** 進入 `/admin/queue`
- **Then** 服務「看診」的卡片區內渲染兩張子卡並列，每張子卡顯示對應 resource name 標題、各自 currentServing 大字、各自 CALLED 列表、各自 WAITING / called / history tabs、各自搜尋框、各自「叫下一號」與「現場登記」按鈕
- **And** 卡片頂部出現 segmented control「目前操作」，列出兩個 resource 名稱

#### Scenario: 控制台呈現（service 綁單一 resource）

- **Given** 商家當日有 QUEUE 服務「看診」綁定唯一 Resource A
- **When** 進入 `/admin/queue`
- **Then** 服務「看診」卡片區渲染一張子卡（顯示 resource name 標題與 currentServing），**不**顯示 segmented control

#### Scenario: 自身叫號後即時更新

- **When** 在某子卡點「叫下一號」成功
- **Then** 該子卡服務中區追加新 CALLED 票、該子卡票列表移除被叫的票；同 service 其他 resource 的子卡狀態不變；其他 tab（含顧客等待頁）收到 WS 推播

#### Scenario: 卡片頂層動作層級

- **Given** 子卡渲染時
- **Then** 子卡頂層動作區只出現「叫下一號」與「現場登記」兩顆按鈕；「完成」「過號」**不出現於子卡頂層**，僅由「服務中」區內每張 CALLED row 各自掛載

#### Scenario: 服務中區無 CALLED 時的空狀態

- **Given** 某子卡對應的 (service, resource) 當日所有票皆為 WAITING/DONE/SKIPPED（無 CALLED）
- **When** 子卡渲染
- **Then** 「服務中」區顯示提示文案「目前無服務中號碼」，不出現完成/過號按鈕

#### Scenario: 狀態 tabs 切換

- **Given** 子卡內票列表
- **When** 點擊「服務中」tab
- **Then** 列表只顯示該 (service, resource) 之 status=CALLED 的票；tabs 顯示各分群計數（等待中 N / 服務中 M / 歷史 K）

#### Scenario: tabs 預設 active 為「等待中」

- **Given** 進入 `/admin/queue`
- **Then** 每張子卡的狀態 tabs 預設停在「等待中」

#### Scenario: 列表搜尋以號碼比對

- **Given** 子卡的「等待中」tab、列表中有 ticketNumber=12 的票
- **When** 在搜尋框輸入「12」
- **Then** 列表只顯示 ticketNumber 包含「12」的票（例如 12、120-129）

#### Scenario: 列表搜尋以電話末 4 碼比對

- **Given** 子卡列表中有 ticket customerPhone=0912345678
- **When** 在搜尋框輸入「5678」
- **Then** 該票被命中顯示

#### Scenario: 列表搜尋無結果

- **Given** 搜尋輸入「9999」、子卡列表內無命中
- **Then** 列表顯示空狀態「找不到符合的號碼」提示，並可一鍵清除搜尋

#### Scenario: 搜尋字串跨 tab 保留

- **Given** 在某子卡「等待中」tab 輸入搜尋「12」
- **When** 切換該子卡至「歷史」tab
- **Then** 搜尋字串仍為「12」、列表以「12」於歷史票群中過濾

#### Scenario: 列表加捲動界線

- **Given** 某子卡對應的 (service, resource) 當日票數 > 30
- **Then** 列表容器套用 `max-height` 並可內部 `overflow-y: auto` 捲動；子卡整體高度不無限拉長

#### Scenario: 平板直立 RWD

- **Given** viewport 768×1024（直立平板）
- **When** 進入 `/admin/queue`
- **Then** 卡片以 grid 顯示且不破版；子卡頂層動作按鈕觸控區 ≥ 44px；列表 row 與 CALLED 區 chip 不互相擠壓；搜尋框不換多行

#### Scenario: 桌機 RWD 子卡橫排

- **Given** viewport ≥ 1280px、某 QUEUE service 綁定 3 個 resource
- **When** 進入 `/admin/queue`
- **Then** 該 service 的三張子卡以 grid `repeat(auto-fit, minmax(360px, 1fr))` 橫排（容器寬足時 3 欄、稍窄時 2 欄）

#### Scenario: 手機 RWD 子卡垂直堆疊

- **Given** viewport < 768px、某 QUEUE service 綁定 2 個 resource
- **When** 進入 `/admin/queue`
- **Then** 兩張子卡單欄垂直堆疊；segmented control 仍可使用，超寬時可水平捲動

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

### Requirement: 顧客等待頁返回入口

`/m/{slug}/queue/status` 頁 SHALL 使用 `BizCustomerPageHeader` 渲染頁首，並設定 `backTo='/m/{slug}/queue'`，使顧客可從個別票號狀態頁回到該商家的領號列表；既有的自製「回首頁」按鈕 SHALL 由 PageHeader 返回入口取代。

#### Scenario: 票號狀態頁顯示返回入口

- **GIVEN** 顧客已領號並進入 `/m/{slug}/queue/status?id=...`
- **THEN** 頁面頂部以 `BizCustomerPageHeader` 渲染，左上顯示「← 返回」
- **WHEN** 顧客點擊返回
- **THEN** 跳轉至 `/m/{slug}/queue`

#### Scenario: WS / 輪詢不受返回入口影響

- **GIVEN** 票號狀態頁的 WebSocket 連線或 15 秒輪詢正在運行
- **WHEN** 顧客點擊返回離開該頁
- **THEN** Vue 元件 unmount 觸發既有 WS 斷線與輪詢停止邏輯（沿用 `useQueueWS` / cleanup）
- **AND** 不留下殘留連線

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

公開 `GET /nuxt-api/public/m/[slug]` SHALL 對每個 `bookingMode=QUEUE` 服務在既有頂層 `currentServing/ticketsTaken/waitingCount` 之外多回 `resources` 陣列（詳見「public/m/[slug] 回 resources 陣列分群」requirement）。未綁 resource 的 service SHALL 回單元素陣列；多 resource 時頂層欄位以合計／代表值呈現以維持向後相容。

#### Scenario: 含 counter 資訊（未綁 resource 為單元素）

- **GIVEN** 商家當日 QUEUE 服務 A 未綁 resource、已發 10 號、叫到 5 號
- **WHEN** GET `/public/m/[slug]`
- **THEN** services 內 A 物件含 `currentServing: 5`、`waitingCount: 5`、`ticketsTaken: 10`、`resources: [{ id: null, currentServing: 5, ticketsTaken: 10, waitingCount: 5, ... }]`

#### Scenario: 多 resource 為陣列

- **GIVEN** A 綁 X、Y；X 發 6 叫 3、Y 發 4 叫 2
- **WHEN** GET
- **THEN** `resources.length=2`；頂層 `ticketsTaken=10`、`waitingCount=5`、`currentServing` 為 min(3, 2)=2

#### Scenario: 當日無 counter

- **GIVEN** QUEUE 服務 B 當日無人領號
- **WHEN** GET
- **THEN** 物件含 `currentServing: 0`、`waitingCount: 0`、`ticketsTaken: 0`、`resources` 內對應 resource counter 為 `null` 並回 `currentServing: 0`

#### Scenario: 非 QUEUE 服務不含這些欄位

- **GIVEN** 服務 C 是 TIME_SLOT
- **WHEN** GET
- **THEN** C 物件**不**含 `currentServing`、`waitingCount`、`ticketsTaken`、`resources`

#### Scenario: 公開端點不需鑑權

- **WHEN** 無 token 呼叫
- **THEN** 仍正常回傳

### Requirement: 顧客端最近票紀錄自動還原

The customer queue landing page SHALL persist the most recent ticket(s) of the current day into client-side `localStorage` (key `customerQueueRecent`) and automatically prompt the customer to return to the waiting page when re-entering the page on the same device.

Stored fields per ticket: `{ slug, merchantId, ticketId, ticketNumber, ticketDate, serviceId, serviceName, phoneLast4, takenAt }`. Entries with `ticketDate !== today (merchant timezone of the device clock)` MUST be filtered out on read. The list MUST be capped at 20 entries to avoid unbounded growth.

#### Scenario: 領號後寫入 localStorage

- **GIVEN** 顧客在 `/m/[slug]/queue` 領號成功
- **WHEN** 前端收到 `{ ticketId, ticketNumber }`
- **THEN** 前端寫入 `localStorage.customerQueueRecent`（陣列 push 一筆）並導向 status 頁

#### Scenario: 重新進入領號頁時自動還原

- **GIVEN** localStorage 內有當日同 slug 的 ticket 紀錄
- **WHEN** 顧客重新進入 `/m/[slug]/queue`
- **THEN** 頁面頂端顯示「你今天已有 N 號 - 回到等待頁」橫幅，含一鍵跳轉按鈕

#### Scenario: 跨日紀錄自動失效

- **GIVEN** localStorage 內有昨日紀錄
- **WHEN** 顧客今日進入領號頁
- **THEN** 不顯示橫幅，並在讀取時將跨日紀錄從陣列移除

#### Scenario: localStorage 解析失敗自我修復

- **GIVEN** localStorage 內容已被破壞或格式不符
- **WHEN** 前端讀取
- **THEN** 不拋例外、不影響領號流程，並重置 `customerQueueRecent` 為空陣列

### Requirement: 顧客端手機末 4 碼查回票

The system SHALL provide a public endpoint `POST /nuxt-api/public/queue/find` and a customer-facing page `/m/[slug]/queue/find` to recover a customer's today ticket using `{ slug, serviceId, phoneLast4 }`, without exposing other customers' tickets or personal data.

The endpoint MUST: (a) match QueueTicket where `merchantId` belongs to `slug`, `serviceId` matches, `ticketDate = today (merchant timezone)`, `phone` ends with `phoneLast4`, **`status IN ('WAITING','CALLED')`**（只查進行中的票，避免已結束的票造成假性 ambiguous）; (b) return only `{ ticketId }` on single match; (c) NOT leak full phone, lastName, or title in any response.

#### Scenario: 單筆命中

- **GIVEN** 當日該服務只有一張**進行中**（status=WAITING 或 CALLED）的票其 phone 末 4 碼吻合
- **WHEN** POST `/nuxt-api/public/queue/find` 帶 `{ slug, serviceId, phoneLast4 }`
- **THEN** 回 `{ ticketId }`，前端導向 `/m/[slug]/queue/status?id=...`

#### Scenario: 多筆進行中命中視為模糊

- **GIVEN** 當日同服務有多張**進行中**（WAITING/CALLED）的票其 phone 末 4 碼吻合
- **WHEN** POST find
- **THEN** 回 400 `MSG_QUEUE_FIND_AMBIGUOUS`，前端提示顧客至櫃台出示手機協助核對

#### Scenario: 已結束的票不影響命中判斷

- **GIVEN** 當日有 3 張同末 4 碼的票，其中 2 張為 DONE/SKIPPED、1 張為 WAITING
- **WHEN** POST find
- **THEN** 視為單筆命中（已結束的票被排除），回 `{ ticketId }` 為 WAITING 那張

#### Scenario: 無命中

- **GIVEN** 當日無進行中的票符合（或所有同末 4 碼的票皆已結束）
- **WHEN** POST find
- **THEN** 回 404 `MSG_QUEUE_FIND_NOT_FOUND`

#### Scenario: 非數字輸入

- **WHEN** POST find 帶 `phoneLast4 = "abcd"` 或長度非 4
- **THEN** 回 400 `MSG_QUEUE_FIND_INVALID`

#### Scenario: RateLimit 防猜

- **WHEN** 同 IP 1 分鐘內第 6 次 POST find
- **THEN** 回 429 + `Retry-After`

#### Scenario: 失敗過多臨時鎖

- **GIVEN** 同 IP 連續 10 次得到 `NOT_FOUND` 或 `INVALID`
- **WHEN** 第 11 次 POST find
- **THEN** 在 5 分鐘內回 429，提示稍後再試

#### Scenario: 回應不洩漏完整資料

- **GIVEN** 任意 find 結果（命中或模糊或無）
- **WHEN** 顧客拿到 response
- **THEN** body 內絕不包含 `phone`、`lastName`、`title` 任一欄位

### Requirement: 顧客端全螢幕叫號蓋層

When the customer's own ticket transitions to `CALLED`, the waiting page SHALL display a full-viewport overlay with high-contrast colour, oversized ticket number, and an i18n-aware primary message indicating that the customer is being called. The overlay MUST be reachable on viewport widths down to 320px without horizontal overflow.

#### Scenario: 進入 CALLED 觸發蓋層

- **GIVEN** 顧客在 `/m/[slug]/queue/status` 等待，自己的票 `status=WAITING`
- **WHEN** 商家叫到自己的號碼（透過 WS `CALL_NEXT` 或 15s 輪詢推進 `currentServing`）
- **THEN** status 頁立即覆蓋全螢幕蓋層，主訊息顯示「該你了 / It's your turn / あなたの番です」、副訊息「請至櫃台」、號碼字級至少 viewport 短邊的 40%

#### Scenario: 蓋層含 dismiss 按鈕

- **GIVEN** 蓋層已顯示
- **WHEN** 顧客點「我知道了」
- **THEN** 蓋層隱藏，底層 status 頁仍顯示完整資訊；ticket 狀態仍為 CALLED

#### Scenario: DONE/SKIPPED 自動退出

- **GIVEN** 蓋層顯示中
- **WHEN** 後端推播 `TICKET_DONE` 或 `TICKET_SKIPPED`
- **THEN** 蓋層自動消失並顯示對應收尾畫面

#### Scenario: 動畫不無限刺激

- **GIVEN** 蓋層出現
- **WHEN** 載入背景脈動動畫
- **THEN** 動畫最多執行 3 個循環後停止；背景色保持靜態高對比

#### Scenario: prefers-reduced-motion 降級

- **GIVEN** 裝置設定 `prefers-reduced-motion: reduce`
- **WHEN** 蓋層出現
- **THEN** 不執行脈動動畫，僅保留靜態高對比配色

#### Scenario: 320px 不溢出

- **GIVEN** 螢幕寬度 320px
- **WHEN** 蓋層渲染含三語訊息
- **THEN** 主訊息與副訊息皆不發生水平溢出（必要時自動換行或縮小字級）

### Requirement: 顧客端被叫號時更新分頁標題

While the customer's ticket is in `CALLED` state, the document title SHALL be prefixed with an attention marker so that a browser tab in the background is visually distinguishable.

#### Scenario: 進入 CALLED 改 title

- **GIVEN** 顧客票 status=CALLED
- **WHEN** Vue 渲染完成
- **THEN** `document.title` 為 `🔔 該你了 - {serviceName} - 您的號碼 {N}`（三語各自的格式）

#### Scenario: 離開 CALLED 還原 title

- **GIVEN** title 含鈴鐺前綴
- **WHEN** ticket 變為 DONE 或 SKIPPED 或顧客離開頁面
- **THEN** title 恢復為等待頁原 title

### Requirement: 顧客端等待進度視覺化

The waiting page SHALL render a four-segment visual progress indicator showing `start → currentServing → myNumber → totalTaken`, with a label exposing how many people are ahead of the customer.

#### Scenario: 正常等待呈現

- **GIVEN** `myNumber=8`、`currentServing=5`、`totalTaken=10`
- **WHEN** 渲染進度條
- **THEN** 進度條顯示四個節點、目前叫號指示器位於 5、自己的指示器位於 8、徽章顯示「前面還有 2 位」

#### Scenario: 尚未開始叫號

- **GIVEN** `currentServing=0`
- **WHEN** 渲染進度條
- **THEN** 顯示「尚未開始叫號」標籤，目前叫號指示器置於起點

#### Scenario: 自己已過號

- **GIVEN** `myNumber=3`、`currentServing=5`、且自身 status 不是 CALLED
- **WHEN** 渲染進度條
- **THEN** 自己的指示器顯示為「已過號」樣式，並提示「您的號碼已過、請聯絡店家或重新領號」

#### Scenario: 推進動畫

- **GIVEN** `currentServing` 由 4 變為 5
- **WHEN** 前端收到推播
- **THEN** 目前叫號指示器以 ≤ 0.8 秒平滑過渡到新位置

### Requirement: 顧客端連線狀態四態反饋

The customer waiting page SHALL surface one of four explicit connection states — `live`, `reconnecting`, `fallback`, `offline` — each with a distinct, accessible visual. Transitions between states MUST be debounced by at least 1.5 seconds to prevent UI flicker on transient network blips.

#### Scenario: live 狀態

- **GIVEN** WS 已成功連線
- **THEN** 顯示細條綠色提示「即時更新中」

#### Scenario: reconnecting 倒數

- **GIVEN** WS 剛斷線
- **WHEN** 等待重連
- **THEN** 顯示橙色 banner「連線中斷，N 秒後重試」、N 每秒遞減；含「立即重試」按鈕

#### Scenario: fallback 提示

- **GIVEN** WS 重連連續失敗 3 次
- **WHEN** 仍透過 15s 輪詢取得更新
- **THEN** 顯示灰色 banner「即時連線不穩，仍會自動更新」

#### Scenario: offline 偵測

- **GIVEN** `navigator.onLine === false`
- **THEN** 顯示紅色 banner「裝置目前離線」，覆蓋其他連線狀態

#### Scenario: 短瞬斷不抖動

- **GIVEN** WS 斷線 500 毫秒後自動重連成功
- **WHEN** UI 處理
- **THEN** UI 不切換到 reconnecting，仍維持 live（受 debounce 保護）

#### Scenario: 手動立即重試

- **GIVEN** 處於 reconnecting 或 fallback 狀態
- **WHEN** 顧客點「立即重試」
- **THEN** 前端立即關閉舊 WS 並重新嘗試連線一次

### Requirement: 顧客端完成與跳號收尾畫面

When the customer's ticket reaches `DONE` or `SKIPPED`, the waiting page SHALL display a dedicated closing screen with an explicit status indicator and at least one clear call-to-action.

#### Scenario: DONE 收尾畫面

- **GIVEN** 顧客票 status=DONE
- **WHEN** 渲染 status 頁
- **THEN** 顯示綠色勾選圖示、訊息「服務完成，謝謝您」、CTA「回首頁」與「重新領號」

#### Scenario: SKIPPED 收尾畫面

- **GIVEN** 顧客票 status=SKIPPED
- **WHEN** 渲染 status 頁
- **THEN** 顯示橙色提示圖示、訊息「您的號碼已被跳過」、CTA「重新領號」「聯絡店家」

#### Scenario: 收尾畫面停用 WS 蓋層

- **GIVEN** DONE 或 SKIPPED 顯示中
- **WHEN** WS 因為後續其他票推播而變動
- **THEN** 不再彈出叫號蓋層（蓋層僅綁定自己的 CALLED）

### Requirement: 顧客端號碼牌 i18n 完整三語覆蓋

All customer-facing text introduced or modified in this change SHALL exist in `zh`, `en`, and `ja` locale files under the `queue.page.*` namespace. Layouts MUST not break for any locale at viewport widths down to 320px.

#### Scenario: 三語 key 齊備

- **WHEN** 啟動應用並切換語系
- **THEN** 所有新文案 key 在 `zh / en / ja` 三檔皆有對應字串，無回退到 key 名稱的情形

#### Scenario: 全螢幕叫號三語不溢出

- **GIVEN** 320px 寬度螢幕
- **WHEN** 分別以 zh / en / ja 渲染全螢幕叫號蓋層
- **THEN** 主訊息與副訊息均不水平溢出

### Requirement: 商家現場代客領號

The system SHALL provide an authenticated endpoint `POST /nuxt-api/queue/create-for-customer` that allows a logged-in merchant to create a QueueTicket on behalf of a walk-in customer for one of the merchant's own QUEUE-mode services, optionally targeting a specific `resourceId`. body SHALL 接受可選 `resourceId: string | null`，必填規則沿用「resourceId 驗證規則」requirement。端點 SHALL 共用 `internalCreateTicket` 並沿襲既有放寬規則（`customerPhone` 選填、QueueWindow 時段窗檢查放寬）。成功回應 SHALL 額外包含 `claimToken: string` 及（若 service 已綁 resource）`resourceId / resourceName`，並廣播 `TICKET_TAKEN { resourceId, resourceName, ... }`。

#### Scenario: 商家代建成功（含電話、含 resource）

- **GIVEN** 商家已登入、service 綁 Resource X、`maxTickets` 未達
- **WHEN** 商家 POST 帶 `{ serviceId, lastName, title, phone, resourceId: X }`
- **THEN** 透過共用 `internalCreateTicket` 在 `(s, X)` 鎖 counter 自增號碼，寫入 ticket（`createdByMerchant=true`、`resourceId=X`、`claimToken=<nanoid>`），回 `{ ticketId, ticketNumber, ticketDate, currentServing, claimToken, resourceId, resourceName }`，並廣播 `TICKET_TAKEN`

#### Scenario: 商家代建成功（不留電話、含 resource）

- **GIVEN** service 綁 resource
- **WHEN** POST 帶 `{ serviceId, lastName, title, resourceId: X }`（無 `phone`）
- **THEN** 票券寫入時 `customerPhone=null`、`createdByMerchant=true`、`claimToken=<nanoid>`、`resourceId=X`，回號碼與 `claimToken`；廣播 `TICKET_TAKEN`

#### Scenario: 商家代建成功（未綁 resource service）

- **GIVEN** service 未綁 resource
- **WHEN** POST 不帶 `resourceId`
- **THEN** `resourceId=null` 寫入；行為與舊版完全一致

#### Scenario: 跳過 QueueWindow 時間窗校驗

- **GIVEN** service 當日 QueueWindow 啟用但當前時間在窗外
- **WHEN** 商家 POST create-for-customer
- **THEN** **不**回 `MSG_QUEUE_WINDOW_CLOSED`，照常建票，仍回 `claimToken`

#### Scenario: QueueWindow 全空仍視為關閉

- **GIVEN** 服務當日無任何 QueueWindow 設定
- **WHEN** POST create-for-customer
- **THEN** 回 400 `MSG_QUEUE_WINDOW_CLOSED`

#### Scenario: 達當日上限拒絕

- **GIVEN** 當日 counter 已達 `maxTickets`（service 總上限）
- **WHEN** POST create-for-customer
- **THEN** 回 409 `MSG_QUEUE_FULL`

#### Scenario: 非 QUEUE 模式拒絕

- **GIVEN** 服務 `bookingMode != QUEUE`
- **WHEN** 商家 POST create-for-customer
- **THEN** 回 400 `MSG_NOT_QUEUE_SERVICE`

#### Scenario: 跨商家越權

- **GIVEN** 商家 A 已登入、`serviceId` 屬於商家 B
- **WHEN** 商家 A POST create-for-customer
- **THEN** 回 404 `MSG_SERVICE_NOT_FOUND`

#### Scenario: 未登入拒絕

- **GIVEN** 無 token 或 token 無效
- **WHEN** POST create-for-customer
- **THEN** `requireMerchant` 守衛回 401

#### Scenario: 同人同日重複領號（同 resource，有電話時仍套用）

- **GIVEN** 商家代建時帶 `phone`，且同 `(service, resourceId)` 當日已有同 phone、status=WAITING 的票
- **WHEN** POST create-for-customer 帶相同 `phone` 與 `resourceId`
- **THEN** 回 409 `MSG_QUEUE_ALREADY_TAKEN`

#### Scenario: 同人同日不同 resource 允許各自一張

- **GIVEN** 同 phone 在 Resource X 已有 WAITING 票
- **WHEN** 商家為其在 Resource Y 補建
- **THEN** 視為新票，建立成功（與顧客拿號規則一致）

#### Scenario: 不留電話不套用重複領號規則

- **GIVEN** 商家代建未帶 `phone`、當日已有多張 `customerPhone=null` 的票
- **WHEN** POST 不帶 `phone`
- **THEN** 正常建立新票，每張新票仍各自獲得獨立 `claimToken`

#### Scenario: 兩員工同時代建編號不重複（同 resource）

- **GIVEN** 同商家兩 admin tab、同 `(service, resource)` 當前 lastTicketNumber=5
- **WHEN** 兩 request 幾乎同時 POST create-for-customer 帶相同 `resourceId`
- **THEN** 共用 `internalCreateTicket` 內 `FOR UPDATE` 序列化兩交易，分別得到號碼 6 與 7

#### Scenario: 公開端與商家端號碼共用同一序號池（同 resource）

- **GIVEN** Resource X 當前 lastTicketNumber=5
- **WHEN** 一個顧客 POST take 與一個商家 POST create-for-customer 同時抵達、皆帶 `resourceId=X`
- **THEN** 兩條路徑共用同一 `(s, X)` QueueCounter，分別拿到 6 與 7

#### Scenario: resourceId 驗證錯誤

- **WHEN** POST 不符合「resourceId 驗證規則」
- **THEN** 回 400 `MSG_QUEUE_RESOURCE_REQUIRED` / `MSG_QUEUE_RESOURCE_INVALID`

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

The number assignment, advisory lock, unique-key collision handling, `claimToken` generation, and `TICKET_TAKEN` broadcast SHALL be encapsulated in a single function `internalCreateTicket` exported from `server/utils/queue.ts`. 其 input 型別 SHALL 包含 `resourceId: string | null` 屬性（明確必填、值可為 `null`）；upsert / `SELECT ... FOR UPDATE` / `prisma.queueTicket.create` 都 SHALL 帶上 `resourceId`，使「同人同日」精檢與「當日上限」概念可分別套用（重複領號規則加 `resourceId` 過濾；`maxTickets` 仍為 service 總上限不分群）。其餘 nanoid alphabet / `Serializable` 交易 / P2002 重試一次 規則沿用既有設計。route handler 與其他位置不得自行重新撰寫 counter 鎖、ticket insertion 或 claimToken 生成。

#### Scenario: 公開端委派共用函式（帶 resourceId）

- **GIVEN** `take.post.ts` 通過 RateLimit / QueueWindow / `bookingMode=QUEUE` / resourceId 驗證 / 同人同日校驗
- **WHEN** 進入建票階段
- **THEN** 呼叫 `internalCreateTicket({ ..., resourceId })`，不在 handler 內直接寫 `prisma.queueCounter.update`、`prisma.queueTicket.create` 或 `nanoid` 生成 token

#### Scenario: 商家端委派共用函式（帶 resourceId）

- **GIVEN** `create-for-customer.post.ts` 通過 `requireMerchant` / ownership / resourceId 驗證 / `bookingMode=QUEUE` / `maxTickets` 校驗
- **WHEN** 進入建票階段
- **THEN** 呼叫同一 `internalCreateTicket({ ..., resourceId })`，不複製 Counter 鎖或 token 生成

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
- **THEN** 整個交易回滾並以全新 token 重試一次

#### Scenario: 共用函式回傳 claimToken 與 resourceId

- **GIVEN** `internalCreateTicket` 成功
- **WHEN** 呼叫端解構回傳
- **THEN** `result.ticket` 上包含 `claimToken: string`、`resourceId: string | null`（與 input 對齊；呼叫端直接放入 response body）

### Requirement: Service 平均服務時長設定

`Service` SHALL 新增可選欄位 `avgServiceMinutes Int?`，代表該服務每位顧客的平均處理分鐘數，僅用於號碼牌等待時間預估顯示。為 `null` 時，應用層 SHALL fallback 至既有 `durationMinutes`。本欄位只對 `bookingMode=QUEUE` 服務在 admin UI 顯示與寫入；其他模式忽略。

#### Scenario: 商家未設定時沿用服務時長

- **GIVEN** 服務 A 的 `avgServiceMinutes=null`、`durationMinutes=30`
- **WHEN** 後端計算該服務 ETA effective avg
- **THEN** effective avg = 30

#### Scenario: 商家明確設定後使用該值

- **GIVEN** 服務 A 的 `avgServiceMinutes=15`、`durationMinutes=30`
- **WHEN** 後端計算該服務 ETA effective avg
- **THEN** effective avg = 15

#### Scenario: 商家後台編輯介面

- **GIVEN** 商家已登入、編輯一個 `bookingMode=QUEUE` 服務
- **WHEN** 開啟服務編輯表單
- **THEN** 表單顯示「平均服務時長（分鐘）」欄位、placeholder 提示「留空自動沿用服務時長」、可留空、輸入需為非負整數

#### Scenario: 留空送出 = null

- **GIVEN** 商家在編輯介面清空 `avgServiceMinutes` 欄位
- **WHEN** PUT/POST 服務
- **THEN** 後端寫入 `avgServiceMinutes=null`，不寫入 0 或預設值

#### Scenario: 非 QUEUE 服務不顯示欄位

- **GIVEN** 商家編輯 `bookingMode=TIME_SLOT` 或 `RESOURCE_OPTIONAL` 服務
- **WHEN** 開啟服務編輯表單
- **THEN** 表單不顯示 `avgServiceMinutes` 欄位（避免誤用）

#### Scenario: Migration 不影響既有資料

- **GIVEN** migration 套用前已存在多個 Service 記錄
- **WHEN** migration 套用後
- **THEN** 所有既有 Service 的 `avgServiceMinutes=NULL`，行為 fallback 至 `durationMinutes`，不改變既有商家設定與既有顧客體驗

### Requirement: ETA 純函式

`server/utils/queue.ts`（或共用 `shared/queue-eta.ts`）SHALL 匯出兩支純函式 `getTicketsAhead` 與 `estimateWaitMinutes`，集中 ETA 計算邏輯，並提供 Vitest 單元測試覆蓋。route handler 與前端 store 不得自行重新實作演算法，必須委派這兩支函式。

```
getTicketsAhead(ticket: { ticketNumber: number; status: 'WAITING' | 'CALLED' | 'DONE' | 'SKIPPED' }, counter: { lastCalledNumber: number }): number
estimateWaitMinutes(waitingAhead: number, avgServiceMinutes: number): number
```

#### Scenario: 票面前無人

- **GIVEN** ticket `{ ticketNumber: 6, status: 'WAITING' }`、counter `{ lastCalledNumber: 5 }`
- **WHEN** 呼叫 `getTicketsAhead(ticket, counter)`
- **THEN** 回 0

#### Scenario: 票面前還有 N 人

- **GIVEN** ticket `{ ticketNumber: 8, status: 'WAITING' }`、counter `{ lastCalledNumber: 5 }`
- **WHEN** 呼叫 `getTicketsAhead(ticket, counter)`
- **THEN** 回 2（不含自己；不含目前服務中的那一號）

#### Scenario: 票已被叫到視為前無人

- **GIVEN** ticket `{ ticketNumber: 5, status: 'CALLED' }`、counter `{ lastCalledNumber: 5 }`
- **WHEN** 呼叫 `getTicketsAhead(ticket, counter)`
- **THEN** 回 0

#### Scenario: 票已完成/跳號視為前無人

- **GIVEN** ticket `{ ticketNumber: 3, status: 'DONE' }` 或 `'SKIPPED'`、任意 counter
- **WHEN** 呼叫 `getTicketsAhead(ticket, counter)`
- **THEN** 回 0

#### Scenario: 尚未開始叫號

- **GIVEN** ticket `{ ticketNumber: 3, status: 'WAITING' }`、counter `{ lastCalledNumber: 0 }`
- **WHEN** 呼叫 `getTicketsAhead(ticket, counter)`
- **THEN** 回 2（自己前面還有兩位 1、2 號，不含自己）

#### Scenario: 平均時長為 0 / 負數視為 0

- **GIVEN** `avgServiceMinutes=0` 或負數
- **WHEN** 呼叫 `estimateWaitMinutes(waitingAhead=3, avgServiceMinutes=0)`
- **THEN** 回 0（不傳遞 NaN/負值到 UI）

#### Scenario: 線性估算

- **GIVEN** 前面 3 人、每人 15 分鐘
- **WHEN** 呼叫 `estimateWaitMinutes(3, 15)`
- **THEN** 回 45

#### Scenario: 等待人數 0

- **GIVEN** `waitingAhead=0`、任意 avg
- **WHEN** 呼叫 `estimateWaitMinutes(0, 15)`
- **THEN** 回 0

#### Scenario: 結果四捨五入為整數

- **GIVEN** `waitingAhead=3`、`avgServiceMinutes=2.4`（理論上 7.2）
- **WHEN** 呼叫
- **THEN** 回 7（透過 `Math.round`）

### Requirement: 顧客查票回傳 ETA

`GET /nuxt-api/public/queue/[id]` SHALL 在回應 body 多回 `estimatedWaitMinutes: number | null` 欄位，由後端對該票執行 `estimateWaitMinutes(getTicketsAhead(ticket, counter), effectiveAvg)` 計算得出，counter 取自 `(serviceId, ticket.resourceId, ticketDate)` 對應 row（按 resource 分群）。`effectiveAvg = service.avgServiceMinutes ?? service.durationMinutes`。

#### Scenario: 等待中票（單 resource）

- **GIVEN** ticket WAITING、resourceId=X、票號 8、(s, X).counter.lastCalledNumber=5、service.avgServiceMinutes=10
- **WHEN** GET `/public/queue/[id]`
- **THEN** 回應 body 含 `estimatedWaitMinutes: 20`、`resourceId: X, resourceName: 'X'`

#### Scenario: 等待中票（未綁 resource）

- **GIVEN** ticket resourceId=null、其餘同上
- **WHEN** GET
- **THEN** 從 `(s, NULL)` counter 計算，`estimatedWaitMinutes: 20`、`resourceId: null`

#### Scenario: CALLED 票

- **GIVEN** ticket status=CALLED
- **WHEN** GET
- **THEN** `estimatedWaitMinutes: 0`

#### Scenario: DONE/SKIPPED 票

- **GIVEN** ticket status=DONE 或 SKIPPED
- **WHEN** GET
- **THEN** `estimatedWaitMinutes: 0`

#### Scenario: counter 不存在

- **GIVEN** ticket 存在但對應 `(s, r)` 當日 counter 不存在
- **WHEN** GET
- **THEN** `estimatedWaitMinutes: null`

#### Scenario: avgServiceMinutes 為 null 時 fallback

- **GIVEN** service.avgServiceMinutes=null、service.durationMinutes=20、ticket 在 X 上前面 2 人
- **WHEN** GET
- **THEN** `estimatedWaitMinutes: 40`

### Requirement: 公開查詢領號頁回傳下一位 ETA

`GET /nuxt-api/public/m/[slug]` SHALL 對每個 `bookingMode=QUEUE` 服務在 `resources` 陣列中**每個項**多回 `estimatedNextCallMinutes: number | null`，代表「該 resource 下一位等待中的人預計要等多久才被叫到」。計算方法為 `estimateWaitMinutes(max(0, resource.waitingCount - 1), effectiveAvg)` 或 0。頂層 `estimatedNextCallMinutes` SHALL 為 `resources` 中所有非 null 值的最小值（無人等候則 0；無 counter 則 null）。

#### Scenario: 含 ETA 欄位（單 resource）

- **GIVEN** QUEUE 服務 A 未綁 resource、ticketsTaken=10、currentServing=5、avgServiceMinutes=10
- **WHEN** GET `/public/m/[slug]`
- **THEN** A 物件頂層 `estimatedNextCallMinutes: 40`，`resources[0].estimatedNextCallMinutes: 40`

#### Scenario: 含 ETA 欄位（多 resource）

- **GIVEN** A 綁 X、Y；X waitingCount=5 avg=10、Y waitingCount=2 avg=10
- **WHEN** GET
- **THEN** `resources` 各自 `estimatedNextCallMinutes` 為 40 與 10；頂層 `estimatedNextCallMinutes=10`（最小值）

#### Scenario: 無等待

- **GIVEN** QUEUE 服務 X.waitingCount=0
- **WHEN** GET
- **THEN** `resources` 內 X 的 `estimatedNextCallMinutes: 0`

#### Scenario: 無 counter

- **GIVEN** 服務當日無任何 counter
- **WHEN** GET
- **THEN** 所有 `estimatedNextCallMinutes: null`

#### Scenario: 非 QUEUE 服務不含欄位

- **GIVEN** 服務 C 為 TIME_SLOT
- **WHEN** GET
- **THEN** C 物件不含 `estimatedNextCallMinutes` 或 `resources`

### Requirement: 商家當日總覽回傳 ETA

`GET /nuxt-api/queue/today` SHALL 在每張 `WAITING` 票多回 `estimatedWaitMinutes: number | null`，由後端以該票對應 `(s, ticket.resourceId)` 的 counter 與 service avg 計算（按 resource 分群）。`CALLED/DONE/SKIPPED` 票回 0 或 null（依純函式語意）。response 對每個 service 仍回該服務的 `avgServiceMinutes: number`（effective 值，含 fallback），用於前端校準。

#### Scenario: WAITING 票含 ETA（單 resource）

- **GIVEN** service A 綁 X、X 有 3 張 WAITING（票號 6/7/8）、X.counter.lastCalledNumber=5、avgServiceMinutes=10
- **WHEN** GET `/queue/today`
- **THEN** 三張票分別含 `estimatedWaitMinutes: 0, 10, 20`，均按 X 的 counter 計算

#### Scenario: WAITING 票含 ETA（多 resource 不混算）

- **GIVEN** service A 綁 X、Y；X.lastCalledNumber=5（票 6 在等）、Y.lastCalledNumber=2（票 3 在等）
- **WHEN** GET
- **THEN** X 上的 ticket 6 `estimatedWaitMinutes=0`，Y 上的 ticket 3 `estimatedWaitMinutes=0`（各自按各自 counter，不交叉）

#### Scenario: response 含 service 層級 avg

- **GIVEN** service A avgServiceMinutes=10
- **WHEN** GET
- **THEN** services A 物件含 `avgServiceMinutes: 10`

#### Scenario: service 未設定時為 fallback 值

- **GIVEN** service B avgServiceMinutes=null、durationMinutes=20
- **WHEN** GET
- **THEN** services B 物件含 `avgServiceMinutes: 20`

### Requirement: WebSocket 廣播 payload 含 ETA 推進依據

`QueueBroadcastPayload` SHALL 在既有欄位之外多帶 `avgServiceMinutes?: number`、`nextWaitMinutes?: number | null`、`resourceId?: string | null` 與 `resourceName?: string`。所有呼叫 `broadcastQueue` 的端點（`take`、`call-next`、`done`、`skip`、`create-for-customer`）SHALL 帶上這四個欄位，讓所有訂閱端可即時推進 UI ETA 並按 `(serviceId, resourceId)` 分群匹配事件。`nextWaitMinutes` SHALL 計算自該事件所屬 `(s, resourceId)` 的最新 counter 與該 resource 上的 WAITING 票數，不混入其他 resource。

#### Scenario: 叫號廣播帶 ETA 與 resource

- **GIVEN** 商家叫號成功、service A 綁 X、X.avgServiceMinutes=10、叫號後 X.currentServing=5、X 上剩 4 張 WAITING
- **WHEN** `broadcastQueue` 廣播 `CALL_NEXT`
- **THEN** payload 含 `resourceId: X, resourceName: 'X', avgServiceMinutes: 10, nextWaitMinutes: 30`

#### Scenario: 領號廣播帶 ETA 與 resource

- **GIVEN** 顧客領號成功在 Resource X、X.avgServiceMinutes=10、領號後 X.ticketsTaken=10、X.currentServing=5
- **WHEN** `broadcastQueue` 廣播 `TICKET_TAKEN`
- **THEN** payload 含 `resourceId: X, resourceName: 'X', avgServiceMinutes: 10, nextWaitMinutes: 40`

#### Scenario: 完成/跳號廣播帶 resource

- **WHEN** `broadcastQueue` 廣播 `TICKET_DONE` 或 `TICKET_SKIPPED`
- **THEN** payload 帶 `resourceId` 與 `resourceName`（從 ticket 反查）；`nextWaitMinutes` 為該事件後該 resource 的最新值

#### Scenario: 未綁 resource 的 service 廣播

- **GIVEN** service 未綁 resource
- **WHEN** 任一 queue 事件廣播
- **THEN** payload `resourceId: null`、`resourceName` 缺省；訂閱端以 null 作為單號池識別

#### Scenario: 舊版前端忽略新欄位

- **GIVEN** 前端 store 未升級
- **WHEN** 收到含 `resourceId / resourceName` 的 payload
- **THEN** TypeScript optional 欄位、JSON 額外 key 不破壞既有解析；前端僅顯示既有資訊

### Requirement: 顧客等待頁顯示 ETA

`/m/[slug]/queue/status` 頁 SHALL 在票券資訊區塊顯示「您前面還有 {ahead} 位 ・ 預估還需 {minutes} 分鐘」雙資訊，並隨 WS 推播或 15 秒輪詢即時更新。當前面已無人但自己尚未 CALLED 時 SHALL 顯示「即將輪到您」；無法估算（counter 為 null）時 SHALL 顯示「預估時間尚無法計算」。文案 SHALL 取自三語 i18n key 而非硬編碼字串。

#### Scenario: 正常等待

- **GIVEN** 顧客票號 8、currentServing=5、estimatedWaitMinutes=20
- **WHEN** 渲染 status 頁
- **THEN** 顯示「您前面還有 2 位 ・ 預估還需 20 分鐘」

#### Scenario: 即將輪到

- **GIVEN** 顧客票號 6、currentServing=5、status=WAITING、estimatedWaitMinutes=0
- **WHEN** 渲染
- **THEN** 顯示「即將輪到您」（不顯示分鐘）

#### Scenario: WS 推播後即時更新 ETA

- **GIVEN** 顧客在 status 頁、顯示「預估還需 20 分鐘」
- **WHEN** 商家叫下一號（WS 推播 `CALL_NEXT` 含 `avgServiceMinutes`）
- **THEN** 顯示「預估還需 10 分鐘」，不需重新打 API

#### Scenario: 自己被叫到

- **GIVEN** 顧客票號 5、商家叫到 5 號
- **WHEN** WS 推播或輪詢偵測
- **THEN** ETA 區塊由叫號蓋層 / CALLED 收尾畫面取代（既有行為）

#### Scenario: 無法估算

- **GIVEN** ticket 對應 counter 不存在或 estimatedWaitMinutes=null
- **WHEN** 渲染
- **THEN** 顯示 i18n key `queue.eta.unknown` 的文案，不顯示假數字

#### Scenario: 三語覆蓋

- **WHEN** 切換語系 zh / en / ja
- **THEN** 所有 ETA 文案 key (`queue.eta.aheadOfYou`、`queue.eta.estimateMinutes`、`queue.eta.almostYourTurn`、`queue.eta.unknown`) 三檔皆有對應字串，無回退到 key 名稱

### Requirement: 商家叫號頁顯示每張票 ETA

`/admin/queue` 頁 SHALL 對每張 WAITING 票顯示「約 {minutes} 分鐘後」徽章。徽章 SHALL 隨自身叫號操作或 WS 推播即時推進。

#### Scenario: WAITING 票顯示 ETA

- **GIVEN** 商家當日 service A 有三張 WAITING（票號 6/7/8）、avgServiceMinutes=10、currentServing=5
- **WHEN** 進入 `/admin/queue`
- **THEN** 三張票分別顯示「約 0 分鐘後」「約 10 分鐘後」「約 20 分鐘後」

#### Scenario: 叫號後即時推進

- **GIVEN** admin 頁顯示三張 WAITING
- **WHEN** 商家按「下一號」、6 號變為 CALLED
- **THEN** 7、8 號的徽章分別更新為「約 0 分鐘後」「約 10 分鐘後」

#### Scenario: 無 avgServiceMinutes 商家設定時 fallback

- **GIVEN** service.avgServiceMinutes=null、durationMinutes=30
- **WHEN** 渲染 admin 頁
- **THEN** ETA 以 30 分鐘為單位計算並顯示

#### Scenario: CALLED 票不顯示 ETA

- **GIVEN** 票 status=CALLED
- **WHEN** 渲染
- **THEN** 不顯示「約 N 分鐘後」徽章（改顯示既有 CALLED 標記）

### Requirement: 店面大螢幕公開顯示頁

The system SHALL provide a public, full-screen queue display page at `/m/{slug}/display` for in-store TV / tablet projection, showing the currently-served number, next ticket, ticket-after-next, total waiting count, and estimated wait time, without requiring authentication and without introducing new backend endpoints. The page SHALL reuse the existing public merchant snapshot endpoint (`/nuxt-api/public/m/{slug}`) for initial state and the existing `StoreQueueRealtime` WebSocket + polling stream for live updates.

當該 service 綁定 `resources.length >= 2` 時，主畫面 SHALL 以「**多診間多欄**」版型呈現（見 `店面大螢幕多 resource 分區顯示` requirement 的補強版）；當該 service 未綁 resource 或只綁一個時，沿用本 change 前的「單一全螢幕」版型。**對未啟用 Provider 制商家而言，多診間多欄版型只多渲染 resource name 欄頂、不渲染 Provider 副標**，行為與本 change 前完全一致。

#### Scenario: 公開存取顯示頁

- **GIVEN** 商家 status=ACTIVE、有至少一個 `bookingMode=QUEUE` 的服務
- **WHEN** 任何裝置（無 cookie / token）瀏覽 `/m/{slug}/display`
- **THEN** 頁面以全螢幕模式渲染，無 header 與 footer chrome；版型依 active service 的 `resources.length` 自動切換為單欄或多欄

#### Scenario: 商家停用或暫停

- **GIVEN** 商家 status≠ACTIVE 或 slug 不存在
- **WHEN** 瀏覽 `/m/{slug}/display`
- **THEN** 沿用 `/m/{slug}` 公開頁的相同錯誤行為（404 或停用提示頁），不額外開放資料

#### Scenario: 無 QUEUE 服務

- **GIVEN** 商家所有服務皆 `bookingMode=TIME_SLOT`
- **WHEN** 瀏覽 display 頁
- **THEN** 畫面顯示 `display.noService`「目前無服務開放」訊息，不渲染叫號區塊

#### Scenario: 當日結束所有號碼

- **GIVEN** 當日 WAITING 票數=0、所有票皆 DONE/SKIPPED
- **WHEN** 瀏覽 display 頁
- **THEN** 各欄顯示 `display.allDone`「今日已完成所有號碼」；等待人數=0、預估等待=0

#### Scenario: 未啟用 Provider 制多欄版型保持現狀

- **GIVEN** `Merchant.providerModeEnabled=false`；service 綁 A、B、C 三 resource
- **WHEN** 瀏覽 display 頁
- **THEN** 渲染三欄版型，每欄頂部顯示 resource name（如「A 診間」），**不**渲染 Provider 副標；其餘行為與本 change 前完全一致

### Requirement: 即時更新與 CALL_NEXT 動畫

The system SHALL update the display page within 1 second of a `CALL_NEXT` / `TICKET_TAKEN` / `TICKET_DONE` / `TICKET_SKIPPED` broadcast from the existing queue WebSocket, by subscribing through `StoreQueueRealtime`. When the `currentServing` number transitions to a new value, the display page SHALL play a short visual animation (CSS keyframes, ≤ 0.6 second) to draw attention.

#### Scenario: 商家叫號後即時更新

- **GIVEN** display 頁已 mounted、`StoreQueueRealtime` 已 Connect 該 merchantId
- **WHEN** 商家從另一個 tab 觸發 `POST /nuxt-api/queue/call-next` 成功
- **THEN** display 頁在 1 秒內將「目前叫號」更新為新號碼，並播放一次 ≤ 0.6 秒的縮放/顏色動畫

#### Scenario: 顧客拿號後等待人數更新

- **GIVEN** display 頁顯示等待人數=3
- **WHEN** 顧客成功 `POST /public/queue/take` 拿到新號碼
- **THEN** display 頁在 1 秒內將等待人數更新為 4，「再下一位」號碼隨之更新；不播放叫號動畫

#### Scenario: WS 斷線時 fallback 輪詢

- **GIVEN** display 頁開啟、WS 因網路抖動斷線進入 `fallback` 狀態
- **WHEN** 商家在斷線期間叫號
- **THEN** display 頁依靠 `StoreQueueRealtime` 既有 15 秒輪詢更新「目前叫號」（最差 15 秒延遲），動畫照觸發

#### Scenario: 同號碼不重複動畫

- **GIVEN** 目前叫號=5
- **WHEN** WS 因重連送來重複的 `CALL_NEXT { current: 5 }`
- **THEN** 顯示頁不重播動畫（以 currentServing 值變化而非 event 數量為觸發來源）

### Requirement: TTS 語音廣播（可選）

The system SHALL provide an optional Text-to-Speech voice announcement using `window.speechSynthesis`. The toggle SHALL be off by default and SHALL persist its state in `localStorage`. When enabled, the system SHALL announce each new `currentServing` number once, in the current i18n locale (zh → `zh-TW`, en → `en-US`, ja → `ja-JP`), using the phrase template `display.tts.callPhrase` with `{number, serviceName}` interpolation. The feature SHALL degrade gracefully when `window.speechSynthesis` is unavailable.

#### Scenario: TTS 預設關閉

- **GIVEN** 商家第一次開啟 display 頁、localStorage 無 `queueDisplayTts` 鍵
- **WHEN** 商家叫號
- **THEN** display 頁播放視覺動畫但不發聲；toolbar TTS toggle 呈現「關」狀態

#### Scenario: 開啟 TTS 後叫號廣播（zh-TW）

- **GIVEN** locale=zh、TTS toggle=on、localStorage.queueDisplayTts='1'
- **WHEN** 商家叫號到 5 號、服務名稱="洗髮"
- **THEN** 瀏覽器執行 `speechSynthesis.speak(...)`，utterance.lang='zh-TW'、文字為「請 5 號到 洗髮」（template `display.tts.callPhrase`）

#### Scenario: 切換語系後 TTS 跟隨

- **GIVEN** TTS 開啟、目前叫號=7
- **WHEN** 商家於 toolbar 切換 locale 為 ja
- **THEN** 下次叫號（號碼=8）廣播時 utterance.lang='ja-JP'、文字使用日文 `display.tts.callPhrase`

#### Scenario: 瀏覽器不支援 TTS 時降級

- **GIVEN** 裝置瀏覽器 `typeof window.speechSynthesis === 'undefined'`
- **WHEN** 商家開啟 display 頁
- **THEN** TTS toggle 顯示為禁用、tooltip 顯示 `display.tts.unsupported`；頁面其他功能（顯示、動畫）正常運作，不拋例外

#### Scenario: 同號碼不重複廣播

- **GIVEN** TTS 開啟、目前叫號=5、已廣播過 5 號
- **WHEN** WS 因重連再次送出 `CALL_NEXT { current: 5 }`
- **THEN** display 頁不重複呼叫 `speechSynthesis.speak`

#### Scenario: 切換服務時清空 TTS 狀態

- **GIVEN** TTS 開啟、active serviceId=A、最後廣播號碼=5
- **WHEN** 使用者透過 query string 或 toolbar 切換到 serviceId=B（當前叫號=3）
- **THEN** display 頁不立即廣播 B 的 3 號（避免切換瞬間突發語音）；待 B 服務下次 currentServing 變化時才廣播

### Requirement: Admin 顯示頁入口

The system SHALL provide a single split-button entry in the admin queue page (`/admin/queue`) toolbar that opens `/m/{slug}/display` in a new browser tab on primary click and exposes a "copy link" action via its dropdown. The admin entry SHALL be visible to authenticated merchants and SHALL NOT require any new permission or RBAC rule beyond the existing admin queue page guard.

#### Scenario: Admin toolbar 出現「開啟顯示頁」主按鈕

- **GIVEN** 商家已登入、進入 `/admin/queue`
- **WHEN** 頁面渲染
- **THEN** toolbar 顯示一個 split-button：主按鈕文案為 `display.openDisplay`（「開啟顯示頁」），右側附下拉箭頭

#### Scenario: 點主按鈕開新分頁

- **GIVEN** 商家在 `/admin/queue`、slug=acme
- **WHEN** 點擊主按鈕本體
- **THEN** 瀏覽器執行 `window.open('/m/acme/display', '_blank', 'noopener,noreferrer')`，原頁面不導航

#### Scenario: 複製顯示頁連結

- **GIVEN** 商家在 `/admin/queue`
- **WHEN** 點擊主按鈕右側下拉箭頭、再點選「複製連結」
- **THEN** `navigator.clipboard.writeText(displayUrl)` 執行成功、出現 `display.linkCopied` toast

#### Scenario: 無 QUEUE 服務時整顆 disabled

- **GIVEN** 商家當日無任何 `bookingMode=QUEUE` 的服務
- **WHEN** 頁面渲染
- **THEN** split-button 整顆 disabled（主按鈕與下拉皆不可點），hover 顯示 tooltip `display.needQueueService`

#### Scenario: 連線狀態獨立呈現為頁首 chip

- **GIVEN** 商家在 `/admin/queue`
- **WHEN** 頁面渲染
- **THEN** WS 連線狀態（即時連線中 / 連線中斷）顯示為頁首右上獨立小 chip，不混入 split-button

### Requirement: 響應式顯示

The system SHALL render the display page legibly on 1920×1080 (primary target), 1280×720 (small projector), 768×1024 (portrait tablet), and 480px+ (landscape phone) resolutions, without horizontal scroll **on layout container** and without content clipping. Font sizes SHALL scale via `vw / clamp()` rather than fixed pixels.

對多診間多欄版型（`resources.length >= 2`），responsive 行為以 `店面大螢幕多 resource 分區顯示` requirement 的視窗寬度斷點為準（≥ 1440px / 768-1440px / < 768px 三檔）。對單 resource 或未綁 resource 的單一全螢幕版型，沿用本 change 前的兩欄 / 上下兩欄 layout 規則。

#### Scenario: 1920×1080 橫向標準大螢幕（單欄）

- **GIVEN** viewport=1920×1080；單 resource service
- **WHEN** 渲染 display 頁
- **THEN** 目前叫號字級 ≥ 240px、左右兩欄並排（≈60/40 分配），無水平捲軸

#### Scenario: 1920×1080 橫向多欄

- **GIVEN** viewport=1920×1080；service 綁 3 resource
- **WHEN** 渲染
- **THEN** 三欄並列，每欄號碼字級 `clamp(120px, 12vw, 200px)`、resource header 字級 `clamp(36px, 3.5vw, 64px)`、Provider 副標字級 `clamp(20px, 2vw, 32px)`，無水平捲軸

#### Scenario: 1280×720 小投影機（多欄）

- **GIVEN** viewport=1280×720；service 綁 3 resource
- **WHEN** 渲染
- **THEN** 三欄並列、號碼字級自動縮小至 ≥ 100px、所有元素不裁切、無水平捲軸

#### Scenario: 768×1024 直立平板（多欄）

- **GIVEN** viewport=768×1024；service 綁 4 resource
- **WHEN** 渲染
- **THEN** 切換為 2 欄、超過 2 欄者透過容器 `overflow-x: auto` 水平 scroll；字級自動調整

#### Scenario: 480px 橫向手機（多欄）

- **GIVEN** viewport=480px；service 綁 2 resource
- **WHEN** 渲染
- **THEN** 單欄顯示、`scroll-snap` 強制吸附；號碼字級 `clamp(80px, 30vw, 160px)`

#### Scenario: 1920×1080 單欄不受影響

- **GIVEN** viewport=1920×1080；單 resource 或未綁 resource service
- **WHEN** 渲染
- **THEN** 字級與佈局與本 change 前完全一致（≥ 240px 大字、左右兩欄）

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

### Requirement: QueueTicket / QueueCounter 帶 resourceId 多診間分群

`QueueTicket` 與 `QueueCounter` SHALL 各新增可選欄位 `resourceId String?`，並透過 `Resource? @relation(fields: [resourceId], references: [id], onDelete: Restrict)` 連結至 `Resource` 模型。`QueueTicket` 唯一鍵 SHALL 改為 `(merchantId, serviceId, resourceId, ticketDate, ticketNumber)`；`QueueCounter` 唯一鍵 SHALL 改為 `(merchantId, serviceId, resourceId, counterDate)`。`QueueTicket` SHALL 額外新增複合 index `(merchantId, resourceId, ticketDate, status)` 加速「按診間查當日 WAITING 票」查詢。`Resource` 模型 SHALL 新增反向關係 `queueTickets QueueTicket[]` 與 `queueCounters QueueCounter[]`。PostgreSQL 唯一鍵中多個 NULL 不互相衝突的特性 SHALL 用來保證既有資料（`resourceId IS NULL`）以單一號池行為運作，零迴歸。

#### Scenario: 不同診間共用 service 各自從 1 號起

- **GIVEN** service A 綁定 Resource X 與 Resource Y、當日尚無票
- **WHEN** 顧客先在 Resource X 領號，再在 Resource Y 領號
- **THEN** 兩張票各自為 `ticketNumber=1`、`resourceId` 分別為 X 與 Y，且 `(merchantId, serviceId, X, today, 1)` 與 `(merchantId, serviceId, Y, today, 1)` 在新 unique index 下不衝突

#### Scenario: 既有 NULL 資料維持單號池

- **GIVEN** migration 套用前已存在 QueueTicket / QueueCounter 多筆，全部 `resourceId=NULL`
- **WHEN** migration 套用後並再次拿號（service 未綁 resource）
- **THEN** 新票仍寫入 `resourceId=NULL`，與既有 row 共享同一 counter（單號池），號碼遞增順暢、無唯一鍵衝突

#### Scenario: Migration 不需 backfill

- **GIVEN** prod 既有 QueueTicket / QueueCounter
- **WHEN** migration 套用
- **THEN** 所有既有 row 的 `resourceId` 自動為 NULL，不需任何 backfill SQL；商家現有功能行為不變

#### Scenario: Resource 被刪除時 onDelete: Restrict 保護

- **GIVEN** Resource X 仍有 ticketDate=today 的 QueueTicket
- **WHEN** 商家嘗試刪除 Resource X
- **THEN** Prisma 拋出 `Foreign key constraint failed` / Restrict 阻擋（仍依後端錯誤處理規範 `return ApiResponse`），不會造成孤兒 ticket

### Requirement: getResourcesForQueueService helper

`server/utils/queue.ts` SHALL 匯出 helper `getResourcesForQueueService(serviceId: string)`，回傳該 service 透過 `ServiceResource` 關聯到的、且 `deletedAt IS NULL` 與 `isActive=true` 的 `Resource` 陣列，依 `displayOrder` 升序排列。route handler 與 `internalCreateTicket` 不得自行重新撰寫相同查詢，必須委派此 helper，避免「QUEUE 模式可綁 resource」之後出現多份分散的 query。

#### Scenario: 回 active resources

- **GIVEN** service A 綁定 Resource X（active）、Resource Y（active）、Resource Z（isActive=false）
- **WHEN** 呼叫 `getResourcesForQueueService(A)`
- **THEN** 回 `[X, Y]`，依 displayOrder 升序，不含 Z

#### Scenario: 未綁回空陣列

- **GIVEN** service A 未綁任何 resource
- **WHEN** 呼叫 helper
- **THEN** 回 `[]`，呼叫端據此走「單號池 / `resourceId=null`」路徑

#### Scenario: 軟刪除的 resource 不出現

- **GIVEN** service A 綁 Resource X 但 `Resource X.deletedAt IS NOT NULL`
- **WHEN** 呼叫 helper
- **THEN** X 不在回傳列表內

### Requirement: resourceId 驗證規則（多端共用）

對所有接受 `resourceId` 參數的 queue 寫入端點（`POST /public/queue/take`、`POST /queue/create-for-customer`、`POST /queue/call-next`），系統 SHALL 套用統一的執行期驗證：

1. 若 `getResourcesForQueueService(serviceId)` 回非空陣列（service 已綁定 active resource）：
   - body 必須帶 `resourceId`（缺漏回 400 `MSG_QUEUE_RESOURCE_REQUIRED`）
   - `resourceId` 必須出現在該陣列中（不在則回 400 `MSG_QUEUE_RESOURCE_INVALID`）
2. 若 helper 回空陣列（service 未綁任何 active resource）：
   - body 必須**不**帶 `resourceId`（傳了則回 400 `MSG_QUEUE_RESOURCE_INVALID`，避免前後端不同步造成髒資料）

`MSG_QUEUE_RESOURCE_REQUIRED` 與 `MSG_QUEUE_RESOURCE_INVALID` SHALL 提供 `zh_tw / en / ja` 三語訊息。

#### Scenario: 已綁但未傳 resourceId

- **GIVEN** service A 綁 Resource X、Y
- **WHEN** POST take/create-for-customer/call-next body 不帶 `resourceId`
- **THEN** 回 400 `MSG_QUEUE_RESOURCE_REQUIRED`

#### Scenario: 已綁但傳了不屬於該 service 的 resourceId

- **GIVEN** service A 綁 X、Y；Resource Z 屬同商家但未綁到 A
- **WHEN** body 帶 `resourceId=Z`
- **THEN** 回 400 `MSG_QUEUE_RESOURCE_INVALID`

#### Scenario: 已綁但 resource 為 inactive

- **GIVEN** service A 綁 X（active）與 W（isActive=false）
- **WHEN** body 帶 `resourceId=W`
- **THEN** 回 400 `MSG_QUEUE_RESOURCE_INVALID`（helper 已過濾 inactive）

#### Scenario: 未綁卻傳了 resourceId

- **GIVEN** service A 未綁任何 resource
- **WHEN** body 帶 `resourceId=X`
- **THEN** 回 400 `MSG_QUEUE_RESOURCE_INVALID`

#### Scenario: 三語訊息齊全

- **WHEN** 任一錯誤訊息回傳
- **THEN** ApiResponse 內 `message` 物件含 `zh_tw / en / ja` 三鍵且皆為非空字串

### Requirement: Service create/update 允許 QUEUE 綁定 Resources

`POST /nuxt-api/service` 與 `PUT /nuxt-api/service/[id]` SHALL 將「接受 `resourceIds` 的 bookingMode 集合」由 `(RESOURCE, RESOURCE_OPTIONAL)` 擴充為 `(RESOURCE, RESOURCE_OPTIONAL, QUEUE)`。對 QUEUE 模式，`resourceIds` SHALL 為選填（空陣列代表「單一號池」、維持向後相容）。其餘既有驗證（resource 屬該商家、未軟刪除、active）對 QUEUE 模式同樣套用。

#### Scenario: QUEUE 模式可選擇綁定 resources

- **GIVEN** 商家已登入，建立 `bookingMode=QUEUE` 服務
- **WHEN** POST `/nuxt-api/service` body 含 `{ bookingMode: 'QUEUE', resourceIds: [X, Y], ... }`
- **THEN** 服務建立成功，並建立兩筆 `ServiceResource(serviceId, resourceId=X)` 與 `(..., Y)`

#### Scenario: QUEUE 模式可不綁 resources

- **GIVEN** 商家建立 QUEUE 服務、未提供 `resourceIds` 或傳空陣列
- **WHEN** POST `/nuxt-api/service`
- **THEN** 服務建立成功，無 `ServiceResource` 記錄；後續走單號池路徑

#### Scenario: QUEUE 模式提交不屬於自己的 resource 仍拒絕

- **GIVEN** Resource Q 屬另一商家
- **WHEN** POST `/nuxt-api/service` body `{ bookingMode: 'QUEUE', resourceIds: [Q] }`
- **THEN** 回 403 / 既有 `RESOURCE_BAD` 錯誤訊息（沿用既有 ownership 驗證）

#### Scenario: PUT 更新 QUEUE 服務的 resources 綁定

- **GIVEN** 既有 QUEUE 服務 A 已綁 X、Y
- **WHEN** PUT `/nuxt-api/service/[id]` body `{ resourceIds: [X] }`
- **THEN** A 的 ServiceResource 同步為僅 X；Y 的綁定被移除（其上未結束的票券仍存在但不再列入新拿號的選項——警告由階段 2 UI 處理）

### Requirement: queue/today 回 resources 陣列分群

`GET /nuxt-api/queue/today` 的回應 SHALL 對每個 service 多回 `resources` 陣列，陣列每筆形如 `{ id: string | null, name: string | null, displayOrder: number | null, isActive: boolean | null, counter: { lastTicketNumber, lastCalledNumber } | null, tickets: QueueTicket[], avgServiceMinutes: number }`。tickets SHALL 按 `resourceId` 分群歸入對應陣列項。對未綁任何 active resource 的 service，`resources` SHALL 為單元素 `[{ id: null, name: null, displayOrder: null, isActive: null, counter, tickets, avgServiceMinutes }]`，使前端 schema 統一。

#### Scenario: 多 resource service 分群

- **GIVEN** service A 綁 X、Y；當日 X 有 2 張 WAITING、Y 有 1 張 WAITING
- **WHEN** GET `/queue/today`
- **THEN** A 物件 `resources.length=2`，X 項 `tickets.length=2`、Y 項 `tickets.length=1`，各帶獨立 counter

#### Scenario: 未綁 resource 的 service 走 fallback

- **GIVEN** service B 未綁 resource、當日有 3 張 ticket
- **WHEN** GET `/queue/today`
- **THEN** B 物件 `resources` 為單元素陣列、`resources[0].id=null`、`tickets.length=3`

#### Scenario: 歷史票對應已刪除 resource 仍顯示

- **GIVEN** service A 當日歷史票對應 Resource X，但 X 已被軟刪
- **WHEN** GET
- **THEN** 該票仍出現在 `resources` 中對應 X 的項；name 從票券 join 反查、isActive=false（不從 `getResourcesForQueueService` 取）

#### Scenario: 每張 WAITING 票仍含 estimatedWaitMinutes 並按 resource counter 計算

- **GIVEN** service A 綁 X、Y；X 的 counter.lastCalledNumber=3，service.avgServiceMinutes=10；X 上 ticketNumber=5 的 WAITING 票
- **WHEN** GET
- **THEN** 該票的 `estimatedWaitMinutes` 以 X 的 counter 與 service avg 計算為 10（前面 1 人 × 10）；不會混入 Y 的 counter

### Requirement: public/m/[slug] 回 resources 陣列分群

`GET /nuxt-api/public/m/[slug]` 對每個 `bookingMode=QUEUE` 服務 SHALL 多回 `resources` 陣列，陣列每筆形如 `{ id: string | null, name: string | null, displayOrder: number | null, currentServing: number, ticketsTaken: number, waitingCount: number, avgServiceMinutes: number, estimatedNextCallMinutes: number | null }`。未綁任何 active resource 的 QUEUE service SHALL 回單元素 `[{ id: null, name: null, displayOrder: null, ... }]`。本欄位 SHALL 與既有頂層 `currentServing / ticketsTaken / waitingCount / estimatedNextCallMinutes / avgServiceMinutes` 並存以維持階段 2 / 3 前端 release 前的向後相容；綁多 resource 時頂層欄位以「該 service 所有 active resource 的合計／代表值」呈現（`ticketsTaken` 為加總、`waitingCount` 為加總、`currentServing` 為當前各 resource 中號碼最小且仍有 WAITING 票者，無則 0、`estimatedNextCallMinutes` 為所有 resource 的最小者）。

#### Scenario: 多 resource QUEUE service 回陣列

- **GIVEN** QUEUE service A 綁 X、Y；X currentServing=5、waitingCount=3;Y currentServing=2、waitingCount=1
- **WHEN** GET `/public/m/[slug]`
- **THEN** services A 物件 `resources.length=2`，分別反映各自 counter；頂層 `waitingCount=4`、`ticketsTaken` 為兩者加總

#### Scenario: 未綁 resource QUEUE service 回單元素陣列

- **GIVEN** QUEUE service B 未綁 resource、currentServing=3、waitingCount=2
- **WHEN** GET
- **THEN** B 物件 `resources` 為單元素 `[{ id: null, name: null, currentServing: 3, ticketsTaken, waitingCount: 2, ... }]`；頂層欄位與單元素值一致

#### Scenario: 非 QUEUE service 不含 resources

- **GIVEN** service C 為 TIME_SLOT
- **WHEN** GET
- **THEN** C 物件**不**含 `resources` / `currentServing` / `waitingCount` / `estimatedNextCallMinutes` 欄位（與既有規則一致）

#### Scenario: estimatedNextCallMinutes 按 resource 計算

- **GIVEN** QUEUE service A 綁 X、Y、Z；X 等 30 分、Y 等 10 分、Z 無人等
- **WHEN** GET
- **THEN** `resources` 各自欄位為 30 / 10 / 0；頂層 `estimatedNextCallMinutes=0`（Z 最小）

### Requirement: 商家叫號台 segmented control「目前操作」

The merchant queue admin page SHALL show a "目前操作" segmented control on the parent card area when a QUEUE service has 2 or more bound active resources. The control SHALL persist the selected resource per (merchantId, serviceId) tuple to `localStorage` under key `queueOperatingResource:{merchantId}:{serviceId}`. The control SHALL act as a visual aid (scroll-into-view + highlight the corresponding sub-card) only, and SHALL NOT lock or hide any per-sub-card buttons; staff can still operate any sub-card regardless of which option is selected.

#### Scenario: 多 resource 顯示 segmented control

- **Given** 某 QUEUE service 綁定 2 個以上 active resource
- **When** 卡片渲染
- **Then** 出現 segmented control，options 對應每個 resource name（按 `displayOrder` 排序），預設選中 `localStorage` 內紀錄的 resource 或 fallback 到第一個

#### Scenario: 單一 resource 不顯示 segmented control

- **Given** 某 QUEUE service 綁定 ≤1 個 active resource（含 0 與未綁）
- **When** 卡片渲染
- **Then** segmented control 不渲染

#### Scenario: 切換時持久化

- **When** 點擊 segmented control 切換至 Resource B
- **Then** `localStorage.setItem('queueOperatingResource:{m}:{s}', 'B')` 立即寫入；下次重新整理頁面預設選中 Resource B

#### Scenario: localStorage stale 值降級

- **Given** `localStorage` 紀錄的 resourceId 已不存在於 `service.resources`（例如已被停用或刪除）
- **When** 卡片渲染
- **Then** 自動 fallback 到第一個 active resource 並把該值寫回 localStorage

#### Scenario: 切換時 scroll-into-view

- **When** 切換至 Resource B
- **Then** Resource B 對應子卡執行 `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`、套上短暫高亮樣式（≤ 1 秒）

#### Scenario: 切換不鎖其他子卡

- **Given** segmented control 選中 Resource A
- **When** 商家直接在 Resource B 子卡點「叫下一號」
- **Then** Resource B 的叫號正常執行、不受 segmented control 選中狀態限制

### Requirement: Service 編輯彈窗允許 QUEUE 模式選擇 Resources

The merchant service-edit dialog (`app/components/open/dialog/service-edit.vue`) SHALL show the resource-binding selector when `bookingMode` is `RESOURCE`, `RESOURCE_OPTIONAL`, or `QUEUE`. When the selector is shown for `QUEUE`, the label and hint SHALL use QUEUE-specific i18n strings indicating the binding is optional and each bound resource forms an independent queue.

#### Scenario: QUEUE 模式顯示資源選擇器

- **Given** 商家在 service-edit 彈窗將 `bookingMode` 切到 `QUEUE`
- **When** 彈窗渲染
- **Then** 資源選擇器區塊顯示，標題顯示 `service.edit.queueResourcesLabel`（「可叫號的診間／櫃台／醫師（選填）」），提示顯示 `service.edit.queueResourcesHint`（「綁定後每個資源獨立一條號碼牌隊列；不綁則維持單一號池」）

#### Scenario: RESOURCE / RESOURCE_OPTIONAL 模式沿用原文案

- **Given** `bookingMode` 為 `RESOURCE` 或 `RESOURCE_OPTIONAL`
- **When** 彈窗渲染
- **Then** 資源選擇器標題與提示沿用既有 i18n（不出現 queue 專屬文案）

#### Scenario: BOOKING / SHOP 模式仍隱藏選擇器

- **Given** `bookingMode` 為 `BOOKING` 或 `SHOP`
- **When** 彈窗渲染
- **Then** 資源選擇器**不**顯示

#### Scenario: QUEUE 留空綁定可送出

- **Given** `bookingMode=QUEUE`、未選任何 resource（`resourceIds: []`）
- **When** 送出表單
- **Then** 後端接受空陣列、service 維持單一號池行為（依「Service create/update 允許 QUEUE 綁定 Resources」requirement）

#### Scenario: QUEUE 綁定多 resource 可送出

- **Given** `bookingMode=QUEUE`、選了 Resource A 與 B
- **When** 送出表單
- **Then** 後端 service 更新 `resources: [A, B]`，叫號台後續渲染依此分子卡（依「商家叫號頁」requirement）

### Requirement: 現場登記彈窗注入 resourceId

The walk-in registration dialog (`app/components/open/dialog/queue-walk-in.vue`) SHALL accept a `resourceId: string | null` field from its opener. When opened from a sub-card on the admin queue page, the opener SHALL inject the sub-card's resourceId; when opened from a card without resources, the opener SHALL pass `null`. The dialog SHALL include the resourceId in its submission payload to `POST /nuxt-api/queue/create-for-customer`.

#### Scenario: 從綁 resource 子卡開啟

- **Given** 商家在「看診」service 的 Resource A 子卡
- **When** 點「現場登記」
- **Then** 彈窗開啟時內部 state `resourceId='A'`；submit 時 body 含 `resourceId: 'A'`

#### Scenario: 從未綁 resource 卡片開啟

- **Given** 商家在未綁 resource 的 QUEUE service 卡片
- **When** 點「現場登記」
- **Then** 彈窗開啟時 `resourceId=null`；submit 時 body 不含 `resourceId` 或傳 `null`（後端皆兼容）

#### Scenario: 連續從不同子卡開啟不殘留

- **Given** 商家剛從 Resource A 子卡開過彈窗、已 close
- **When** 商家從 Resource B 子卡再開啟彈窗
- **Then** 彈窗內部 `resourceId='B'`（不殘留上次的 `'A'`）

#### Scenario: submit 成功後票券落在指定 resource

- **Given** Resource A 子卡開啟彈窗、submit 填妥姓名與稱謂
- **When** 後端建票成功
- **Then** 該 ticket `resourceId='A'`；WS 廣播 `TICKET_TAKEN { resourceId: 'A', resourceName: 'A 診間' }`；Resource A 子卡的 WAITING 列表新增一張票，Resource B 子卡不變

### Requirement: 顧客拿號頁支援 resource 選擇

`app/pages/m/[slug]/queue/`（拿號頁）SHALL 對 `bookingMode='QUEUE'` 且 `resources.length > 0` 的 service 顯示資源選擇器，每個選項 SHALL 顯示「現叫 N 號・等待 M 人」（i18n key `queue.take.roomStat`）以幫顧客決策；提交時 SHALL 帶 `resourceId` 至 `POST /nuxt-api/public/queue/take`；單一 resource（`resources.length === 1`）SHALL 自動選定但隱藏選擇器；未綁 resource（`resources.length === 0` 或 `resources[0].id === null`）SHALL 完全沿用原 UX 不顯示選擇器、提交時不帶 `resourceId`。

#### Scenario: service 綁 2 個 resource 顯示 segmented control

- **GIVEN** service `bookingMode=QUEUE`，`resources=[{id:'A', name:'A 診間', currentServing:3, waitingCount:2}, {id:'B', name:'B 診間', currentServing:1, waitingCount:5}]`
- **WHEN** 顧客進入 `/m/[slug]/queue/`
- **THEN** 該 service 卡片內顯示 label 為 `queue.take.selectRoomLabel`、hint 為 `queue.take.selectRoomHint` 的 segmented control，兩個選項分別顯示 `A 診間` + 「現叫 3 號・等待 2 人」與 `B 診間` + 「現叫 1 號・等待 5 人」

#### Scenario: 拿號 submit 帶 resourceId

- **GIVEN** 顧客在 `/m/[slug]/queue/` 已選中 `B 診間` 並填妥姓氏 / 稱謂 / 電話
- **WHEN** 點「拿號」按鈕
- **THEN** 前端呼叫 `$api.PostPublicQueueTake({ slug, serviceId, lastName, title, phone, resourceId: 'B' })`，並在收到 `claimToken` 後跳轉 `/m/[slug]/queue/status?id={ticketId}&token={claimToken}`

#### Scenario: 單一 resource 自動選定

- **GIVEN** service 綁 `resources=[{id:'X', name:'X 診間'}]`（陣列長度 1）
- **WHEN** 顧客進入拿號頁
- **THEN** 不渲染 segmented control，內部 state 自動將 `resourceId='X'`；submit 時帶上

#### Scenario: 未綁 resource 不顯示選擇器（迴歸保護）

- **GIVEN** service `bookingMode=QUEUE` 未綁 resource（`resources=[]` 或 `resources=[{id:null}]`）
- **WHEN** 顧客進入拿號頁
- **THEN** 卡片 UI 與本變更前完全一致（不渲染選擇器、不渲染各間 stat）；submit 時 body **不**包含 `resourceId` 欄位（或 `resourceId=null`）

### Requirement: 顧客查號頁顯示 resource 名稱

`app/pages/m/[slug]/queue/status.vue` SHALL 在 `MyTicket.ticket.resourceName` 非空時，將主號碼顯示文案改為 `queue.page.ticketWithRoom`（變數 `{room}/{number}`），並將 CALLED 狀態 hint 改為 `queue.page.statusCalledHintWithRoom`（變數 `{room}`）；`resourceName` 為空（含 null/undefined/空字串）時 SHALL fallback 至既有 `queue.page.statusYourNumber` / `queue.page.statusCalledHint`。

#### Scenario: CALLED 且帶 resource 顯示帶 room 文案

- **GIVEN** myTicket `{ ticketNumber: 5, resourceId: 'A', resourceName: 'A 診間', status: 'CALLED' }`
- **WHEN** 顧客進入 `/m/[slug]/queue/status?id=...&token=...`
- **THEN** 主畫面號碼處顯示「A 診間 5 號」、status hint 顯示「請至 A 診間，輪到您了！」

#### Scenario: 未綁 resource fallback 原文案（迴歸保護）

- **GIVEN** myTicket `{ ticketNumber: 5, resourceId: null, resourceName: null, status: 'CALLED' }`
- **WHEN** 顧客進入 status 頁
- **THEN** 文案與本變更前一致（無 room 前綴），CALLED hint 為「請至櫃台，輪到您了！」（既有 `queue.page.statusCalledHint`）

### Requirement: 顧客找號頁列出多筆同手機末 4 碼結果

`app/pages/m/[slug]/queue/find.vue` SHALL 處理 `tickets.length > 1` 的情境：以列表呈現所有當日有效票，每筆顯示 `{resourceName} {ticketNumber} 號 - {serviceName}`（resourceName 為空時顯示 `{ticketNumber} 號 - {serviceName}`），每筆附「查看狀態」按鈕跳轉 `status?id={ticketId}&token={claimToken}`；`tickets.length === 1` SHALL 維持本變更前單筆 UX（含自動跳轉行為）。

#### Scenario: 同手機末 4 碼在 A 與 B 兩診各一張

- **GIVEN** API `/public/queue/find` 回 `tickets=[{ticketNumber:3, resourceName:'A 診間', serviceName:'看診', token:'t1'}, {ticketNumber:1, resourceName:'B 診間', serviceName:'看診', token:'t2'}]`
- **WHEN** 顧客在找號頁輸入末 4 碼提交
- **THEN** 顯示包含兩個項目的列表，分別為「A 診間 3 號 - 看診」+「查看狀態」按鈕、「B 診間 1 號 - 看診」+「查看狀態」按鈕

#### Scenario: 只有一筆走原單筆 UX（迴歸保護）

- **GIVEN** API 回 `tickets=[{ticketNumber:3, resourceName:'A 診間', token:'t1'}]`
- **WHEN** 顧客查詢成功
- **THEN** 走本變更前單筆 UX（含直接跳轉 status 的既有行為）

### Requirement: 店面大螢幕多 resource 分區顯示

`app/pages/m/[slug]/display.vue` SHALL 在當前 ActiveService 綁 `resources.length >= 2` 時，以 CSS grid 分區呈現各 resource 的叫號狀態。版型按視窗寬度自適應：

- **≥ 1440px**（大螢幕）：`grid-template-columns: repeat(min(N, 4), 1fr)`，N > 4 時自動分頁，每 8 秒切頁
- **768 ~ 1440px**（平板橫向）：`grid-template-columns: repeat(2, 1fr)`，超過 2 欄時水平 scroll（`overflow-x: auto`）
- **< 768px**（手機橫向 / 直立小螢幕）：`grid-template-columns: 1fr`，水平 swipe（CSS `scroll-snap-type: x mandatory`）

每個 cell SHALL 由上而下顯示：
1. **頂部 header**：`{resourceName}` 大字 + 副標 Provider 名稱（**啟用 Provider 制且該 resource 該時段命中 Provider 時才渲染**；未啟用或未命中不渲染副標 dom）
2. **中段**：該 resource 當前 `currentServing` 號碼（最大字級）+ 顧客姓名（取自 NOW_CALLING ticket）
3. **下段**：下一號預告 + 等待人數

`resources.length <= 1` 或未綁 resource（`resources[0].id === null`）SHALL 走本 change 前的「單一全螢幕」layout（保留動畫、TTS、輪詢 fallback 全部現狀）。

#### Scenario: 2 resource 顯示左右兩格 + Provider 副標（啟用 Provider 制）

- **GIVEN** 啟用 Provider 制；service 綁 A、B 兩 resource，當下 schedule 排 A = 王醫師、B = 李醫師；A 當前 currentServing=3、B=5
- **WHEN** /display 自動或手動選中該 service
- **THEN** 主畫面呈兩欄；左欄頂部「A 診間」+ 副標「王醫師」，中段大字「3」+ NOW_CALLING 顧客姓名；右欄結構同 B/5/李醫師

#### Scenario: 2 resource 未啟用 Provider 制只顯示 room name

- **GIVEN** `providerModeEnabled=false`；service 綁 A、B
- **WHEN** /display 選中該 service
- **THEN** 兩欄頂部僅顯示「A 診間」「B 診間」，無副標 dom；其餘行為與本 change 前一致

#### Scenario: 3 resource 自適應 grid（≥ 1440px）

- **GIVEN** viewport ≥ 1440px；service 綁 A、B、C 三 resource
- **WHEN** /display 選中該 service
- **THEN** 主畫面三欄並列，每欄按上述結構渲染

#### Scenario: 5 resource 大螢幕分頁切換（≥ 1440px）

- **GIVEN** viewport ≥ 1440px；service 綁 5 個 resource
- **WHEN** /display 選中該 service
- **THEN** 一次顯示 4 欄，每 8 秒切換顯示「1-4 欄 → 5 欄 + 留白」；分頁切換有 0.3 秒 fade 過場

#### Scenario: 平板橫向兩欄滾動

- **GIVEN** viewport=1024px；service 綁 4 個 resource
- **WHEN** /display 渲染
- **THEN** 一次顯示 2 欄，可水平 scroll 查看其餘 2 欄

#### Scenario: 手機橫向單欄 swipe

- **GIVEN** viewport=480px；service 綁 2 個 resource
- **WHEN** /display 渲染
- **THEN** 單欄顯示，可水平 swipe；`scroll-snap-type: x mandatory` 強制每次停在一欄

#### Scenario: 單 resource 走全螢幕（迴歸保護）

- **GIVEN** service 未綁 resource 或只綁一個
- **WHEN** /display 選中該 service
- **THEN** 主畫面為本 change 前的單一全螢幕 layout（單一大號碼、單一副標），無多欄分區

#### Scenario: cell 內 currentServing 動畫只影響該 cell

- **GIVEN** 多欄渲染、A 欄 currentServing=3
- **WHEN** WS `CALL_NEXT { resourceId:'A', current:4 }` 推播
- **THEN** 僅 A 欄號碼播放動畫，B/C 欄不受影響（與既有 `pageDisplayCallNext` keyframes 行為一致但 scope 為單 cell）

### Requirement: 店面大螢幕 TTS 帶 resource 變體

`app/pages/m/[slug]/display.vue` 的 TTS 邏輯 SHALL 在 WS CALL_NEXT 帶 `resourceId/resourceName` 時，使用 `display.tts.callPhraseWithRoom`（變數 `{number}/{room}`）作為朗讀文案；無 `resourceName` 時 fallback 既有 `display.tts.callPhrase`。重複播報防護 SHALL 以 (serviceId, resourceId) 為 key 各自記錄 `lastSpokenNumber`，使 A 診叫號不會壓制 B 診的播報。

#### Scenario: 多 resource 時 TTS 唸帶 room 句子

- **GIVEN** TTS 啟用、locale=zh、WS 推播 `CALL_NEXT { serviceId:'s1', resourceId:'A', resourceName:'A 診間', current: 7 }`
- **WHEN** display 頁收到推播
- **THEN** 觸發 TTS 朗讀「7 號，請至 A 診間」（key `display.tts.callPhraseWithRoom`）

#### Scenario: 兩診間同時叫號各自播報不互相壓制

- **GIVEN** TTS 啟用、`lastSpokenNumber={ 's1|A': 0, 's1|B': 0 }`
- **WHEN** 30 秒內先後收到 `CALL_NEXT { resourceId:'A', current:1 }` 與 `CALL_NEXT { resourceId:'B', current:1 }`
- **THEN** 兩句皆被排入 TTS queue 依序播放（A 播完播 B），不因 number 相同被去重

#### Scenario: 未綁 resource fallback 原句（迴歸保護）

- **GIVEN** TTS 啟用、WS 推播 `CALL_NEXT { serviceId:'s1', current:7 }`（無 resourceId/resourceName）
- **WHEN** display 收到推播
- **THEN** 觸發朗讀「7 號，請至櫃台」（既有 `display.tts.callPhrase`）

### Requirement: 店面大螢幕自動挑 service 考量 resource 內 WAITING

`app/pages/m/[slug]/display.vue` 在 URL query 無 `serviceId` 時，SHALL 從所有 QUEUE service 中過濾「至少一個 resource 有 `waitingCount > 0`」者作為候選池；候選池為空時 SHALL 退到「ticketsTaken 最大」的 service。選出 service 後，內部各 cell 各自從 `serviceMap[serviceId].resourceMap[resourceId]` 拉 live state。

#### Scenario: 多 service 比較自動挑

- **GIVEN** 商家有兩 QUEUE service：S1 綁 A/B（A waiting=0、B waiting=3），S2 綁 X（waiting=0）
- **WHEN** 顧客打開 `/m/[slug]/display`（無 serviceId query）
- **THEN** 自動選中 S1（其 B resource 有 waiting）

#### Scenario: 全部 service 無 waiting 退到 ticketsTaken 最大

- **GIVEN** S1 與 S2 各 resource 皆 waiting=0；S1 ticketsTaken=10、S2 ticketsTaken=20
- **WHEN** display 自動挑
- **THEN** 選中 S2

### Requirement: realtime store resourceMap 結構

`app/stores/7.store-queue-realtime.ts` 的 `serviceMap[serviceId]` SHALL 內含 `resourceMap: Record<string, ResourceServingState>`，key 為 `resourceId` 或字面量 `'__null__'`（未綁 resource 的 fallback bucket）；`ResourceServingState` SHALL 包含 `currentServing / servingTicketId / servingCustomerLastName / servingCustomerTitle / avgServiceMinutes / waitingCount / ticketsTaken / lastEventAt`。`ServiceServingState` 頂層 SHALL 保留與本變更前一致的欄位作為「最近被叫的 resource 投影」以維持既有 admin / status.vue 讀取兼容性。`myTicket` SHALL 額外帶 `resourceId / resourceName / displayLabel` 三欄（從後端 `GET /public/queue/[id]` response 直接 forward）。

#### Scenario: 拿號 init 時 resourceMap 由 snapshot 灌入

- **GIVEN** `GET /public/m/[slug]` 回 `services=[{id:'s1', resources:[{id:'A', name:'A 診間', currentServing:3, waitingCount:1, avgServiceMinutes:5}, {id:'B', name:'B 診間', currentServing:1, waitingCount:2, avgServiceMinutes:5}]}]`
- **WHEN** 頁面 mounted 把 snapshot 灌入 store
- **THEN** `serviceMap['s1'].resourceMap['A'].currentServing===3`，`serviceMap['s1'].resourceMap['B'].currentServing===1`，頂層 `serviceMap['s1'].currentServing` 為「最近事件」之 projection（init 階段可任選其一，例如取 displayOrder 最小者）

#### Scenario: WS CALL_NEXT 推播按 (serviceId, resourceId) 路由

- **GIVEN** `serviceMap['s1'].resourceMap['A'].currentServing=3` 且 `resourceMap['B'].currentServing=1`
- **WHEN** 收到 WS `CALL_NEXT { serviceId:'s1', resourceId:'B', current:2, ... }`
- **THEN** 只更新 `resourceMap['B'].currentServing=2`，`resourceMap['A']` 不變；頂層 projection 同步至 B（因 B 為最近事件）

#### Scenario: 未綁 resource 走 `'__null__'` bucket（迴歸保護）

- **GIVEN** 未綁 resource 的 QUEUE service `s2`，snapshot resources=`[{id:null,...}]`
- **WHEN** 灌入 store
- **THEN** `serviceMap['s2'].resourceMap['__null__']` 存在且帶完整欄位；頂層欄位同 `'__null__'` bucket；既有 admin / status.vue 不需改動仍能正確讀

#### Scenario: myTicket 帶 resource 欄位

- **GIVEN** `GET /public/queue/[id]` 回 `{ ticket:{...}, resourceId:'A', resourceName:'A 診間', displayLabel:'A 1' }`
- **WHEN** status.vue mount 灌入 store
- **THEN** `queueStore.myTicket.ticket.resourceId==='A'`、`resourceName==='A 診間'`、`displayLabel==='A 1'`

### Requirement: realtime store HandleMessage 按 resource 隔離

`HandleMessage` SHALL 在收到帶 `resourceId` 的 WS payload 時，僅更新該 (serviceId, resourceId) 對應的 `resourceMap` entry，不污染同 service 其他 resource 的 state。對 `myTicket` 的更新 SHALL 額外比對 `myTicket.ticket.resourceId === msg.resourceId`，不一致時 SHALL 跳過 myTicket patch（避免 A 診叫號改了 B 診顧客的 currentServing）。

#### Scenario: B 診叫號不污染 A 診顧客顯示

- **GIVEN** myTicket 在 A 診（resourceId='A', ticketNumber=5, status=WAITING），`serviceMap['s1'].resourceMap['A'].currentServing=3`、`resourceMap['B'].currentServing=1`
- **WHEN** WS 推 `CALL_NEXT { serviceId:'s1', resourceId:'B', current:2 }`
- **THEN** `resourceMap['B'].currentServing` 變 2；`resourceMap['A']` 不變；`myTicket.currentServing` 不變（仍為 3，因事件不是針對 A）；`myTicket.waitingAhead` 不變

#### Scenario: A 診叫到自己更新 myTicket 至 CALLED

- **GIVEN** myTicket `{ resourceId:'A', ticketNumber:5, status:'WAITING' }`
- **WHEN** WS 推 `CALL_NEXT { serviceId:'s1', resourceId:'A', current:5, servingTicketId: myTicketId }`
- **THEN** `myTicket.ticket.status='CALLED'`，`myTicket.currentServing=5`，`waitingAhead=0`

### Requirement: 顧客面 i18n 多 resource keys 三語完整

`i18n/locales/{zh,en,ja}.js` SHALL 完整包含本變更引入的 7 個 i18n keys，三語對齊無遺漏：
- `queue.page.ticketWithRoom`（變數 `{room}/{number}`）
- `queue.page.statusCalledHintWithRoom`（變數 `{room}`）
- `queue.take.selectRoomLabel`
- `queue.take.selectRoomHint`
- `queue.take.roomStat`（變數 `{current}/{waiting}`）
- `display.gotoRoom`（變數 `{room}`）
- `display.tts.callPhraseWithRoom`（變數 `{number}/{room}`）

#### Scenario: zh / en / ja 三語齊備

- **GIVEN** 7 個新 keys
- **WHEN** 對三個 locales 檔執行 keys 比對
- **THEN** 每個 key 在三語檔都有對應翻譯，無 `undefined` / missing key 警告

#### Scenario: 變數正確替換

- **WHEN** 渲染 `queue.page.ticketWithRoom` 帶 `{room:'A 診間', number:5}`
- **THEN** zh 顯示「A 診間 5 號」、en 顯示「{room} #{number}」格式對應、ja 顯示「{room} {number} 番」格式對應（具體文案以實作為準，但 placeholder 必須被替換）

### Requirement: Provider 推導 helper（後端唯讀 join）

`server/utils/queue.ts` SHALL 匯出 helper `resolveProviderByResourceMap(merchantId: string, now: Date)`，回傳 `Map<resourceId | '__null__', { providerId: string; providerName: string } | null>`。helper SHALL 不寫入任何 DB、不變更任何 row、純唯讀查詢；本 change 內所有需要「該 resource 該時段對應 Provider」的端點 / 廣播 SHALL 一律委派此 helper，不得自行重新撰寫等價查詢。

helper 內部演算法 MUST：

1. 取商家時區下的 `today` 與 `weekday`（與 `getTicketDateString` / `isWithinQueueWindow` 一致）
2. 查 `ScheduleOverride WHERE merchantId=M AND date=today AND providerId IS NOT NULL AND scope=PROVIDER AND isClosed=false AND startTime <= HH:mm < endTime`
3. 查 `ScheduleRule WHERE merchantId=M AND weekday=今日 weekday AND providerId IS NOT NULL AND scope=PROVIDER AND isActive=true AND startTime <= HH:mm < endTime`
4. 將兩來源結果按 `resourceId` 分組；Override 優先 Rule，多 Provider 命中同一 resource 則該 entry 值為 `null`（畫面 fallback 不顯示副標）
5. 一次 `IN` 查詢 join 全部命中的 Provider 取 `name`
6. 商家 `providerModeEnabled=false` 時直接回空 Map（短路，不查 schedule）

#### Scenario: 商家未啟用 Provider 制短路

- **GIVEN** `Merchant.providerModeEnabled=false`
- **WHEN** 呼叫 `resolveProviderByResourceMap(merchantId, now)`
- **THEN** 立即回空 `Map`，不執行任何 schedule query

#### Scenario: Override 優先 Rule

- **GIVEN** 啟用 Provider 制；ScheduleRule 排定週一 09:00-12:00 王醫師在 A 診；ScheduleOverride 2026-05-22（週五）排李醫師在 A 診 10:00-12:00；當下時間 2026-05-22 10:30
- **WHEN** 呼叫 helper
- **THEN** 回 `Map { 'A' => { providerId: 'leeDoc', providerName: '李醫師' } }`（Override 勝出）

#### Scenario: 多 Provider 命中同 resource 回 null

- **GIVEN** ScheduleRule 排定週一 09:00-12:00 王醫師與張醫師同時在 A 診（排班錯誤情境）；當下週一 10:00
- **WHEN** 呼叫 helper
- **THEN** 回 `Map { 'A' => null }`，前端 fallback 不渲染副標

#### Scenario: 時段邊界外不命中

- **GIVEN** ScheduleRule 排定週一 09:00-12:00 王醫師在 A 診；當下週一 12:00 整
- **WHEN** 呼叫 helper
- **THEN** Map 不含 `A` 鍵（12:00 不在 09:00 <= time < 12:00 範圍內）

### Requirement: 商家當日總覽票補 Provider 欄位

`GET /nuxt-api/queue/today` 回應結構中每張 ticket SHALL 額外帶 `providerId: string | null` 與 `providerName: string | null` 兩欄位，值來自 `resolveProviderByResourceMap` 對該票 `resourceId` 的查表結果；helper 回 null（含未啟用 Provider 制、無命中、多匹配）時兩欄位皆為 null。本欄位 SHALL 為純前端展示用，不影響任何既有業務邏輯（排序 / 過濾 / 號碼分配等）。

#### Scenario: 啟用 Provider 制商家票卡帶 providerName

- **GIVEN** 啟用 Provider 制；ScheduleRule 排定當下時段王醫師在 A 診；當日 A 診上 2 張 WAITING 票
- **WHEN** GET `/nuxt-api/queue/today`
- **THEN** A 診兩張票皆帶 `providerId='wangDoc', providerName='王醫師'`

#### Scenario: 未啟用 Provider 制票卡欄位為 null

- **GIVEN** `Merchant.providerModeEnabled=false`；當日 A 診上 2 張 WAITING 票
- **WHEN** GET `/nuxt-api/queue/today`
- **THEN** 兩張票回應皆包含 `providerId: null, providerName: null`

#### Scenario: 啟用但該 resource 該時段無命中

- **GIVEN** 啟用 Provider 制；A 診當下時段無任何 PROVIDER scope ScheduleRule / Override；A 診上有 1 張 WAITING 票
- **WHEN** GET `/nuxt-api/queue/today`
- **THEN** 該票回應 `providerId: null, providerName: null`

### Requirement: public/m/[slug] resources 補 provider 子物件

`GET /nuxt-api/public/m/[slug]` 回應中每個 QUEUE service 的 `resources` 陣列中每一筆 SHALL 額外帶 `provider: { id: string; name: string } | null`，值來自 `resolveProviderByResourceMap` 對該 resource id 的查表結果。未啟用 Provider 制商家、helper 回 null 或多匹配時，`provider` SHALL 為 null。`provider` 為附加欄位，不取代既有任何欄位、不影響頂層 `currentServing / waitingCount` 等 aggregate 計算。

#### Scenario: 啟用 Provider 制每 resource 帶 provider

- **GIVEN** 啟用 Provider 制；QUEUE service A 綁 X、Y；當下 ScheduleRule 排 X = 王醫師、Y = 李醫師
- **WHEN** GET `/public/m/[slug]`
- **THEN** services A.resources = `[{ id:'X', ..., provider:{id:'wangDoc', name:'王醫師'} }, { id:'Y', ..., provider:{id:'leeDoc', name:'李醫師'} }]`

#### Scenario: 未啟用 Provider 制每 resource provider 為 null

- **GIVEN** `Merchant.providerModeEnabled=false`；QUEUE service A 綁 X、Y
- **WHEN** GET `/public/m/[slug]`
- **THEN** services A.resources 各筆 `provider: null`

#### Scenario: 未綁 resource service 不受影響

- **GIVEN** QUEUE service B 未綁 resource，回 `resources: [{ id: null, ... }]`
- **WHEN** GET
- **THEN** 該單元素亦包含 `provider: null`（保持結構一致）

### Requirement: WebSocket 廣播 payload 補 Provider 欄位

`server/utils/queue.ts/broadcastQueue` 廣播的 `TICKET_TAKEN` / `CALL_NEXT` / `TICKET_DONE` / `TICKET_SKIPPED` payload SHALL 額外帶 `providerId?: string | null` 與 `providerName?: string | null` 兩欄位，值由廣播觸發端（`take.post.ts` / `call-next.post.ts` / `[id]/done.post.ts` / `[id]/skip.post.ts` / `create-for-customer.post.ts` / `[id]/assign-resource.post.ts`）在呼叫 `broadcastQueue` 前透過 `resolveProviderByResourceMap` 查表後附入。HELLO 與心跳訊息不受影響。**既有欄位（type / serviceId / current / servingTicketId / ticketNumber / resourceId / resourceName / timestamp）一律保留不變、語意不改**；新欄位為附加，舊版前端忽略即可。

#### Scenario: 叫號廣播帶 Provider

- **GIVEN** 啟用 Provider 制；當下 ScheduleRule 排定 A 診王醫師；商家在 A 診點「叫下一號」叫到 7 號
- **WHEN** 後端廣播
- **THEN** payload `{ type:'CALL_NEXT', serviceId, resourceId:'A', resourceName:'A 診間', current:7, providerId:'wangDoc', providerName:'王醫師', ticketNumber:7, servingTicketId, timestamp }`

#### Scenario: 未啟用 Provider 制廣播兩欄位為 null

- **GIVEN** `Merchant.providerModeEnabled=false`；商家叫號到 7 號
- **WHEN** 廣播
- **THEN** payload 中 `providerId: null, providerName: null`，其餘欄位與既有完全一致

#### Scenario: 拿號廣播亦帶 Provider

- **GIVEN** 啟用 Provider 制；顧客於 A 診拿號到 12 號
- **WHEN** 後端廣播 `TICKET_TAKEN`
- **THEN** payload 含 `providerId, providerName` 兩欄位（按當下 schedule 解析）

### Requirement: 商家報到台（QueueCheckInPanel）

`app/pages/admin/queue.vue` SHALL 在啟用 Provider 制（`Merchant.providerModeEnabled=true`）的商家頁面頂部（位於 QueueControlPanel 之上）渲染 `BizQueueCheckInPanel` 組件，列出當日所有 `status=WAITING` 的票按 `takenAt` 升序排列，每張票為一張獨立卡片，支援「確認報到（不改派，純 UI 移除）」與「改派（呼叫後端端點）」兩條路徑。未啟用 Provider 制商家 SHALL **完全不渲染** 此組件（行為與本 change 前一致）。

每張票卡片 MUST 顯示：
- 顧客姓名（`customerTitle + customerLastName`）與 `ticketNumber`
- 服務名稱
- Provider 名稱（前綴用 `Merchant.providerLabel[locale]` fallback i18n 預設；票 `providerId=null` 時顯示「未指派服務人員」i18n key）
- 指派診間下拉：預帶值為該票當前 `resourceId`；options 為該 service 已綁的 active resource，每 option 額外顯示「{resourceName} - {providerName}」（join 自前述 `resolveProviderByResourceMap` 結果）
- 「確認報到」主按鈕

#### Scenario: 啟用 Provider 制顯示報到面板

- **GIVEN** 啟用 Provider 制；當日 A 診 2 張 WAITING、B 診 1 張 WAITING
- **WHEN** 商家進入 `/admin/queue`
- **THEN** 頁面頂部出現「待報到」面板，列出 3 張卡片按 takenAt 升序

#### Scenario: 未啟用 Provider 制不渲染報到面板

- **GIVEN** `Merchant.providerModeEnabled=false`；當日有 WAITING 票
- **WHEN** 商家進入 `/admin/queue`
- **THEN** 頁面不渲染 `BizQueueCheckInPanel`、現有 QueueControlPanel 與其他 UX 完全不變

#### Scenario: 卡片預帶該票當前 resource

- **GIVEN** 啟用 Provider 制；票 T1 為 `resourceId='A'`
- **WHEN** 報到面板渲染 T1 卡片
- **THEN** 指派診間下拉預選 'A 診間'

#### Scenario: 下拉 option 顯示 Provider 名稱

- **GIVEN** 啟用 Provider 制；當下 schedule 排定 A 診王醫師、B 診李醫師
- **WHEN** 報到面板下拉展開
- **THEN** option 顯示「A 診間 - 王醫師」與「B 診間 - 李醫師」

#### Scenario: 確認報到（不改派）純前端移除

- **GIVEN** T1 卡片下拉維持預帶 'A'
- **WHEN** 員工點「確認報到」
- **THEN** 前端直接從清單移除 T1，**不呼叫任何後端 API**；ticket DB 狀態不變（仍為 WAITING，仍在 A 診）

#### Scenario: 確認報到（改派）呼叫後端

- **GIVEN** T1 卡片下拉從 'A' 改成 'B'
- **WHEN** 員工點「確認報到」
- **THEN** 前端呼叫 `POST /nuxt-api/queue/[T1.id]/assign-resource { resourceId:'B' }`，成功後從清單移除 T1

#### Scenario: 空狀態提示

- **GIVEN** 啟用 Provider 制；當日無任何 WAITING 票
- **WHEN** 報到面板渲染
- **THEN** 顯示 i18n `queue.checkIn.empty`「目前無待報到顧客」，不顯示空白卡片骨架

#### Scenario: ticket providerId 為 null 時顯示「未指派」

- **GIVEN** 啟用 Provider 制；T2 票對應 resource 當下 schedule 無 Provider 命中
- **WHEN** 卡片渲染
- **THEN** Provider 列顯示 i18n `queue.checkIn.unassignedProvider`「未指派服務人員」

### Requirement: 報到改派端點 POST /queue/[id]/assign-resource

`server/routes/nuxt-api/queue/[id]/assign-resource.post.ts` SHALL 提供端點接收 `{ resourceId: string }`，將該 ticket 的 `resourceId` 更新為新值並保留原 `ticketNumber`，僅對 `status=WAITING` 的票生效。端點 MUST：

1. 套 `requireMerchant` 守衛
2. 驗 ticket 屬於該商家、`status=WAITING`、`ticketDate=今日`（商家時區）；否則回 409 `MSG_QUEUE_INVALID_STATE`
3. 驗目標 `resourceId` 屬於該 ticket service 已綁的 active Resource（`ServiceResource` 關聯 + `isActive=true` + `deletedAt IS NULL`）；否則回 400 `MSG_QUEUE_RESOURCE_INVALID`
4. 若目標 resourceId === 當前 resourceId，視為 no-op：回 200 不寫 DB、不廣播
5. 寫 `UPDATE QueueTicket SET resourceId=新值, updatedAt=NOW() WHERE id=ticketId`；若觸發唯一鍵衝突 `(merchantId, serviceId, resourceId, ticketDate, ticketNumber)` → 回 409 `MSG_QUEUE_NUMBER_TAKEN`
6. 廣播兩筆 WS：`TICKET_SKIPPED { resourceId: 舊值 }`（讓前端從舊 resource 清單移除）+ `TICKET_TAKEN { resourceId: 新值, ticketNumber, providerId, providerName }`（讓新 resource 清單插入）
7. 不改 `QueueCounter`（保留原號池序列），不寫任何新表

#### Scenario: 正常改派

- **GIVEN** T1 為 `status=WAITING, resourceId='A', ticketNumber=5`，目標 'B'（同 service 已綁的另一 active resource）
- **WHEN** `POST /nuxt-api/queue/[T1.id]/assign-resource { resourceId:'B' }`
- **THEN** ticket row 更新為 `resourceId='B', ticketNumber=5`；廣播 `TICKET_SKIPPED { resourceId:'A' }` + `TICKET_TAKEN { resourceId:'B', ticketNumber:5, ... }`；回 `{ ok: true }`

#### Scenario: 目標 resource 已有相同號碼

- **GIVEN** A 診 ticketNumber=5；B 診當日已存在 ticketNumber=5（另一張票）
- **WHEN** 嘗試改派 T1（A.5）到 B
- **THEN** 因唯一鍵衝突回 409 `MSG_QUEUE_NUMBER_TAKEN`，DB 不變、不廣播

#### Scenario: 目標 resource 不屬該 service

- **GIVEN** ticket T1 在 service S1（綁 A、B）；嘗試改派到 service S2 的 resource X
- **WHEN** `POST /queue/[T1.id]/assign-resource { resourceId:'X' }`
- **THEN** 回 400 `MSG_QUEUE_RESOURCE_INVALID`

#### Scenario: 改派 CALLED 票拒絕

- **GIVEN** T1 `status=CALLED`
- **WHEN** 嘗試改派
- **THEN** 回 409 `MSG_QUEUE_INVALID_STATE`

#### Scenario: 改派為當前 resource no-op

- **GIVEN** T1 `resourceId='A'`
- **WHEN** `POST /queue/[T1.id]/assign-resource { resourceId:'A' }`
- **THEN** 回 200 但不寫 DB、不廣播（避免無意義的 update 與 WS 干擾）

#### Scenario: 過期票拒絕

- **GIVEN** T1 `ticketDate=昨日`（商家時區）
- **WHEN** 嘗試改派
- **THEN** 回 409 `MSG_QUEUE_INVALID_STATE`

### Requirement: 商家叫號台票卡 Provider 副標

`app/components/biz/QueueControlPanel.vue` 的每張票卡渲染時 SHALL 在票號與顧客姓名之外，新增一行小字顯示 Provider 名稱：
- WAITING 列表 row
- 「服務中」區的 CALLED 卡片
- 搜尋結果 row 與歷史 row

副標格式為「{providerLabel} {providerName}」（如「王醫師」「李技師」），文案 prefix 由 `useProviderLabel` composable 依 `Merchant.providerLabel[locale]` → 商家偏好語 → i18n 預設三層 fallback 決定。當 `ticket.providerId === null` 時整列副標不渲染（dom 不出現空 div）。

#### Scenario: 啟用 Provider 制 WAITING 列表顯示副標

- **GIVEN** 啟用 Provider 制；A 診 WAITING 票 ticketNumber=5、王醫師
- **WHEN** 列表渲染
- **THEN** 該 row 顯示「5  陳先生  王醫師」（號碼 + 姓名 + Provider 副標）

#### Scenario: CALLED 卡片顯示副標

- **GIVEN** A 診 CALLED 票
- **WHEN** 服務中區渲染
- **THEN** 卡片在號碼大字下方多一行小字「王醫師」

#### Scenario: 未啟用 Provider 制不顯示副標

- **GIVEN** `Merchant.providerModeEnabled=false`
- **WHEN** 列表渲染
- **THEN** 票 row 與 CALLED 卡片皆不出現 Provider 副標（dom 不渲染對應元素）

#### Scenario: providerId 為 null 時不渲染（啟用 Provider 制下）

- **GIVEN** 啟用 Provider 制但 T2 票 `providerId=null`
- **WHEN** 列表渲染
- **THEN** T2 row 不顯示 Provider 副標，其他有 providerId 的票照常顯示

### Requirement: 顧客端全螢幕叫號蓋層 Provider 副標

`app/components/biz/QueueCallOverlay.vue` 在啟用 Provider 制商家、當前票 `providerId !== null` 時，SHALL 在主訊息「該你了 / It's your turn / あなたの番です」與副訊息「請至櫃台」之間新增一行 Provider 副標，文案格式同 `useProviderLabel` 三層 fallback。未啟用 Provider 制或 `providerId === null` 時不渲染此行（與本 change 前完全一致）。

#### Scenario: 啟用 Provider 制蓋層顯示 Provider

- **GIVEN** 啟用 Provider 制；顧客票 `providerId='wangDoc', providerName='王醫師'`
- **WHEN** WS `CALL_NEXT` 觸發蓋層
- **THEN** 蓋層自上而下顯示「該你了」「王醫師」「請至 A 診間」+ 號碼大字

#### Scenario: 未啟用 Provider 制蓋層保持現狀

- **GIVEN** `Merchant.providerModeEnabled=false`
- **WHEN** 蓋層觸發
- **THEN** 不渲染 Provider 副標行，dom 與本 change 前一致

#### Scenario: providerId 為 null 不渲染（啟用 Provider 制下）

- **GIVEN** 啟用 Provider 制；顧客票 `providerId=null`
- **WHEN** 蓋層觸發
- **THEN** 不渲染 Provider 副標行

### Requirement: useProviderLabel composable 三層 fallback

`app/composables/app/use-provider-label.ts` SHALL 匯出 composable `useProviderLabel()` 回傳函式 `formatProviderDisplay(providerName: string | null): string | null`，按以下優先序組合顯示文字：

1. 商家自訂稱呼：`Merchant.providerLabel[currentLocale]` 非空字串 → 直接回 `providerName`（商家自訂稱呼本身即為 prefix 概念，如「王醫師」直接顯示）
2. 商家偏好語：當前 locale 無值時 fallback 到 `Merchant.providerLabel[Merchant.preferredLocale]`
3. i18n 預設：以上皆無 → 用 i18n key `queue.providerPrefix.default` + ' ' + `providerName`

`providerName === null` 時直接回 `null`（呼叫端不渲染）。

#### Scenario: 商家自訂稱呼存在當前語系

- **GIVEN** `currentLocale='zh'`；`Merchant.providerLabel={ zh:'醫師', en:'Doctor', ja:'医師' }`；providerName='王'
- **WHEN** `formatProviderDisplay('王')`
- **THEN** 回「王醫師」（concat 邏輯：自訂稱呼為 suffix）

#### Scenario: 商家自訂稱呼當前語系缺失

- **GIVEN** `currentLocale='ja'`；`Merchant.providerLabel={ zh:'醫師', en:'Doctor', ja:'' }`；商家 preferredLocale='zh'
- **WHEN** `formatProviderDisplay('王')`
- **THEN** 回「王醫師」（fallback 到 zh）

#### Scenario: 商家完全沒設自訂稱呼

- **GIVEN** `Merchant.providerLabel={}`；providerName='王'
- **WHEN** `formatProviderDisplay('王')`
- **THEN** 回 i18n `queue.providerPrefix.default` 預設值 + ' 王'（zh 預設「服務人員 王」/ en「Provider Wang」/ ja「担当者 王」）

#### Scenario: providerName 為 null 直接回 null

- **WHEN** `formatProviderDisplay(null)`
- **THEN** 回 `null`，呼叫端不渲染 dom
