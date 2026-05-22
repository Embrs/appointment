## ADDED Requirements

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

`app/pages/m/[slug]/display.vue` SHALL 在當前 ActiveService 綁 `resources.length >= 2` 時，以 CSS grid 分區呈現各 resource 的叫號狀態：
- `resources.length === 2`：左右兩欄（`grid-template-columns: 1fr 1fr`）
- `resources.length >= 3`：`grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))`

每個 cell SHALL 顯示：`{resourceName}` 大字 + 該 resource 當前 `currentServing` 號碼大字 + 副標 `display.gotoRoom`（「請至 {room}」）+ 「下位 / 等候」資訊。`resources.length <= 1` 或未綁 resource（`resources[0].id === null`）SHALL 走本變更前單一全螢幕 layout。

#### Scenario: 2 resource 顯示左右兩格

- **GIVEN** service 綁 A、B 兩 resource，A 當前 currentServing=3、B 當前 currentServing=5
- **WHEN** /display 自動或手動選中該 service
- **THEN** 主畫面呈左右兩格，左格大字「A 診間 / 3」「請至 A 診間」，右格大字「B 診間 / 5」「請至 B 診間」

#### Scenario: 3 resource 自適應 grid

- **GIVEN** service 綁 A、B、C 三 resource
- **WHEN** /display 選中該 service
- **THEN** 主畫面以 `grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))` 排列三個 cell，視窗寬度 1280px 時並列 3 欄，768px 時自適應換行

#### Scenario: 未綁 resource 走單一全螢幕（迴歸保護）

- **GIVEN** service 未綁 resource（`resources=[]` 或 `resources=[{id:null}]`）
- **WHEN** /display 選中該 service
- **THEN** 主畫面為本變更前的單一全螢幕 layout（單一大號碼、單一副標），無左右兩格分區

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
