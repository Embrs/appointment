---
name: 號碼牌即時系統
description: QueueTicket/Window/Counter 三表協作、WebSocket 廣播、前端 store WS+輪詢雙軌、cron 清理、商家叫號台 UX（含多 resource 子卡 + segmented control + Provider 副標 + 報到台 + 大螢幕多欄 Provider header）
type: reference
---

# 號碼牌即時系統

號碼牌全棧：DB 三表 + Nitro WebSocket + 前端 `StoreQueueRealtime` + cron 清理 + 商家叫號台 UX + 報到台（啟用 Provider 制商家）+ 大螢幕多欄 Provider header。

## 三表協作

| 表 | 用途 |
|----|------|
| `QueueWindow` | 領號時間窗（按 `weekday`）；`maxTickets=0` 表示無限 |
| `QueueTicket` | 當日號碼牌；唯一鍵 `(merchantId, serviceId, ticketDate, ticketNumber)`；`customerPhone` 可為 `null`（商家現場代建未留電話）；`createdByMerchant` 區分票券來源（公開拿號 = false / 後台代建 = true）；`claimToken` 為 8 碼 nanoid 唯一索引（partial unique `WHERE claimToken IS NOT NULL`），歷史 row 為 null |
| `QueueCounter` | 叫號游標；唯一鍵 `(merchantId, serviceId, counterDate)`，內含 `lastTicketNumber`（發到第幾號）+ `lastCalledNumber`（叫到第幾號） |

> ticketDate 一律用 **merchant timezone** 下的今日，工具見 `server/utils/queue.ts/getTicketDateString`（用 `Intl.DateTimeFormat('en-CA')`）。

## 後端 API 範圍

`server/routes/nuxt-api/queue/` + `public/queue/`：

| Endpoint | 動作 | 守衛 |
|----------|------|------|
| `GET /queue/today` | 商家當日列表（含 `customerPhone: string \| null` 與 `createdByMerchant`） | merchant |
| `POST /queue/call-next` | 叫下一號（advisory lock + Counter 加一） | merchant |
| `POST /queue/create-for-customer` | 商家現場代客領號（共用 `internalCreateTicket`；跳過 QueueWindow 時間窗校驗；phone 可省略） | merchant |
| `POST /queue/[id]/done` | 標記完成 | merchant |
| `POST /queue/[id]/skip` | 跳號 | merchant |
| `GET /queue/ws` | WebSocket 訂閱 | 無（MVP 公開） |
| `GET /merchant/queue-window` | 讀取某 QUEUE 服務的整週領號時段（query `serviceId`） | merchant |
| `PUT /merchant/queue-window` | 整批覆寫某 QUEUE 服務的整週領號時段（事務內 deleteMany + createMany） | merchant |
| `POST /public/queue/take` | 顧客領號（外層 RateLimit + QueueWindow 時間窗校驗，內層委派 `internalCreateTicket`） | 公開 |
| `GET /public/queue/[id]` | 顧客查號 | 公開 |
| `GET /public/queue/claim/[token]` | 顧客以 claim token（QR 掃碼入口）取回當日票券；雙桶 RateLimit（IP 30/60s + token 20/60s），僅命中當日 + status ∈ WAITING/CALLED；不洩漏 customerPhone/lastName/title | 公開 |

> `GET /public/m/[slug]` 對每個 `bookingMode=QUEUE` service 多回 `currentServing` / `ticketsTaken` / `waitingCount`（值由 `projectQueueServingPublic(counter)` 純函式組裝；無 counter 一律 0）。給領號頁初始載入用，WS 接手後續更新。

## 領號流程

兩條路徑共用 `server/utils/queue.ts/internalCreateTicket()` 純函式（Counter `FOR UPDATE`、advisory lock、唯一鍵防併發、寫票）；廣播 `TICKET_TAKEN` 由呼叫端負責。codebase 中 `prisma.queueTicket.create` 僅在 `internalCreateTicket` 內出現一次。

`internalCreateTicket` 在交易內以 `generateClaimToken()`（`nanoid` customAlphabet 8 碼，排除 `0/O/o/1/I/l`）寫入 `QueueTicket.claimToken`；若觸發 `P2002` 唯一鍵衝突（極罕見），整段交易換新 token 重試一次。回傳的 `result.ticket.claimToken` 由 take.post.ts / create-for-customer.post.ts 直接放進 response body。

### 公開端：`/public/queue/take`（顧客）

