## Context

號碼牌系統目前在 `QueueCounter` 內維護 `lastTicketNumber`（已發到第幾號）與 `lastCalledNumber`（已叫到第幾號），公開端透過 `projectQueueServingPublic()` 投影 `currentServing` / `ticketsTaken` / `waitingCount`，但**沒有時間軸概念**：顧客看見「您是 8 號、目前叫 5 號」仍無法判斷需要等多久。

`Service` 已有 `durationMinutes`（預設 30）作為 TIME_SLOT 模式的時段長度，但這是「服務時段顆粒」而非「實際單人服務耗時」。對 QUEUE 模式而言，平均服務時長通常短於 slot 顆粒（例如剪髮店 30 分鐘 slot 但實際 15 分鐘服務）；強制共用會讓 ETA 嚴重高估。

`server/utils/queue.ts` 已有 `internalCreateTicket`、`projectQueueServingPublic`、`isWithinQueueWindow` 三支純函式集中演算法；ETA 計算需依此風格擴充，並可被 Vitest 單測獨立覆蓋。

WebSocket 廣播 payload 由 `QueueBroadcastPayload` 介面集中定義，呼叫端（`take.post.ts`、`call-next.post.ts`、`done.post.ts`、`skip.post.ts`、`create-for-customer.post.ts`）統一以 `broadcastQueue()` 發送。所有訂閱者透過 `app/stores/7.store-queue-realtime.ts/HandleMessage` 解析後 patch local state，後續 UI 反應 ETA 更新。

## Goals / Non-Goals

**Goals:**

- 顧客等待頁與商家叫號頁能看到「預估還需 X 分鐘」資訊，X 隨叫號進度即時推進。
- ETA 計算演算法純函式化、可單測，演算邏輯不散落到 route handler 或 Vue 組件。
- 商家可以設定每個服務的 `avgServiceMinutes` 校準預估值；不設則 fallback 至既有 `durationMinutes`，不破壞既有商家設定。
- WebSocket payload 直接帶 ETA 結果，避免前端為每筆事件重算或重新打 API。

**Non-Goals:**

- 不做更複雜的時間序列模型（例如歷史平均、ML 預測）；本變更採「等待人數 × 平均服務時長」線性模型。
- 不改動 `claimToken` / QR Code（Change C 範圍）。
- 不改動大螢幕 display 頁（Change D 範圍）。
- 不改動既有預約（TIME_SLOT / RESOURCE_OPTIONAL）流程；ETA 僅作用於 QUEUE 模式。
- 不顯示「絕對時刻」（例如「預計 14:35 叫到」）；初版只顯示「還需 N 分鐘」相對值，避免時鐘漂移與顧客回家後資訊過期的歧異。

## Decisions

### 1. `avgServiceMinutes` 為 nullable，留空時 fallback 到 `durationMinutes`

新增 `Service.avgServiceMinutes Int?`（非 default、可 null）。應用層讀取時 `service.avgServiceMinutes ?? service.durationMinutes` 取 effective 值。

**為什麼不直接 `@default(durationMinutes)`：** Prisma 不允許用另一欄位當 default；且既有商家在不知情下被加 default 容易誤導他們以為已校準。Nullable 表示「明確未設定，請沿用服務時長」，UI 上顯示為空字串並提示 placeholder。

**替代方案：** 在新增欄位時直接 backfill `avgServiceMinutes = durationMinutes`。否決，因為這會抹掉「未設定」與「已設定且恰好等於 durationMinutes」之間的語意差別，往後分析無法區分商家是否真的校準過。

### 2. ETA 計算為兩支純函式

```ts
// 純函式 A：給定一張票與 counter 快照，回它前面還有幾人
getTicketsAhead(ticket: { ticketNumber: number; status: QueueTicketStatus }, counter: { lastCalledNumber: number }): number

// 純函式 B：給定前面人數與平均服務時長，回預估等待分鐘
estimateWaitMinutes(waitingAhead: number, avgServiceMinutes: number): number
```

- `getTicketsAhead`：若 `ticket.status` 已為 `CALLED/DONE/SKIPPED` → 回 0；否則回 `max(0, ticket.ticketNumber - counter.lastCalledNumber - 1)`（不含自己；目前正在被服務的那一號不計）。
- `estimateWaitMinutes`：回 `Math.max(0, Math.round(waitingAhead * avgServiceMinutes))`；`avgServiceMinutes <= 0` 視為 0（避免負數/NaN 蔓延）。
- 呼叫端負責處理 fallback：`const effectiveAvg = service.avgServiceMinutes ?? service.durationMinutes`。

**為什麼拆兩支：** `getTicketsAhead` 與 `estimateWaitMinutes` 關注不同維度（票面 vs. 時間）；拆開能在「目前叫到 1 號 / 我是 5 號 / 但 2、3 號已過號」這類非連續情境擴充（未來若改抓實際 WAITING 數量）。

**為什麼用 `lastCalledNumber - 1` 而非 WAITING 計數查詢：** 純函式不能查 DB；`lastCalledNumber` 對絕大多數情境準確（線性叫號），偏差情境（過號、跳號）由 `getTicketsAhead` 的輸入端決定要不要傳更精確的 ahead 值。route handler 端在必要時可改傳 `await prisma.queueTicket.count({ where: { status: 'WAITING', ticketNumber: { lt: my.ticketNumber }, ... } })`。

### 3. 後端 API 在哪些位置補欄位

