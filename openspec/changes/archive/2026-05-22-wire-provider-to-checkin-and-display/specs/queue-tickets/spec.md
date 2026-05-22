## ADDED Requirements

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

## MODIFIED Requirements

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