1. RateLimit（IP 5/分 + phone 3/分）
2. 驗 BookingMode = `QUEUE`（否則 400 `MSG_NOT_QUEUE_SERVICE`）
3. 用 `isWithinQueueWindow(windows, timezone, now)` 校驗當前在 `QueueWindow` 內（按 weekday + `HH:mm` 字串比較；`time >= startTime && time < endTime`）→ 400 `MSG_QUEUE_WINDOW_CLOSED`
4. 委派 `internalCreateTicket({ ..., phone, createdByMerchant: false, maxTickets })`
   - 同手機今日 WAITING/CALLED 已領 → 409 `MSG_QUEUE_ALREADY_TAKEN`
   - `maxTickets > 0` 且已達上限 → 409 `MSG_QUEUE_FULL`
5. 事務內 `Counter.lastTicketNumber += 1` + `create QueueTicket(status=WAITING, customerPhone=phone, createdByMerchant=false)`
6. 廣播 `TICKET_TAKEN` 給 ws peer

### 商家代建端：`/queue/create-for-customer`（櫃台 walk-in）

1. `requireMerchant` 守衛
2. 驗 service ownership + BookingMode = `QUEUE`
3. **跳過時間窗校驗**，僅校驗該 service 至少存在一筆 QueueWindow 設定（陣列空視為商家明確關閉 → 400 `MSG_QUEUE_WINDOW_CLOSED`）
4. 取當日 weekday 的 active QueueWindow 拿 `maxTickets`（找不到視為 0 = 不限）
5. 委派 `internalCreateTicket({ ..., phone: phone | null, createdByMerchant: true, maxTickets })`
   - **phone 為 null 不套用「同人同日重複領號」規則**（多張未留電話票合法）
   - 同 phone 已 WAITING/CALLED（phone 非 null 時）→ 409 `MSG_QUEUE_ALREADY_TAKEN`
   - maxTickets 達上限 → 409 `MSG_QUEUE_FULL`
6. 廣播 `TICKET_TAKEN`（admin/queue.vue 透過 WS `watch(lastEventAt)` 自動重抓 `GetQueueToday`）

> 兩條路徑共用同一 `QueueCounter` 序號池：公開端 + 商家端同時拿號分別得到連號（FOR UPDATE 序列化保證）。

## 叫號流程（`POST /queue/call-next`）

1. 商家點「下一號」
2. 取 advisory lock + Counter row lock
3. 找 `status=WAITING` 且 `ticketNumber > Counter.lastCalledNumber` 的第一張
4. 更新 `ticket.status=CALLED`、`Counter.lastCalledNumber=ticket.ticketNumber`
5. 廣播 `CALL_NEXT { serviceId, current, servingTicketId }` 給所有 ws peer
6. 沒有等待中號碼 → 400 `MSG_QUEUE_NO_WAITING`

`done` / `skip` 改 `status` 後分別廣播 `TICKET_DONE` / `TICKET_SKIPPED`，並把 `Counter.servingTicketId` 對應清空。

## WebSocket（Nitro）

啟用：`nuxt.config.ts.nitro.experimental.websocket: true`。

| 項目 | 設計 |
|------|------|
| 端點 | `GET /nuxt-api/queue/ws?merchantId=xxx` |
| 認證 | MVP 不鑑權（號碼牌是店面公開資訊）；寫入仍走 HTTP + merchant token |
| peer 管理 | `server/utils/queue.ts/peerMap: Map<merchantId, Set<Peer>>`、`addPeer`/`removePeer` |
| 心跳 | client 每 25s 送 `'ping'` 字串，server 回 `'pong'` |
| 廣播 payload | `{ type, serviceId, current?, servingTicketId?, ticketNumber?, timestamp }`；type 為 `CALL_NEXT` / `TICKET_DONE` / `TICKET_SKIPPED` / `TICKET_TAKEN` / `HELLO` |
| broadcast 失敗處理 | 單 peer 失敗 try/catch 後繼續，不影響其他 peer |

## 前端 StoreQueueRealtime

`app/stores/7.store-queue-realtime.ts`：

| 對外 API | 用途 |
|----------|------|
| `Connect(merchantId)` | 開 WS（`UseWS`）+ 啟動 15s 輪詢兜底 |
| `Disconnect()` | 斷 WS + 停輪詢；離開頁面必呼叫 |
| `SetMyTicket(id, ticket)` / `ClearMyTicket()` | 顧客端記錄自己的票 |
| `RefreshMyTicket()` | 強制立即抓最新狀態 |

