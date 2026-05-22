## ADDED Requirements

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

- **GIVEN** QUEUE service A 綁 X、Y；X currentServing=5、waitingCount=3；Y currentServing=2、waitingCount=1
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

## MODIFIED Requirements

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
- **THEN** 視為新票（不同號池），建立成功並回新 `ticketNumber`、`claimToken`

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

The system SHALL allow merchants to mark a CALLED ticket as DONE or SKIPPED, with each operation broadcasting to subscribed peers. body SHALL **不**新增 `resourceId` 參數（票上已存 `resourceId`）；廣播 payload SHALL 帶上 `ticket.resourceId` 與對應 `resourceName`，使訂閱端能正確分群更新。

#### Scenario: 標完成（票對應 resource）

- **GIVEN** ticket status=CALLED、resourceId=X
- **WHEN** POST `/nuxt-api/queue/[id]/done`
- **THEN** status=DONE、doneAt=now()、廣播 `TICKET_DONE { resourceId: X, resourceName: 'X', ... }`；回該票

#### Scenario: 標完成（票未綁 resource）

- **GIVEN** ticket resourceId=null
- **WHEN** POST done
- **THEN** 廣播 payload `resourceId: null`、原行為不變

#### Scenario: 標過號

- **WHEN** POST `/nuxt-api/queue/[id]/skip`
- **THEN** status=SKIPPED、廣播 `TICKET_SKIPPED { resourceId, resourceName, ... }`

#### Scenario: 狀態非 CALLED

- **GIVEN** ticket status=WAITING
- **WHEN** POST done
- **THEN** 回 400 `MSG_QUEUE_INVALID_TRANSITION`

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
