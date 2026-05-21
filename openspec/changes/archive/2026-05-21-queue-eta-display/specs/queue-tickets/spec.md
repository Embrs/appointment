## ADDED Requirements

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

`GET /nuxt-api/public/queue/[id]` SHALL 在回應 body 多回 `estimatedWaitMinutes: number | null` 欄位，由後端對該票執行 `estimateWaitMinutes(getTicketsAhead(ticket, counter), effectiveAvg)` 計算得出，`effectiveAvg = service.avgServiceMinutes ?? service.durationMinutes`。

#### Scenario: 等待中票

- **GIVEN** ticket WAITING、票號 8、counter.lastCalledNumber=5、service.avgServiceMinutes=10
- **WHEN** GET `/public/queue/[id]`
- **THEN** 回應 body 含 `estimatedWaitMinutes: 20`（前面 2 人 × 10 分鐘）

#### Scenario: CALLED 票

- **GIVEN** ticket status=CALLED
- **WHEN** GET
- **THEN** 回應 body 含 `estimatedWaitMinutes: 0`

#### Scenario: DONE/SKIPPED 票

- **GIVEN** ticket status=DONE 或 SKIPPED
- **WHEN** GET
- **THEN** 回應 body 含 `estimatedWaitMinutes: 0`

#### Scenario: counter 不存在

- **GIVEN** ticket 存在但當日 counter 不存在（理論上不應發生但需 graceful 處理）
- **WHEN** GET
- **THEN** 回應 body 含 `estimatedWaitMinutes: null`

#### Scenario: service.avgServiceMinutes 為 null 時 fallback

- **GIVEN** ticket WAITING、票號 8、counter.lastCalledNumber=5、service.avgServiceMinutes=null、service.durationMinutes=20
- **WHEN** GET
- **THEN** 回應 body 含 `estimatedWaitMinutes: 40`（前面 2 人 × 20 分鐘 fallback）

### Requirement: 公開查詢領號頁回傳下一位 ETA

`GET /nuxt-api/public/m/[slug]` SHALL 對每個 `bookingMode=QUEUE` 服務在既有 `currentServing/waitingCount/ticketsTaken` 之外多回 `estimatedNextCallMinutes: number | null`，代表「下一位等待中的人預計要等多久才被叫到」。計算方法為 `estimateWaitMinutes(max(0, waitingCount - 1), effectiveAvg)` 或 0（已無人等候）。

#### Scenario: 含 ETA 欄位

- **GIVEN** QUEUE 服務 A、當日 ticketsTaken=10、currentServing=5、avgServiceMinutes=10
- **WHEN** GET `/public/m/[slug]`
- **THEN** services A 物件含 `estimatedNextCallMinutes: 40`（下一位前面還有 4 人，等 40 分鐘；解讀方式：`waitingCount=5` 中扣掉「下一位自己」剩 4 人）

#### Scenario: 無等待

- **GIVEN** QUEUE 服務 ticketsTaken=5、currentServing=5
- **WHEN** GET
- **THEN** services 物件含 `estimatedNextCallMinutes: 0`（無人等候，下一位即刻被叫）

#### Scenario: 無 counter

- **GIVEN** QUEUE 服務當日無 counter（尚未開始）
- **WHEN** GET
- **THEN** services 物件含 `estimatedNextCallMinutes: null`

#### Scenario: 非 QUEUE 服務不含欄位

- **GIVEN** 服務 C 為 TIME_SLOT
- **WHEN** GET
- **THEN** services C 物件不含 `estimatedNextCallMinutes`（與既有不含 currentServing/waitingCount 規則一致）

### Requirement: 商家當日總覽回傳 ETA

`GET /nuxt-api/queue/today` SHALL 在每張 `WAITING` 票多回 `estimatedWaitMinutes: number | null` 欄位，由後端對該票套用 ETA 純函式計算。`CALLED/DONE/SKIPPED` 票回 0 或 null（依純函式語意）。response 同時 SHALL 對每個 service 多回該服務的 `avgServiceMinutes: number`（effective 值，含 fallback）以利前端校準。

#### Scenario: WAITING 票含 ETA

- **GIVEN** 商家當日有 service A 三張 WAITING 票（票號 6/7/8）、counter.lastCalledNumber=5、service.avgServiceMinutes=10
- **WHEN** GET `/queue/today`
- **THEN** 三張票分別含 `estimatedWaitMinutes: 0, 10, 20`

#### Scenario: response 含 service 層級 avg

- **GIVEN** 商家當日有 service A、avgServiceMinutes=10
- **WHEN** GET
- **THEN** services A 物件含 `avgServiceMinutes: 10`

#### Scenario: service 未設定時為 fallback 值

- **GIVEN** service B `avgServiceMinutes=null`、`durationMinutes=20`
- **WHEN** GET
- **THEN** services B 物件含 `avgServiceMinutes: 20`（effective fallback；後端 normalize 後輸出）

### Requirement: WebSocket 廣播 payload 含 ETA 推進依據

`QueueBroadcastPayload` SHALL 在既有欄位之外多帶 `avgServiceMinutes?: number`（該事件對應 service 的 effective 平均服務時長）與 `nextWaitMinutes?: number`（下一位 WAITING 票的預估等待分鐘）。所有呼叫 `broadcastQueue` 的端點（`take`、`call-next`、`done`、`skip`、`create-for-customer`）SHALL 帶上這兩個欄位，讓所有訂閱端可即時推進 UI ETA。

#### Scenario: 叫號廣播帶 ETA

- **GIVEN** 商家叫號成功、service A `avgServiceMinutes=10`、叫號後 currentServing=5、剩 4 張 WAITING
- **WHEN** `broadcastQueue` 廣播 `CALL_NEXT`
- **THEN** payload 含 `avgServiceMinutes: 10`、`nextWaitMinutes: 30`（下一位前面 3 人 × 10 分鐘）

#### Scenario: 領號廣播帶 ETA

- **GIVEN** 顧客領號成功、service A `avgServiceMinutes=10`、領號後 ticketsTaken=10、currentServing=5
- **WHEN** `broadcastQueue` 廣播 `TICKET_TAKEN`
- **THEN** payload 含 `avgServiceMinutes: 10`、`nextWaitMinutes: 40`（下一位前面 4 人 × 10 分鐘）

#### Scenario: 完成/跳號廣播帶 ETA

- **WHEN** `broadcastQueue` 廣播 `TICKET_DONE` 或 `TICKET_SKIPPED`
- **THEN** payload 含 `avgServiceMinutes` 與 `nextWaitMinutes`（基於該事件後的最新 counter 狀態）

#### Scenario: 舊版前端忽略新欄位

- **GIVEN** 前端 store 未升級
- **WHEN** 收到含新欄位的 payload
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