**雙軌制**：WS 為主、HTTP 15s 輪詢為 fallback；`isWsConnected === true` 時跳過輪詢避免重複。`HandleMessage` 解析 WS 廣播後直接 patch `serviceMap` 與 `myTicket`。

`UseWS` 設定：`reconnectOnClose: true`、`heartbeatMsg: 'ping'`、`expectPong: true`、`parseJSON: true`。

## 店面大螢幕顯示頁

`/m/{slug}/display`（`app/pages/m/[slug]/display.vue`）：純前端、無認證、全螢幕投影用。

- **Layout 切換**：`definePageMeta({ layout: 'front-desk', displayMode: true })` → `app/layouts/front-desk.vue` 讀 `useRoute().meta.displayMode` 後隱藏 header、移除內距、改深色背景。Nuxt 不支援 `layoutProps`，所以走 route meta 而非 layout props。
- **資料來源**：初始 snapshot 用 `$api.GetPublicMerchant({ slug })`（取每個 QUEUE service 的 `currentServing` / `ticketsTaken` / `waitingCount` / `avgServiceMinutes`）；之後完全靠 `StoreQueueRealtime.Connect(merchantId)` 既有 WS + 15s 輪詢更新 `serviceMap[serviceId]`。
- **多服務處理**：頁面鎖定單一 serviceId — query `?serviceId=xxx` 顯式指定；無 query 則自動挑「當日有 WAITING 且 currentServing 最小」者；toolbar `ElSelect` 提供手動切換（只在 ≥ 2 個 QUEUE 服務時顯示）。
- **動畫**：`watch(CurrentServing)` 偵測號碼變化，重置 `:key="animateKey"` 讓 `.PageDisplay__bigNumber--animate` 重播 CSS `@keyframes pageDisplayCallNext`（0.6s ease-out，scale 1→1.08→1，色相白→金→白）。
- **TTS 廣播（可選）**：`UseTts` composable（`app/composables/app/use-tts.ts`），用 `window.speechSynthesis`，依 i18n locale 透過 `TtsLangMap` 映射成 BCP47（`zh→zh-TW`、`en→en-US`、`ja→ja-JP`）。預設關閉、localStorage `queueDisplayTts` 持久化；同號碼不重播；切換 service 時清空 `lastSpokenNumber`，避免切換瞬間突發語音；首次 Toggle 開啟時 `Speak('')` 解鎖 iOS Safari user-gesture 限制；`'speechSynthesis' in window` 為 false 時 toggle disabled。文案模板：i18n key `display.tts.callPhrase`，帶 `{number, serviceName}`。
- **Admin 入口**：`app/pages/admin/queue.vue` 頂部 `#actions` 加「開啟顯示頁」+「複製連結」雙按鈕；slug 從 `$api.GetSelfMerchant()` 取（StoreSelf 沒存 slug）。無 QUEUE 服務時兩按鈕 disabled + tooltip `display.needQueueService`。
- **響應式**：1920×1080 主視覺（左 60% / 右 40%，目前叫號字級 `clamp(160px, 18vw, 280px)`）；≤ 1023px 切「上下兩欄」（上 55vh 顯示叫號、下方 2 欄卡片）；用 `vw / clamp()` 自動縮放避免 media query 多斷點。
- **不訂閱顧客私有資料**：display 頁不呼叫 `SetMyTicket / RefreshMyTicket`；只讀 `serviceMap`。

### 商家投影使用說明

1. 商家後台 `/admin/queue` 點「開啟顯示頁」→ 新分頁開 `/m/{slug}/display`。
2. 投影裝置可改用「複製連結」按鈕的 URL 在另一台機器/平板開啟。
3. URL 可加 `?serviceId={id}` 鎖定特定服務（多 QUEUE 商家可分別投不同 service）。
4. TTS 須在裝置上手動點 toolbar toggle 開啟（避免不期而至的語音）；iOS Safari 需此手動點擊才能解鎖。
5. 建議解析度：1920×1080 / 1280×720（小投影機） / 768×1024（直立平板）。

## 顧客掃碼 claim token 入口

`/m/{slug}/queue/status` 支援雙入口：

| query | 來源 | 行為 |
|-------|------|------|
| `?token=...`（最高優先） | QR 掃碼 / walk-in 列印小單 | 呼叫 `$api.GetQueueClaim({ token })` → `/public/queue/claim/[token]`；失敗（404/429）顯示 `queue.claim.tokenExpired` 並導向 `/queue/find` |
| `?id=...`（無 token 時） | 領號 localStorage 自動還原 / 手機末 4 碼回查 | 沿用 `$api.GetQueueTicket({ id })`，零行為變化 |

