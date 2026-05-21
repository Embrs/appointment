## 1. 資料模型與 migration

- [x] 1.1 在 `prisma/schema.prisma` 的 `model Service` 新增 `avgServiceMinutes Int?` 欄位
- [x] 1.2 執行 `npx prisma migrate dev --name add_service_avg_service_minutes` 產生 migration
- [x] 1.3 確認 migration SQL 為 nullable column add（不 backfill），執行 `npx prisma generate`
- [ ] 1.4 驗證既有 seed/fixture 仍能載入（執行 `npm run dev` 啟動一次確認）

## 2. 共用純函式（後端 + 前端）

- [x] 2.1 建立 `shared/queue-eta.ts`，匯出 `getTicketsAhead(ticket, counter): number` 與 `estimateWaitMinutes(waitingAhead, avgServiceMinutes): number`
- [x] 2.2 函式內處理：CALLED/DONE/SKIPPED 票回 0；非負 clamp；`avgServiceMinutes <= 0` 視為 0；結果 `Math.round`
- [x] 2.3 在 `server/utils/queue.ts` re-export `getTicketsAhead` 與 `estimateWaitMinutes`（避免後端兩個入口）
- [x] 2.4 補上 type re-export `QueueTicketStatusForEta`（純函式只關心 status 字串）

## 3. 後端 ETA 純函式測試

- [x] 3.1 新增 `server/__tests__/queue-eta.test.ts`
- [x] 3.2 測試 `getTicketsAhead`：0 人前、1 人前、N 人前、CALLED 票、DONE/SKIPPED 票、lastCalledNumber=0
- [x] 3.3 測試 `estimateWaitMinutes`：0 人等、1 人等、N 人等、avg=0 / 負數、小數四捨五入
- [x] 3.4 執行 `npm test` 確認新測試與既有測試皆通過

## 4. 後端 API 補欄位

- [x] 4.1 `server/routes/nuxt-api/public/queue/[id].get.ts`：查 service 與 counter，回 body 多回 `estimatedWaitMinutes: number | null`
- [x] 4.2 `server/routes/nuxt-api/public/m/[slug].get.ts`：對每個 QUEUE service 多回 `estimatedNextCallMinutes: number | null`（counter 為 null 時回 null；無 WAITING 時回 0）
- [x] 4.3 `server/routes/nuxt-api/queue/today.get.ts`：每個 service 物件多回 `avgServiceMinutes`（effective fallback 後的整數）；每張 WAITING 票多回 `estimatedWaitMinutes: number | null`
- [x] 4.4 在 `server/utils/queue.ts` 新增 helper `computeServiceEta(service, counter, ticket?)`，被上述 3 個端點重複使用，避免散落實作

## 5. WebSocket 廣播 payload

- [x] 5.1 `server/utils/queue.ts/QueueBroadcastPayload` 介面新增可選欄位 `avgServiceMinutes?: number`、`nextWaitMinutes?: number`
- [x] 5.2 新增 helper `buildBroadcastEtaFields(merchantId, serviceId, counter)`，回 `{ avgServiceMinutes, nextWaitMinutes }`
- [x] 5.3 在以下端點呼叫 `broadcastQueue` 前合併 ETA 欄位：
  - [x] 5.3.1 `public/queue/take.post.ts`（TICKET_TAKEN）
  - [x] 5.3.2 `queue/create-for-customer.post.ts`（TICKET_TAKEN）
  - [x] 5.3.3 `queue/call-next.post.ts`（CALL_NEXT）
  - [x] 5.3.4 `queue/[id]/done.post.ts`（TICKET_DONE）
  - [x] 5.3.5 `queue/[id]/skip.post.ts`（TICKET_SKIPPED）

## 6. 前端型別同步

- [x] 6.1 `app/protocol/fetch-api/api/queue/type.d.ts`：`QueueTodayResponse` 內每個 service 物件加 `avgServiceMinutes: number`、每張 ticket 加 `estimatedWaitMinutes: number | null`
- [x] 6.2 `app/protocol/fetch-api/api/public/type.d.ts`：`PublicQueueTicketResponse` 加 `estimatedWaitMinutes: number | null`；`PublicMerchantResponse` 內 QUEUE service 加 `estimatedNextCallMinutes: number | null`
- [x] 6.3 `app/protocol/fetch-api/api/queue/mock.ts`：mock data 補 ETA 欄位
- [x] 6.4 在 admin service 編輯介面相關型別補 `avgServiceMinutes?: number | null`

## 7. 前端 store（StoreQueueRealtime）

- [x] 7.1 `app/stores/7.store-queue-realtime.ts`：state 內 `serviceMap` 每個 service 物件多存 `avgServiceMinutes: number`
- [x] 7.2 `HandleMessage` 在收到含 `avgServiceMinutes` 的 payload 時更新 `serviceMap[serviceId].avgServiceMinutes`
- [x] 7.3 新增 getter `GetMyEta(ticket)` 內呼叫 `shared/queue-eta.ts/getTicketsAhead + estimateWaitMinutes` 即時計算
- [x] 7.4 確認 `myTicket` 更新時 getter reactive 正確觸發