| 端點 | 新增欄位 | 計算依據 |
|------|---------|----------|
| `GET /public/queue/[id]` | `estimatedWaitMinutes: number \| null` | `getTicketsAhead(ticket, counter)` + service.avgServiceMinutes/durationMinutes |
| `GET /public/m/[slug]` 內 QUEUE service | `estimatedNextCallMinutes: number \| null` | 對「下一張 WAITING 票」估算（給領號頁卡片展示「下一位約等 X 分鐘」） |
| `GET /queue/today` 每張 WAITING 票 | `estimatedWaitMinutes: number \| null` | 同上 |
| WebSocket broadcast payload | `estimatedWaitMinutes?: number`（個別票相關）+ `avgServiceMinutes?: number`（給前端校準用） | 廣播當下計算 |

`null` 表示「無法估算」（無 counter、ticket 已結束、無相關服務）；前端對應顯示 `queue.eta.unknown`。

### 4. WebSocket payload 結構擴充

`QueueBroadcastPayload` 既有：
```ts
{ type, serviceId, current?, servingTicketId?, ticketNumber?, timestamp }
```

擴充為（新增可選欄位、保持 backward compat）：
```ts
{
  ...,
  /** 該服務目前的平均服務時長（avgServiceMinutes ?? durationMinutes），給前端對所有未叫號票估算 ETA */
  avgServiceMinutes?: number;
  /** 該事件觸發後「下一位 WAITING 票」估算的等待分鐘；前端可用來直接顯示「下一位約 X 分鐘」 */
  nextWaitMinutes?: number;
}
```

**為什麼帶 `avgServiceMinutes` 而不只是單張票的 `estimatedWaitMinutes`：** 前端 store 持有多張票（admin/queue.vue 列所有 WAITING）；如果只廣播一個值，其他票還是要前端自行算。把 `avgServiceMinutes` 廣播一次，前端用 `getTicketsAhead`（前端側 mirror 純函式）對 store 內每張票即時重算。

**取捨：** 在後端集中算每張票 ETA 並透過 WS payload 帶回所有票 → 否決，payload 體積與每次 broadcast 成本變高；且 admin 頁本來就會在 WS 事件後重打 `GetQueueToday`。

### 5. 前端共用純函式來自 `~shared`

把 `estimateWaitMinutes` 與 `getTicketsAhead` 放到 `shared/queue-eta.ts`，後端 `server/utils/queue.ts` 與前端 `app/stores/7.store-queue-realtime.ts` 共用同一份實作。

**為什麼：** 避免「後端算 8 分鐘、前端 WS 重算成 9 分鐘」的雙實作漂移。`~shared` 別名既存（見 CLAUDE.md），這是合適用例。

### 6. UI 文案策略

- 顧客等待頁：`「您前面還有 {ahead} 位 ・ 預估還需 {minutes} 分鐘」`
- 等待人數 = 0 但自己尚未 CALLED：`「即將輪到您」`（不顯示分鐘，避免 0 分鐘觀感不佳）
- 無法估算（counter 為 null 或 service 不存在）：`「預估時間尚無法計算」`
- 商家叫號頁每張 WAITING 票：右側徽章 `「約 {minutes} 分鐘後」`

三語 key：`queue.eta.aheadOfYou`、`queue.eta.estimateMinutes`、`queue.eta.almostYourTurn`、`queue.eta.unknown`。

### 7. 商家編輯介面 placement

`avgServiceMinutes` 欄位放在 admin 服務編輯表單的「服務時長」欄位之下（同一區塊），label 為「平均服務時長（分鐘）」、placeholder 顯示「留空自動沿用服務時長」、help text 「實際每位顧客的平均處理時間，用於預估等待時間顯示」。本欄位僅對 `bookingMode=QUEUE` 服務顯示（其他模式 ETA 無意義）。

## Risks / Trade-offs

- **線性 ETA 模型不精準** → 商家可隨時調整 `avgServiceMinutes` 校準；UI 文案明確標示「預估」，並提供「實際時間可能因現場狀況變動」說明（i18n key）。長期可在另一個 change 引入歷史平均回歸校正。
- **跨日不重置會殘留昨日 counter** → 既有 `projectQueueServingPublic` 已處理「無 counter 回 0」；ETA 函式輸入端只看當日 counter，不會誤帶歷史。
- **過號/跳號讓 `lastCalledNumber - 1` 偏小** → `getTicketsAhead` 第一版採此估算，誤差為「中間被跳過的票」數量；對主流場景影響小。風險可接受，未來若顧客抱怨可改抓 WAITING count。
- **WS payload 加欄位前端舊版本不認** → 全為 optional 欄位、舊前端忽略即可；TypeScript 介面 `?:` 表示可選，無 schema 衝突。
- **`durationMinutes` 對某些服務（例如 60 分鐘 spa）會讓 ETA 顯得很長且不準** → 商家應主動填 `avgServiceMinutes`；admin UI placeholder 主動提示這件事。
- **大量 WAITING 票時 admin 頁前端每張都算 ETA** → 純函式 O(1)，500 張票 < 1ms，無 perf 隱憂。

## Migration Plan

1. `prisma migrate dev --name add_service_avg_service_minutes` 產生 migration（新增 `avgServiceMinutes` nullable column）。
2. 所有既有 Service 預設 `avgServiceMinutes = NULL`，行為 fallback 至 `durationMinutes`，**完全不影響既有商家**。
3. Backend pure functions 部署上線後 ETA 立刻生效；商家校準屬於漸進操作。
4. Rollback：若 ETA 顯示有問題，前端 UI 加 feature flag `ENABLE_QUEUE_ETA` 隱藏徽章；schema column 留著（nullable 對既有資料無害）。

## Open Questions

無。商家是否要看到「自己服務的平均速度建議值」屬於未來增強，不在本變更範圍。
