## Why

目前號碼牌系統只顯示「目前叫到幾號」與「您是第幾號」，顧客無法判斷自己還要等多久。對於現場領號者，此資訊缺口造成原地空等、頻繁追問櫃台；對於遠端領號者，更無法估算返店時間。這是現場與遠端用戶共同痛點，需要可預測的等待時間顯示，並讓商家能以服務經驗校準預估值。

## What Changes

- **資料模型**：Service 新增 `avgServiceMinutes Int?` 可選欄位，為 null 時 fallback 使用 `durationMinutes`。
- **後端 ETA 純函式**：`server/utils/queue.ts` 新增 `getTicketsAhead(ticket, counter)` 與 `estimateWaitMinutes(waitingAhead, avgServiceMinutes)` 兩支純函式，集中演算法並提供 Vitest 覆蓋。
- **API 補欄位**：
  - `GET /public/queue/[id]` 回傳 `estimatedWaitMinutes`
  - `GET /public/m/[slug]` 每個 QUEUE service 多回 `estimatedNextCallMinutes`（給領號頁卡片顯示）
  - `projectQueueServingPublic()` 同步擴充
- **WebSocket 廣播**：`server/routes/nuxt-api/queue/ws.ts` 廣播 `CALL_NEXT` / `TICKET_TAKEN` / `TICKET_DONE` / `TICKET_SKIPPED` payload 補 `estimatedWaitMinutes` 與 `avgServiceMinutes` 推進依據，讓訂閱端即時更新自己的 ETA。
- **顧客等待頁**：`/m/[slug]/queue/status` 顯示「您前面還有 N 位 ・ 預估還需 X 分鐘」，已開始叫號但 N=0 時顯示「即將輪到您」。
- **商家叫號頁**：`/admin/queue` 每張 WAITING 票顯示個別預估等待時間。
- **商家 Service 編輯介面**：admin 服務管理新增 `avgServiceMinutes` 欄位（單位「分鐘」、可留空、placeholder 指示「留空自動沿用服務時長」）。
- **前端型別與 store**：`app/protocol/fetch-api/` 同步型別、`app/stores/7.store-queue-realtime.ts` 處理新 payload 欄位。
- **i18n**：三語 `queue.eta.aheadOfYou` / `queue.eta.estimateMinutes` / `queue.eta.unknown` / `queue.eta.almostYourTurn`。
- **知識庫**：更新 `.claude/knowledge/queue-realtime.md` 加入 ETA 段落。

非範圍：claimToken / QR Code（Change C）、display 頁大螢幕（Change D）；本變更不動 booking flow、不動既有 take/call-next/done/skip 行為。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `queue-tickets`: 新增「ETA 預估等待時間」、「Service 平均服務時長設定」、「公開查詢回傳 ETA」、「WebSocket 廣播帶 ETA」、「商家叫號頁顯示 ETA」、「顧客等待頁顯示 ETA」六項需求；既有「顧客查詢票狀態」「公開查詢當前叫號」「商家當日總覽」「WebSocket 即時推播」需求 payload/回應欄位擴充。

## Impact

- **Prisma schema**：Service 表新增 `avgServiceMinutes Int?`，需 `prisma migrate dev` 產生 migration。
- **後端**：
  - `server/utils/queue.ts` 新增純函式與型別
  - `server/routes/nuxt-api/public/queue/[id].get.ts` 回應補欄位
  - `server/routes/nuxt-api/public/m/[slug].get.ts` 回應補欄位
  - `server/routes/nuxt-api/queue/today.get.ts` 回應補欄位（每張票 + service 層級）
  - `server/routes/nuxt-api/queue/ws.ts`（與所有呼叫 `broadcastQueue` 的端點：`take.post.ts`、`create-for-customer.post.ts`、`call-next.post.ts`、`[id]/done.post.ts`、`[id]/skip.post.ts`）payload 補欄位
- **前端**：
  - `app/protocol/fetch-api/api/queue/type.d.ts`、`api/public/type.d.ts` 同步
  - `app/stores/7.store-queue-realtime.ts` 處理新欄位
  - `app/pages/m/[slug]/queue/status.vue`、`app/pages/m/[slug]/queue/index.vue`、`app/pages/admin/queue.vue` UI
  - `app/pages/admin/services/` 對應編輯介面新增表單欄位
- **i18n**：`i18n/locales/{zh,en,ja}.js` 新增 `queue.eta.*`
- **測試**：`server/__tests__/queue-eta.test.ts` 新增 ETA 純函式測試
- **驗收**：Playwright MCP E2E 截圖至 `screenshots/queue-eta-display/`
- **知識庫**：`.claude/knowledge/queue-realtime.md` 補 ETA 段落
- **規格**：`openspec/specs/queue-tickets/` 經 archive 流程合併本變更
