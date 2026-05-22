## Why

階段 1（backend）已支援多 resource 號池、階段 2（admin-ui）已能讓商家在後台為 QUEUE service 綁定多 resource 並分子卡叫號。但顧客面 + 大螢幕仍維持單一號池的 UX：顧客拿號時無法選擇診間／櫃台、查號頁不顯示「請至哪一間」、店面大螢幕無法分區呈現多 resource 同時叫號。最後一哩沒打通，整體多診間獨立叫號需求等於沒上線。

## What Changes

- **拿號頁 `app/pages/m/[slug]/queue/take.vue`**：服務若 `resources.length > 0`，顯示資源選擇器（segmented control / radio），每選項顯示當前 currentServing / waitingCount 輔助決策；submit 帶 `resourceId`；單 resource 自動選定不顯示選擇器；未綁 resource 走原 UX
- **查號頁 `app/pages/m/[slug]/queue/status.vue`**：主畫面號碼前綴 `{resourceName} {ticketNumber} 號`；`IsCalled` 文案改「請至 {resourceName}，輪到您了！」；無 resource fallback 原文案
- **找號頁 `app/pages/m/[slug]/queue/find.vue`**：多筆同手機末 4 碼結果（不同診間）正確列出，顯示 resource name 區分
- **店面大螢幕 `app/pages/m/[slug]/display.vue`**：多 resource 時主視覺改左右兩格 layout（≤2 resource）或 grid 自適應；副標「→ {resourceName} 看診」；TTS 改用 `display.tts.callPhraseWithRoom`；query 不帶 `?serviceId` 時自動挑「該 service 任一 resource 有 WAITING 且 currentServing 最小」者
- **realtime store `app/stores/7.store-queue-realtime.ts`**：`serviceMap[serviceId]` 內加 `resourceMap: Record<resourceId|'null', {currentServing, ticketsTaken, waitingCount, avgServiceMinutes, ...}>`；`myTicket` 加 `resourceId/resourceName/displayLabel`；`HandleMessage` 按 (serviceId, resourceId) 兩層分發
- **i18n（zh / en / ja 三語）**：新增 `queue.page.ticketWithRoom`、`queue.page.statusCalledHintWithRoom`、`queue.take.selectRoomLabel`、`queue.take.selectRoomHint`、`queue.take.roomStat`、`display.gotoRoom`、`display.tts.callPhraseWithRoom`
- **測試擴充 `server/__tests__/display-tts.test.ts`**：room 存在時用 `callPhraseWithRoom`
- 全面確保未綁 resource 的 QUEUE service 行為**完全不變**（迴歸保護）

## Capabilities

### New Capabilities

（無新增）

### Modified Capabilities

- `queue-tickets`: 顧客面（拿號、查號、找號）與店面大螢幕需支援多 resource 分群顯示與選擇；realtime store 需依 (serviceId, resourceId) 兩層分發；TTS / i18n 文案需在 room 存在時切換至帶 room 變體

## Impact

- **前端頁面**：`app/pages/m/[slug]/queue/take.vue`、`status.vue`、`find.vue`、`display.vue`
- **Store**：`app/stores/7.store-queue-realtime.ts`
- **i18n locales**：`i18n/locales/{zh,en,ja}.js`
- **後端測試**：`server/__tests__/display-tts.test.ts` 擴測
- **API 依賴**：階段 1 已交付的 `GET /public/m/[slug]`（`resources[]`）、`GET /public/queue/[id]` / `claim/[token]`（`resourceId/resourceName/ticketNumberDisplay`）、WS payload（`resourceId/resourceName`）
- **無 schema / migration 變動**；無 server-side route 邏輯變動（除 display-tts 測試）
- **迴歸風險**：未綁 resource 的 QUEUE service 與 RESOURCE 模式預約均應零影響
