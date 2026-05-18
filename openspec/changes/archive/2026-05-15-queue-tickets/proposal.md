# Change：queue-tickets

## Why

預約平台 MVP 的第四種預約模式 `QUEUE`（號碼牌）尚未實作。號碼牌相較於前三種「時段預約」模式，最大差異是**現場領號+即時叫號**——顧客現場拿號後守著等待頁，商家叫號時等待頁要即時更新。

前置：`setup-foundation`（schema 已含 QueueWindow / QueueTicket / QueueCounter）、`merchant-config`（商家可設 QUEUE 模式服務、設定每週領號時間窗）已完成。本 change 將號碼牌業務閉環，並引入 WebSocket 即時推播。

可與 Change 6 `customer-booking-flow` 平行；兩者皆只依賴 Change 1, 4，互不干擾。

不包含：跨日累計號碼、領號 OTP、簡訊通知、廣告插槽（Change 8 統一處理）。

## What Changes

### 公開 API（無 token）

- `POST /nuxt-api/public/queue/take` — 顧客拿號
  - 事務內以 `SELECT ... FOR UPDATE` 鎖 QueueCounter（按 `merchantId+serviceId+ticketDate`）
  - 自增 `lastTicketNumber` 並寫入 QueueTicket
  - 同 phone 同日同 service 已有 WAITING 票時拒絕（防重複領號）
  - RateLimit：IP 5/分鐘、phone 3/分鐘
- `GET /nuxt-api/public/queue/[id]` — 查單張號碼牌狀態（WS 斷線兜底輪詢）

### 商家 API（merchant token）

- `GET /nuxt-api/queue/today` — 當日所有 ticket + counter（依 serviceId 群組）
- `POST /nuxt-api/queue/call-next` — 叫下一號（按 serviceId）
  - 事務 + `SELECT ... FOR UPDATE` 防兩員工同按
  - 找最小 WAITING 票升 CALLED、counter.lastCalledNumber 更新
  - 廣播 `{ type: 'CALL_NEXT', ... }`
- `POST /nuxt-api/queue/[id]/done` — 標完成（CALLED → DONE）+ 廣播 `TICKET_DONE`
- `POST /nuxt-api/queue/[id]/skip` — 標過號（CALLED → SKIPPED）+ 廣播 `TICKET_SKIPPED`

### WebSocket

- `server/routes/nuxt-api/queue/ws.ts`：`defineWebSocketHandler`
  - `open` 時依 query `merchantId` 加入 `Map<merchantId, Set<Peer>>`
  - 心跳：收到 `ping` 回 `pong`
  - `close` 時從 Map 清除
- `server/utils/queue.ts` export `broadcastQueue(merchantId, payload)` 給 API 路由使用
- `nuxt.config.ts` 啟用 `nitro.experimental.websocket = true`

### Protocol

- `app/protocol/fetch-api/api/queue/{index.ts, mock.ts, type.d.ts}`

### Store

- `app/stores/7.store-queue-realtime.ts`
  - 封裝 WS 連線（複用 UseWS），維護 `currentServingByService`、`myTicket`
  - 15 秒輪詢兜底（當 WS 斷線時）

### 顧客頁面（front-desk layout）

- `app/pages/m/[slug]/queue/index.vue` — 領號頁：列服務（僅 QUEUE 模式）、填三元組、領號
- `app/pages/m/[slug]/queue/status.vue` — 等待頁：大號碼顯示、服務中號碼、預估等候人數

### 商家頁面（back-desk layout）

- `app/pages/admin/queue.vue` — 叫號控制台：當前服務中號碼大顯示、下一號按鈕、當日票列表

### 業務元件

- `app/components/biz/QueueDisplay.vue`（大號碼 + 服務中號碼）
- `app/components/biz/QueueControlPanel.vue`（商家叫號控制面板）

### 彈窗

無新增彈窗，沿用 `OpenDialogCustomerForm` 收集三元組。

## Impact

- 新建 capability：`queue-tickets`
- 對前置 capability 純擴充，無 schema 變動（資料模型已在 Change 1 落地）
- nuxt.config.ts 啟用 nitro experimental.websocket
- i18n：三語同步補 queue 相關 key
- back-desk layout 加「叫號」nav 連結