QR 內容固定為 `${window.location.origin}/m/{slug}/queue/status?token={claimToken}`：
- `app/components/open/dialog/queue-claim-qr.vue`（顧客領號成功 dialog）動態 `import('qrcode')` 在 Canvas render；載入失敗 fallback 顯示純文字 URL + 短碼。
- `app/components/open/dialog/queue-walk-in.vue` 列印區（`@media print`）同樣動態 import 在 Canvas render，QR 邊長 ≥ 32mm、`page-break-inside: avoid`；需從呼叫端傳 `merchantSlug`（`admin/queue.vue` 由 `$api.GetSelfMerchant()` 取得後注入）。

token 安全約束（防洩漏）：
- 不可猜測：8 碼 nanoid（~2^46 組合）；
- 時效：限當日 + 狀態 ∈ `WAITING/CALLED`，其餘一律 `notFoundError` 不洩漏存在性；
- 速率：`queue-claim-ip:{ip}` 30/60s + `queue-claim-token:{token}` 20/60s 雙桶（皆走 `checkRateLimit`）；
- 內容：response 不含 `customerPhone/customerLastName/customerTitle`（與手機末 4 碼回查同基準）。

## ETA 預估等待時間

純函式集中於 `shared/queue-eta.ts`，前後端共用避免雙實作漂移（`server/utils/queue.ts` re-export；`app/stores/7.store-queue-realtime.ts` 與 `BizQueueControlPanel.vue` 直接 import）。

| 函式 | 簽名 | 行為 |
|------|------|------|
| `getTicketsAhead` | `(ticket, counter) → number` | WAITING 票回 `max(0, ticketNumber - lastCalledNumber - 1)`；CALLED/DONE/SKIPPED 一律回 0 |
| `estimateWaitMinutes` | `(waitingAhead, avgServiceMinutes) → number` | `Math.round(waitingAhead × avg)`；avg ≤ 0 或非有限數一律回 0 |

`server/utils/queue.ts` 進一步包了三支 helper：

- `getEffectiveAvgServiceMinutes(service)` — `service.avgServiceMinutes ?? service.durationMinutes`
- `computeTicketEtaMinutes(ticket, counter, service)` — counter=null 回 null；其餘按純函式
- `computeNextWaitMinutes(counter, ticketsTaken, service)` — 給 `/public/m/[slug]` 卡片用
- `buildBroadcastEtaFields(counter, ticketsTaken, service)` — 廣播 payload 補 `avgServiceMinutes` + `nextWaitMinutes`

### API 欄位

| 端點 | 新欄位 |
|------|--------|
| `GET /public/queue/[id]` | `estimatedWaitMinutes: number \| null`、`avgServiceMinutes: number` |
| `GET /public/m/[slug]`（QUEUE service） | `estimatedNextCallMinutes: number \| null`、`avgServiceMinutes: number` |
| `GET /queue/today` | 每 service 多 `avgServiceMinutes`、每 ticket 多 `estimatedWaitMinutes` |

### WS 廣播 payload

`QueueBroadcastPayload` 既有欄位之外新增：
- `avgServiceMinutes?: number` — 該服務的 effective 平均服務時長
- `nextWaitMinutes?: number | null` — 廣播當下下一位 WAITING 票的預估等待分鐘

所有呼叫 `broadcastQueue` 的端點都透過 `buildBroadcastEtaFields(counter, ticketsTaken, service)` 一致補欄位；前端 `HandleMessage` 收到後更新 `serviceMap[serviceId].avgServiceMinutes`，配合 `currentServing` 推進讓所有票的 ETA 即時重算。

### 商家設定

`Service.avgServiceMinutes Int?` 為可選欄位；UI 在 `app/components/open/dialog/service-edit.vue` 僅對 `bookingMode=QUEUE` 顯示，空字串送出時轉為 null（後端 fallback 至 `durationMinutes`）。

## 商家叫號台 UX（admin/queue.vue + BizQueueControlPanel）

`app/pages/admin/queue.vue` + `app/components/biz/QueueControlPanel.vue`：商家現場叫號控制台，2026-05-21 refine 後動作層級與資訊架構如下。

### 頁首

