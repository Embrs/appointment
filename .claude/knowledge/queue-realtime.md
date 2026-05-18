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
| `QueueTicket` | 當日號碼牌；唯一鍵 `(merchantId, serviceId, ticketDate, ticketNumber)` |
| `QueueCounter` | 叫號游標；唯一鍵 `(merchantId, serviceId, counterDate)`，內含 `lastTicketNumber`（發到第幾號）+ `lastCalledNumber`（叫到第幾號） |

> ticketDate 一律用 **merchant timezone** 下的今日，工具見 `server/utils/queue.ts/getTicketDateString`（用 `Intl.DateTimeFormat('en-CA')`）。

## 後端 API 範圍

`server/routes/nuxt-api/queue/` + `public/queue/`：

| Endpoint | 動作 | 守衛 |
|----------|------|------|
| `GET /queue/today` | 商家當日列表 | merchant |
| `POST /queue/call-next` | 叫下一號（advisory lock + Counter 加一） | merchant |
| `POST /queue/[id]/done` | 標記完成 | merchant |
| `POST /queue/[id]/skip` | 跳號 | merchant |
| `GET /queue/ws` | WebSocket 訂閱 | 無（MVP 公開） |
| `POST /public/queue/take` | 顧客領號 | 公開 |
| `GET /public/queue/[id]` | 顧客查號 | 公開 |

## 領號流程

`/public/queue/take` 規則：
1. 驗 BookingMode = `QUEUE`（否則 400 `MSG_NOT_QUEUE_SERVICE`）
2. 用 `isWithinQueueWindow(windows, timezone, now)` 校驗當前在 `QueueWindow` 內（按 weekday + `HH:mm` 字串比較；`time >= startTime && time < endTime`）→ 400 `MSG_QUEUE_WINDOW_CLOSED`
3. 同手機今日已領 → 409 `MSG_QUEUE_ALREADY_TAKEN`
4. `QueueWindow.maxTickets` 非 0 時，`QueueCounter.lastTicketNumber >= maxTickets` → 409 `MSG_QUEUE_FULL`
5. 在事務內 `Counter.lastTicketNumber += 1`、`create QueueTicket(status=WAITING)`
6. 廣播 `TICKET_TAKEN` 給 ws peer

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

## Cron 清理

`POST /nuxt-api/cron/archive`（見 [deploy-and-env.md](./deploy-and-env.md#cron-jobs)）每日清理：

- `QueueCounter` > 30 天的全刪
- `Appointment` 完成 90 天搬到 Archive
- `RateLimitBucket` > 1 小時清理
- `QueueTicket` 目前**不自動清理**（按 `ticketDate` 區分當日，歷史保留）
