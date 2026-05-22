## Why

診所場景的痛點：一個商家內含多間診療室（A 診間、B 診間），希望兩條完全分離的號池（A 從 A1 起、B 從 B1 起、各自獨立叫號），但目前 `QueueCounter` 唯一鍵是 `(merchantId, serviceId, counterDate)`，**一個 Service 只能有一條號池**，且 UI/後端不允許 QUEUE 模式綁定 Resources。

本提案是「多診間／多醫師場景優化計畫」的階段 1（純後端），把資料模型、共用工具與 queue 相關 API 全部改成「按 (serviceId, resourceId) 兩層分群」，但**完全不動前端**。後續階段 2（admin UI）與階段 3（公開頁/大螢幕）會獨立提案。

## What Changes

- **Schema（單一 migration）**
  - `QueueTicket` / `QueueCounter` 各加 `resourceId String?`（nullable）與 `Resource?` 反向關聯（`onDelete: Restrict`）
  - `QueueTicket` 唯一鍵改為 `(merchantId, serviceId, resourceId, ticketDate, ticketNumber)`，新增複合 index `(merchantId, resourceId, ticketDate, status)`
  - `QueueCounter` 唯一鍵改為 `(merchantId, serviceId, resourceId, counterDate)`
  - `Resource` 加反向關係 `queueTickets QueueTicket[]` / `queueCounters QueueCounter[]`
  - PostgreSQL 多 NULL 不衝突 ⇒ 既有資料（`resourceId IS NULL`）持續以單一號池運作，零迴歸
- **`server/utils/queue.ts`**
  - `internalCreateTicket` 接受 `resourceId?: string | null`，建/查 Counter 與 Ticket 時帶上
  - `QueueBroadcastPayload` 加 `resourceId?: string | null` / `resourceName?: string`
  - 新增 helper `getResourcesForQueueService(serviceId)`：回該 service 已綁定且 active 的 resources（按 `displayOrder`）
  - 所有 ETA helper（`getTicketsAhead` 等）的呼叫端按 `(resourceId)` 分群
- **API 端點變更**
  - `POST /nuxt-api/service` + `PUT /nuxt-api/service/[id]`：解除「`bookingMode=QUEUE` 不能帶 `resourceIds`」限制
  - `POST /nuxt-api/public/queue/take` + `POST /nuxt-api/queue/create-for-customer`：body 加 `resourceId?: string`（service 已綁 resources 時 required，驗證 resource 屬該 service 且 active）
  - `POST /nuxt-api/queue/call-next`：body 加 `resourceId?: string`（同上 required 規則）；advisory lock key 改 `queue-call:{m}:{s}:{r ?? 'null'}`；查 WAITING 時 where 加 `resourceId`；廣播 payload 帶 `resourceId/resourceName`
  - `POST /nuxt-api/queue/[id]/done` & `[id]/skip`：廣播 payload 帶上 `ticket.resourceId`（body 不加參數）
  - `GET /nuxt-api/queue/today`：每個 service 多回 `resources: [{ id, name, displayOrder, isActive, counter, tickets }]` 陣列；未綁 resource 的 service 走 fallback `resources: [{ id: null, name: null, counter, tickets }]` 保持 schema 一致
  - `GET /nuxt-api/public/queue/[id]` & `/public/queue/claim/[token]`：回 `resourceId`、`resourceName`
  - `GET /nuxt-api/public/m/[slug]`：QUEUE service 的 `currentServing/ticketsTaken/waitingCount/estimatedNextCallMinutes/avgServiceMinutes` 改成 `resources: [{ id, name, currentServing, ticketsTaken, waitingCount, avgServiceMinutes, estimatedNextCallMinutes }]` 陣列；未綁 resource 的 service 回單元素 `[{ id: null, name: null, ... }]`
- **Vitest 新單元測試**
  - `queue-internal-create-resource.test.ts`：兩 resource 同 service 同日各自從 1 號起；不同 `resourceId` 下 unique key 不衝突
  - `queue-call-next-resource.test.ts`：`call-next` 在 `(s, A)` 與 `(s, B)` 上獨立推進、advisory lock 不互鎖
  - `queue-eta-resource.test.ts`：`getTicketsAhead` 與 ETA 計算按 `(resourceId)` 分群

非破壞性約束：
- 未綁 resource 的 service（`resourceId=NULL` 路徑）必須維持單一號池原行為
- 錯誤一律 `return ApiResponse`（不 `throw`），三語訊息（`zh_tw/en/ja`）齊全
- 本階段**不**動任何前端、不需 Playwright

## Capabilities

### New Capabilities

（無新 capability — 本階段是擴充既有 `queue-tickets` spec）

### Modified Capabilities

- `queue-tickets`：把現有「顧客拿號 / 顧客查詢票狀態 / 商家叫號 / 商家標記完成或過號 / 商家當日總覽 / 商家現場代客領號 / 公開查詢當前叫號 / WebSocket 廣播 payload 含 ETA / ETA 純函式呼叫端」等 requirements，全部擴充為「按 `(serviceId, resourceId)` 分群」的行為；另新增 requirement「Service / Resource 可在 QUEUE 模式下綁定多個 Resource」與「QueueTicket / QueueCounter 帶 resourceId」資料模型 requirement。

## Impact

- **Schema / Migration**：`prisma/schema.prisma` + 一支新 migration；既有 prod 資料不需 backfill（NULL 路徑沿用單號池）
- **後端工具層**：`server/utils/queue.ts`（`internalCreateTicket` 簽名擴充、`QueueBroadcastPayload` 型別擴充、新 helper `getResourcesForQueueService`）
- **後端 API**：
  - `server/routes/nuxt-api/service/index.post.ts`、`[id].put.ts`
  - `server/routes/nuxt-api/public/queue/take.post.ts`
  - `server/routes/nuxt-api/queue/create-for-customer.post.ts`
  - `server/routes/nuxt-api/queue/call-next.post.ts`
  - `server/routes/nuxt-api/queue/[id]/done.post.ts`、`[id]/skip.post.ts`
  - `server/routes/nuxt-api/queue/today.get.ts`
  - `server/routes/nuxt-api/public/queue/[id].get.ts`、`claim/[token].get.ts`
  - `server/routes/nuxt-api/public/m/[slug].get.ts`
- **測試**：3 支新 Vitest 測試 + 既有 `display-tts.test.ts` 中若涉及 resource 場景的相容測試
- **i18n**：新訊息 `MSG_QUEUE_RESOURCE_REQUIRED` / `MSG_QUEUE_RESOURCE_INVALID`（zh_tw/en/ja 三語）
- **前端 / WS 客戶端**：**不**在本提案範圍（階段 2、3 處理）；本階段廣播 payload 多帶 `resourceId/resourceName` 但客戶端先忽略即可（向後相容）
- **Cron / 部署**：無影響