- **Split-button「開啟顯示頁」**：`ElDropdown split-button type="primary"`；主按鈕 click → `window.open('/m/{slug}/display', '_blank')`；箭頭下拉內含「複製連結」。整顆 disabled 條件 `!HasAnyQueueService`，外包 `ElTooltip :disabled="HasAnyQueueService"` 反向觸發 `display.needQueueService` 提示。
- **連線狀態 chip**：`即時連線中` / `連線中斷` 兩態（i18n key `admin.queue.conn.{live,off}`），用 `margin-left: auto` 推到 headerActions 右側。

### 卡片動作層級

| 層級 | 元素 | 觸發 |
|------|------|------|
| 卡片頂層 | 「叫下一號」（type=primary）+「現場登記」（default） | emit `click-call-next` / `click-walk-in` |
| 服務中區 row | 每張 CALLED 票各掛「完成」（type=success）+「過號」（type=warning）| emit `click-done(ticketId)` / `click-skip(ticketId)` |

**重要**：卡片頂層**沒有**「完成 / 過號」按鈕；多張 CALLED 共存時必須從 serving row 內各自操作。原因：`call-next` 不擋既有 CALLED，多工位場景下會累積，固定綁 `CalledTickets[last]` 會卡住先叫的票。

### 服務中區（多 CALLED 並列）

- `ServingTickets = tickets.filter(status === 'CALLED').sort(byTicketNumber)`
- 空狀態文案 `admin.queue.serving.empty`（data-testid `queue-serving-empty`）
- **row 級 loading**：`inflightDoneIds` / `inflightSkipIds` 兩個 `Set<string>`；`watch(service.tickets)` 偵測 ticket 不再 CALLED 時自動清除，避免單一頁面 `actionLoading` flag 鎖死所有按鈕

### 列表 tabs + 搜尋

- **狀態 tabs**（自製 segmented control，非 ElTabs）：`waiting`（預設）/ `called` / `history`；每個 tab 顯示計數 `（{n}）`
- **搜尋字串跨 tab 保留**（切 tab 不清空 `searchInput`）
- **比對策略**（`MatchTicket` 純函式）：
  - 純數字 ≤ 4 碼：匹配 `String(ticketNumber)` 與其 `padStart(2, '0')` 形式（讓「07」也能命中 ticketNumber=7），OR `customerPhone.slice(-4)` 包含
  - 純數字 > 4 碼：僅 phone 末 4 比對
  - 非純數字：匹配 `customerLastName` 包含
- **列表本體** `max-height: min(60vh, 480px)` + `overflow-y: auto`；搜尋空狀態文案 `admin.queue.search.empty` 配「清除搜尋」link button（`queue-search-clear`）

### RWD 三斷點

| 斷點 | grid | 卡片動作 | toolbar | serving row |
|------|------|---------|---------|-------------|
| ≥ 1280px | `auto-fill, minmax(360px, 1fr)` | 主+次 row | row | row |
| 768–1279px | `auto-fill, minmax(320px, 1fr)`、按鈕 `min-height: 44px` | 主+次 row | row | row |
| < 768px | 單欄 | column，叫下一號/現場登記 100% 寬 | column、tabs 橫向 `overflow-x: auto` | `flex-wrap: wrap`，按鈕區換行右對齊 |

### i18n keys

集中於 `admin.queue.*`：
- `tabs.{waiting,called,history,countSuffix}`
- `search.{placeholder,empty,clear}`
- `serving.empty`
- `conn.{live,off}`

按鈕文案沿用既有 `queue.page.markDone/markSkip`、ticket 狀態沿用 `queue.status.*`。

### 既有測試 selector

- `admin-open-display-btn` / `admin-copy-display-link-btn`（split-button）
- `queue-walk-in-entry`、`queue-no-window-alert`、`queue-row-eta`（不破）
- 2026-05-21 refine：`queue-call-next-btn`、`queue-serving-row`、`queue-serving-empty`、`queue-row-done-btn`、`queue-row-skip-btn`、`queue-tab-{waiting,called,history}`、`queue-search-input`、`queue-search-clear`、`queue-list-empty`
- 2026-05-21 多 resource：`queue-call-next-btn-{resourceId|null}`、`queue-walk-in-entry-{resourceId|null}`、`queue-resource-card-{resourceId|null}`、`queue-operating-seg-{resourceId}`

## 商家叫號台多 Resource 子卡（admin/queue 進階版）

