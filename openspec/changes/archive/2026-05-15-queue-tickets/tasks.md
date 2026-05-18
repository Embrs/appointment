# Tasks：queue-tickets

## 1. 後端 — Queue utils 與 WebSocket

- [x] 1.1 `server/utils/queue.ts`：三語訊息、peer Map、`broadcastQueue`、ticketDate helper（merchant timezone）、validateQueueWindow
- [x] 1.2 `server/routes/nuxt-api/queue/ws.ts`：`defineWebSocketHandler`（open/close/message）
- [x] 1.3 `nuxt.config.ts` 啟用 `nitro.experimental.websocket = true`

## 2. 後端 — 公開 API

- [x] 2.1 `public/queue/take.post.ts`：拿號（事務 + FOR UPDATE + rate limit + 廣播 TICKET_TAKEN）
- [x] 2.2 `public/queue/[id].get.ts`：查單張號碼牌（WS 兜底）

## 3. 後端 — 商家 API

- [x] 3.1 `queue/today.get.ts`：當日全票 + counters
- [x] 3.2 `queue/call-next.post.ts`：叫下一號（事務 + FOR UPDATE + serialization conflict → 409 + 廣播 CALL_NEXT）
- [x] 3.3 `queue/[id]/done.post.ts`：CALLED → DONE + 廣播
- [x] 3.4 `queue/[id]/skip.post.ts`：CALLED → SKIPPED + 廣播

## 4. Protocol

- [x] 4.1 `app/protocol/fetch-api/api/queue/{index.ts, mock.ts, type.d.ts}`
- [x] 4.2 `app/protocol/fetch-api/index.ts` 註冊

## 5. Store

- [x] 5.1 `app/stores/7.store-queue-realtime.ts`：WS 連線 + 15 秒輪詢兜底 + currentServing / myTicket 狀態

## 6. 業務元件

- [x] 6.1 `app/components/biz/QueueDisplay.vue`（大號碼顯示）
- [x] 6.2 `app/components/biz/QueueControlPanel.vue`（商家叫號控制面板）

## 7. 顧客頁面

- [x] 7.1 `app/pages/m/[slug]/queue/index.vue`（領號）
- [x] 7.2 `app/pages/m/[slug]/queue/status.vue`（等待頁）

## 8. 商家頁面

- [x] 8.1 `app/pages/admin/queue.vue`
- [x] 8.2 `app/layouts/back-desk.vue` 加「叫號」nav 連結

## 9. i18n 三語補字

- [x] 9.1 `i18n/locales/zh.js`
- [x] 9.2 `i18n/locales/en.js`
- [x] 9.3 `i18n/locales/ja.js`

## 10. 驗證（Playwright MCP）

- [x] 10.1 場景 1：基本拿號 + 叫號即時（顧客 A=01、顧客 B=02、商家叫號後兩顧客 WS 即時顯示「請進入」）
- [x] 10.2 場景 2：並發叫號（兩個並發 POST call-next：一個成功取得號碼、另一個 409 「其他員工剛叫了同一號，請重試」）
- [x] 10.3 場景 3：WS 斷線兜底（替換 window.WebSocket → 介面顯示「○ 兜底輪詢中（15s）」→ 叫號後 18 秒內 currentServing 由 04 → 05 更新）
- [x] 10.4 場景 4：手機 RWD 375x667（大號碼字體響應降為 88px，廣告插槽無內容時 `:empty { display: none }` 不占空間）
