---
name: 號碼牌即時系統
description: QueueTicket/Window/Counter 三表協作、WebSocket 廣播、前端 store WS+輪詢雙軌、cron 清理
type: reference
---

# 號碼牌即時系統

號碼牌全棧：DB 三表 + Nitro WebSocket + 前端 `StoreQueueRealtime` + cron 清理。

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

## Cron 清理

`POST /nuxt-api/cron/archive`（見 [deploy-and-env.md](./deploy-and-env.md#cron-jobs)）每日清理：

- `QueueCounter` > 30 天的全刪
- `Appointment` 完成 90 天搬到 Archive
- `RateLimitBucket` > 1 小時清理
- `QueueTicket` 目前**不自動清理**（按 `ticketDate` 區分當日，歷史保留）