2026-05-21 階段 2 把「一個 service = 一張卡」擴成「一個 service 依綁定 resources 渲染並列子卡」，沿用上節既有單卡 UX（tabs / 搜尋 / 多 CALLED row 級操作）並下沉到每張子卡 scope。

### 資料來源契約

- `GET /queue/today` 每個 service 回 `resources: [{ id, name, displayOrder, isActive, lastTicketNumber, lastCalledNumber, tickets }]`
- 未綁 resource 的 service 回 fallback `[{ id: null, name: null, ... }]`（前端不再走兩條路徑）
- 已綁但歷史票指向已停用/解綁 resource 時，後端仍輸出該 resource slot 標 `isActive: false`，前端不刪、不擋

### 渲染決策

| `service.resources` | 渲染 |
|---------------------|------|
| 唯一元素 `id === null` | 退化為單卡（外觀 1:1 同舊版；無子卡標題、無 segmented control） |
| 唯一元素 `id !== null` | 1 張子卡（顯示 resource name；無 segmented control） |
| ≥ 2 個元素（且至少 1 個 `id !== null`） | 多張子卡並列 + segmented control「目前操作」 |

### Segmented control「目前操作」

- **localStorage key** `queueOperatingResource:{merchantId}:{serviceId}` 持久化選中 resourceId
- 啟動時若 stored 值不在當前 `resources` 內，fallback `resources[0].id` 並回寫
- 切換時 `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` + 1 秒高亮邊框 (`@keyframes bizQueueResourceFocus`)
- **不鎖權限**：未選中的子卡仍可點所有按鈕（segmented control 只做視覺輔助）
- watch `service.resources` 變化，選中 resource 被停用/刪除時自動 fallback 並寫回 localStorage

### 簽名擴充

| Emit | 簽名 | 注意 |
|------|------|------|
| `click-call-next` | `(serviceId, resourceId: string \| null)` | `ApiCallNext` body 在 `resourceId` 非 null 時帶上 |
| `click-walk-in` | `(serviceId, resourceId: string \| null, resourceName: string \| null)` | 開 walk-in dialog 時注入 `resourceId/resourceName` |
| `click-done` / `click-skip` | `(ticketId)`（不變） | ticket 上已存 `resourceId` |

### 現場登記彈窗（queue-walk-in.vue）

`DialogQueueWalkInParams` 新增 `resourceId?: string \| null` 與 `resourceName?: string \| null`。
- 開啟方注入；單一號池傳 `null`
- 標頭顯示 `「{serviceName}・{resourceName}」`（有 resource 才加後綴）
- submit 時 body 僅在 `resourceId` truthy 才帶上（避免送 null 到 zod `.optional()`）
- 後端 `validateResourceIdForQueueService` 處理三態：service 綁 resource 但 body 沒帶 → `REQUIRED`；body 有 resourceId 但 service 未綁或 resourceId 不屬此 service → `INVALID`；其餘合法

### RWD（基於父層 admin/queue grid）

- `admin/queue.vue` 父 grid `repeat(auto-fill, minmax(360px|320px, 1fr))`，多 resource panel 用 `.BizQueueControlPanel--multi-resource` 類加 `grid-column: span 2`（≥ 768px）/ `span 3`（≥ 1640px），確保子卡能橫排
- 子卡內部容器 `.BizQueueControlPanel__resources` 在 ≥ 1280px 用 `repeat(auto-fit, minmax(360px, 1fr))`、768–1279px 用 `minmax(320px, 1fr)`、< 768px 單欄
- segmented control < 768px `overflow-x: auto` + `flex-wrap: nowrap`，避免換行

### i18n keys（2026-05-21 新增）

- `admin.queue.operatingRoom.label`：segmented control 標題
- `service.edit.queueResourcesLabel` / `service.edit.queueResourcesHint`：service-edit 彈窗於 QUEUE 模式的條件化文案

### Service 編輯彈窗解除限制

`service-edit.vue` 的 `showResource` 白名單加入 `'QUEUE'`，並把 `BuildPayload` 內 QUEUE 早返支路補上 `resourceIds: [...form.resourceIds]`，讓 QUEUE service 可在前端綁定 0~N 個 resource。

### 階段 1 nullable compound key 修補

`QueueCounter` 唯一鍵含 nullable `resourceId`，Prisma compound-unique upsert 不接受 null。`internalCreateTicket` 與 `call-next.post.ts` 改用：
1. `tx.$executeRaw\`SELECT 1 FROM "Service" WHERE id = \${serviceId} FOR UPDATE\`` 鎖 service row 序列化
2. `tx.queueCounter.findFirst` + 不存在才 `create`