## 8. 顧客等待頁 UI

- [x] 8.1 `app/pages/m/[slug]/queue/status.vue`：在票券資訊區塊新增 ETA 區塊，顯示「您前面還有 N 位 ・ 預估還需 X 分鐘」
- [x] 8.2 處理三種狀態：正常（顯示分鐘）、即將輪到（隱藏分鐘改顯示「即將輪到您」）、無法估算（顯示 unknown 文案）
- [x] 8.3 ETA 區塊資料來源：HTTP 初始載入 + WS 推播即時更新（透過 `GetMyEta` getter）
- [x] 8.4 不影響 CALLED 全螢幕蓋層、DONE/SKIPPED 收尾畫面既有行為

## 9. 商家叫號頁 UI

- [x] 9.1 `app/pages/admin/queue.vue`：在每張 WAITING 票卡片右側新增「約 N 分鐘後」徽章
- [x] 9.2 徽章資料來源：直接從 ticket 物件讀取 `estimatedWaitMinutes`，但在 WS 事件後 store 重算（呼叫 `getTicketsAhead + estimateWaitMinutes`）覆寫
- [x] 9.3 CALLED 票不顯示徽章
- [x] 9.4 樣式：尺寸與既有票號徽章協調、顏色採資訊型（藍/灰）

## 10. 商家服務編輯介面

- [x] 10.1 找出 admin services 編輯入口（`app/pages/admin/services/` 或對應 dialog 元件）
- [x] 10.2 表單在「服務時長」欄位下方新增「平均服務時長（分鐘）」`ElInputNumber`，min=0、step=1、可清空（modelValue 為 `number | null`）
- [x] 10.3 placeholder「留空自動沿用服務時長」、help text「實際每位顧客的平均處理時間，用於預估等待時間顯示」
- [x] 10.4 條件渲染：僅在 `bookingMode === 'QUEUE'` 時顯示
- [x] 10.5 送出表單時 `avgServiceMinutes` 為空字串時轉為 `null`（不送 0）
- [x] 10.6 admin 服務 PUT/POST 端點接收 `avgServiceMinutes: number | null`（Zod 驗證：非負整數或 null）

## 11. i18n 三語

- [x] 11.1 `i18n/locales/zh.js` 新增 `queue.eta.aheadOfYou`（前面還有 {n} 位）、`queue.eta.estimateMinutes`（預估還需 {n} 分鐘）、`queue.eta.almostYourTurn`（即將輪到您）、`queue.eta.unknown`（預估時間尚無法計算）、`queue.eta.aboutMinutesLater`（約 {n} 分鐘後）
- [x] 11.2 `i18n/locales/en.js` 同 5 個 key 的英文
- [x] 11.3 `i18n/locales/ja.js` 同 5 個 key 的日文
- [x] 11.4 admin service 編輯介面欄位 label / placeholder / help text 同步三語（`admin.services.avgServiceMinutes.*`）
- [x] 11.5 320px viewport 寬度三語不溢出檢查（Playwright 截圖）

## 12. 知識庫與規格

- [x] 12.1 更新 `.claude/knowledge/queue-realtime.md` 加入「ETA 預估等待時間」段落（純函式位置、payload 欄位、前端 store 更新方式）
- [x] 12.2 確認 `openspec validate queue-eta-display` 通過

## 13. 驗收

- [x] 13.1 執行 `npm run lint` 通過
- [x] 13.2 執行 `npm test` 通過（含新增 ETA 純函式測試與既有 availability/queue 測試）
- [x] 13.3 啟動 `npm run dev`、用 Playwright MCP E2E 驗證：
  - [x] 13.3.1 商家登入 → 編輯一個 QUEUE 服務 → 設 `avgServiceMinutes=10` → 儲存
  - [x] 13.3.2 連續用 `POST /public/queue/take` 或顧客頁領 5 張票
  - [x] 13.3.3 第 3 張顧客進入 `/m/[slug]/queue/status` 應看到「您前面還有 2 位 ・ 預估還需 20 分鐘」
  - [x] 13.3.4 商家在 `/admin/queue` 按「下一號」後，status 頁透過 WS 即時更新為「預估還需 10 分鐘」
  - [x] 13.3.5 商家點到自己（第 3 張）時，status 頁顯示 CALLED 全螢幕蓋層
  - [x] 13.3.6 將上述 5 個關鍵步驟截圖至 `screenshots/queue-eta-display/`
- [x] 13.4 執行 `openspec verify queue-eta-display`（或對應 opsx:verify skill）
- [ ] 13.5 執行 `openspec archive queue-eta-display`（或對應 opsx:archive skill）合併 specs 至 `openspec/specs/queue-tickets/`