避免兩個 transaction 同時建立同 (serviceId, resourceId=null, ticketDate) 的 counter 重複列。

## Cron 清理

`POST /nuxt-api/cron/archive`（見 [deploy-and-env.md](./deploy-and-env.md#cron-jobs)）每日清理：

- `QueueCounter` > 30 天的全刪
- `Appointment` 完成 90 天搬到 Archive
- `RateLimitBucket` > 1 小時清理
- `QueueTicket` 目前**不自動清理**（按 `ticketDate` 區分當日，歷史保留）

## Provider 串接（2026-05-22 新增；wire-provider-to-checkin-and-display）

`QueueTicket` / `QueueCounter` / `Resource` **不動 schema**；Provider 一律從 `Schedule*.providerId + resourceId` 反查。

### 後端 helper

`server/utils/queue.ts/resolveProviderByResourceMap(merchantId, now)`：

- 商家 `providerModeEnabled=false` → 立即回空 Map（短路，不查 schedule）
- 一次查當日 `ScheduleOverride` + 本週 `ScheduleRule`（皆要求 `scope=PROVIDER`、`providerId 非 null`），以商家時區 weekday + HH:mm 過濾命中時段
- **Override 優先 Rule**（同 resource 有 Override 命中時忽略 Rule）
- 同 resource 命中多 Provider → entry 為 `null`（畫面 fallback 不渲染副標）
- 命中單一 Provider → join `Provider.name` 後回 `{ providerId, providerName }`
- 純函式部分為 `selectProviderEntriesFromSchedule(input)`，可單元測試
- 公開 helper `getResourceProviderEntry(map, resourceId)` 安全取值（包含 null / 未命中）

### API 補欄位（皆為 optional，未啟用商家為 null）

| Endpoint | 補欄位 |
|----------|------|
| `GET /queue/today` | 每張 ticket 加 `providerId / providerName`；每個 `resources[]` 加 `provider: { id, name } \| null` |
| `GET /public/m/[slug]` | QUEUE service 的 `resources[]` 每筆加 `provider: { id, name } \| null` |
| `GET /public/queue/[id]` & `claim/[token]` | `ticket.providerId / providerName`；`merchant.providerLabel`（三語自訂稱呼，給前端 `useProviderLabel` 解析） |

### WS 廣播 payload 擴充

`QueueBroadcastPayload` 新增 `providerId?: string \| null` / `providerName?: string \| null`，由各廣播觸發端（`take` / `create-for-customer` / `call-next` / `[id]/done` / `[id]/skip` / `[id]/assign-resource`）在 `broadcastQueue` 前呼叫 helper 查表後附入。**既有欄位不刪不改**，舊版前端忽略即可。

### 報到改派端點 `POST /queue/[id]/assign-resource`

`server/routes/nuxt-api/queue/[id]/assign-resource.post.ts`：

- `requireMerchant` 守衛 + Zod `{ resourceId: string }`
- 校驗 ticket ownership、`status=WAITING`、`ticketDate=今日`（商家時區）；否則回 409 `MSG_QUEUE_INVALID_STATE`
- 校驗目標 resource 屬該 service 已綁的 active resource；否則回 400 `MSG_QUEUE_RESOURCE_INVALID`
- 目標 === 當前 → no-op 短路（不寫 DB、不廣播）
- `UPDATE QueueTicket SET resourceId=新值`；唯一鍵 P2002 → 409 `MSG_QUEUE_NUMBER_TAKEN`（保留原 `ticketNumber`，未動 Counter）
- 廣播 `TICKET_SKIPPED { resourceId: 舊 }` + `TICKET_TAKEN { resourceId: 新, providerId, providerName }`，讓既有前端 patch 邏輯天然消化「票從 A 診移到 B 診」

### Provider 顯示文字 helper

`shared/i18n/provider-label.ts` 補純函式 `formatProviderDisplay(merchant, locale, providerName)`：

- `providerName` 為空 → 回 `null`（呼叫端不渲染 dom）
- 商家有當前語系自訂稱呼 → 採 suffix「{providerName}{label}」（例「王醫師」，zh / ja 直覺）
- 商家有商家偏好語自訂稱呼（fallback 命中）→ 同上採 suffix
- 全無自訂 → 採 prefix「{label} {providerName}」（例「Provider Wang」，en 直覺）

前端 `app/composables/app/use-provider-label.ts/UseProviderLabel(merchantRef)` 封裝此純函式，吐 `{ Label, FormatProviderDisplay }`。

### 報到台組件 `BizQueueCheckInPanel`

`app/components/biz/QueueCheckInPanel.vue`，掛在 `admin/queue.vue` 頂部、條件 `v-if="IsProviderModeEnabled"`（讀自 `GetSelfMerchant.providerModeEnabled`）：

- 篩選 `today.services[].resources[].tickets[]` 中所有 WAITING 票，按 `takenAt` 升序
- 每張卡：號碼 / 姓名 / 服務 / Provider 副標（`FormatProviderDisplay(ticket.providerName)`，null 顯示「未指派服務人員」）/ 診間下拉 / 確認按鈕
- 下拉 options：該 service `resources[]` 中 `isActive !== false` 且 `id !== null` 者，標籤「{resourceName} - {providerName}」（有 provider 才加 - providerName）
- 下拉預帶值：ticket 當前 resourceId
- **確認報到**：下拉值 === 當前 resourceId → 純前端 splice 移除（本地 `dismissedTicketIds: Set<string>`）；不同 → 呼叫 `$api.AssignResourceQueue({ id, resourceId })` 後再 splice
- 空狀態：`queue.checkIn.empty`
- 未啟用 Provider 制商家：整段 v-if 不渲染（保持與本 change 前完全一致）

### 叫號台票卡 Provider 副標

`BizQueueControlPanel.vue` 加 `merchant?: SelfMerchantFull \| null` prop：

- WAITING / CALLED / 搜尋結果 / 歷史 row 皆共用同個 customer column；新增 `.BizQueueControlPanel__providerLabel` 副標 span
- 條件 `v-if="FormatProviderDisplay(ticket.providerName)"`（providerName 為 null 時 helper 短路回 null，dom 不渲染）
- SCSS：字級 12px、$secondary 色

### 顧客端全螢幕叫號蓋層 Provider 副標

`BizQueueCallOverlay.vue` 加 `providerName?: string \| null` / `merchant?: ProviderLabelInputCompat \| null` 兩個 prop：

- 在 service 列與大號碼之間插入 `.BizQueueCallOverlay__provider` 副標行
- 條件 `v-if="ProviderText"`（內部用 `UseProviderLabel(merchantRef).FormatProviderDisplay`）
- `m/[slug]/queue/status.vue` 從 `MyTicket.value?.ticket.providerName` 與 `MyTicket.value?.merchant.providerLabel + timezone` 傳值

### 大螢幕多欄 Provider header

`m/[slug]/display.vue`：

- 主畫面已有「單欄 / 多欄」切換（add-queue-multi-resource-customer-ui 落地）
- 多欄 cell 頂部加 `.PageDisplay__cellProvider`（resourceName 下方），文字來自 `FormatProviderDisplay(live?.providerName ?? r.provider?.name)`
- 字級 `clamp(18px, 2vw, 32px)`、白色半透；無 Provider 或多匹配時整段 dom 不渲染
- 載入時 `merchantPublic` 保存 `GetPublicMerchant` 回來的 merchant 物件，傳給 `UseProviderLabel(merchantForLabel)` 解析自訂稱呼

### store-queue-realtime 解析新欄位

`app/stores/7.store-queue-realtime.ts`：

- `ResourceServingState` 加 `providerId / providerName: string \| null`
- `ServiceServingState` 加同名兩欄位（頂層 projection）
- `HandleMessage` 在收到任一 type 的 WS 訊息且帶 `providerId / providerName` 時，patch 至 `serviceMap[serviceId].resourceMap[resourceId]` 與頂層 projection
- `UpsertResourcesSnapshot` 入參 `resources[]` 加 `provider?: { id, name } \| null`，patch 至 slot
- 顧客端 `myTicket.ticket.providerName` 由 `GET /public/queue/[id]` 與 `claim/[token]` 直接 forward；不在 HandleMessage 內覆寫（避免抖動）

### i18n keys（2026-05-22 新增）

- `queue.checkIn.{title, empty, assignedRoom, confirm, confirmed, reassigned, unassignedProvider, assignFailed}` 三語齊全
- 「服務人員」預設稱呼由 `shared/i18n/provider-label.I18N_DEFAULT` 內建（zh: 服務人員 / en: Provider / ja: スタッフ）

> 本知識庫結構：fact-context-layered-v1
> 最後更新時間：2026-05-22
