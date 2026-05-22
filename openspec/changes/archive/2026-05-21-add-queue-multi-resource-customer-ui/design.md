## Context

階段 1（backend）已交付 `QueueTicket / QueueCounter` 帶 `resourceId`、`internalCreateTicket` 接 `resourceId`、`POST /public/queue/take` / `/queue/create-for-customer` / `/queue/call-next` 接 `resourceId`、`GET /public/m/[slug]` 改回 `services[].resources[]` 陣列形式、`GET /public/queue/[id]` / `claim/[token]` 回 `resourceId/resourceName/ticketNumberDisplay`、WS 廣播 payload 帶 `resourceId/resourceName`。階段 2（admin-ui）已交付 service-edit 允許 QUEUE 綁 resources、admin/queue.vue 子卡渲染、QueueControlPanel 子卡 + segmented control「目前操作」、walk-in 帶 resourceId、i18n（merchant 端）。

本階段（階段 3）做顧客面 + 大螢幕 + realtime store 收尾。架構約束：
- 顧客頁均位於 `/m/[slug]/queue/*`（layout `front-desk`，無認證，前端純消費 public API + WS）
- 大螢幕 `/m/[slug]/display`（layout `front-desk` displayMode）以全螢幕投影，無互動，純讀
- realtime store `StoreQueueRealtime` 為前端唯一 WS / polling 入口；admin 端與顧客端共用同一個 store instance（同 Pinia store id）
- 既有未綁 resource 的 QUEUE service 必須行為完全不變

## Goals / Non-Goals

**Goals:**
- 顧客在 `/m/[slug]/queue/`（拿號頁）能為多 resource service 選擇診間／櫃台再拿號，並看到各間目前的 currentServing / waitingCount 輔助決策
- 顧客在 `/m/[slug]/queue/status`（查號頁）的主號碼前綴與 CALLED 文案能正確顯示 `{resourceName}`
- 顧客在 `/m/[slug]/queue/find`（手機末 4 碼回查）能正確列出多筆同手機末 4 碼結果（不同 resource 各一張）並以 resource name 區分
- 大螢幕 `/m/[slug]/display` 能在 service 綁多 resource 時分區呈現（≤2 用左右兩格、>2 用 grid 自適應）、TTS 唸出 `{number} 號，請至 {room}`、URL 不帶 serviceId 時自動挑「該 service 任一 resource 有 WAITING 且 currentServing 最小」
- realtime store `serviceMap[serviceId]` 內擴 `resourceMap`，按 (serviceId, resourceId) 兩層分發 WS 訊息；`myTicket` 帶 `resourceId/resourceName/displayLabel`
- 未綁 resource 的 service：take/status/find/display/store/i18n 全部 fallback 至原行為，零迴歸
- i18n 三語（zh/en/ja）齊備

**Non-Goals:**
- 不改 schema、不改 server API contract、不改 admin/queue.vue / QueueControlPanel（階段 2 已完成）
- 不做跨日報表 / 跨商家報表
- 不做每資源獨立 QueueWindow / maxTickets（仍 service 層級）
- 不重構 ETA 工具（沿用 `~shared/queue-eta.ts`，需求只在於把它分群套用至各 resource）

## Decisions

### 1. 拿號頁資源選擇器 UI：segmented control 而非下拉

- **採用**：`<el-segmented>` 水平排列 resource name + 副標「現叫 N 號・等待 M 人」，視覺直觀、單擊即選；單一 resource 自動選定不渲染選擇器；無 resource fallback 原 UX
- **替代**：下拉選單 — 多了一次點擊、看不到比較數據，劣
- **理由**：診所場景通常 2~4 間診間，segmented control 一眼看到所有選項；店家也能用「等候人數」當輔助決策資訊。

### 2. status.vue 多 resource 文案：與 `MyTicket.value.ticket.resourceName` 條件化

- **採用**：把 `MyNumber` / `StatusHint` / document title 等多處 computed 中的「ticket 號碼/服務」顯示，若 `resourceName` 存在，改用 `queue.page.ticketWithRoom` / `queue.page.statusCalledHintWithRoom`；否則 fallback 原 key
- **替代**：把 resourceName 強塞進 serviceName — 會污染既有 ServiceName，破壞迴歸保護
- **理由**：保持「有 resource → 帶 room 變體；無 resource → 原文案」的清晰分支，行為差異收斂在 computed 邊界

### 3. find.vue 多筆結果：用 list + resource badge 區分

- **採用**：API `/public/queue/find` 已回 `tickets[]`（可能多筆）；UI 改成 `<el-result>` + `<ul>` 列表，每筆顯示 `{resourceName} {ticketNumber} 號 - {serviceName}` + 「查看狀態」按鈕（帶 token 跳 status）；若只有 1 筆走原有單筆 UX
- **替代**：只挑最新的一筆 — 顧客在 A、B 兩診都拿號時看不到 B 的，劣
- **理由**：找號的核心訴求就是把所有當日有效票列出，多 resource 場景才不會「找不到」

### 4. display.vue 多 resource layout：CSS grid 動態列數

- **採用**：以 `ActiveService.resources.length` 動態決定：
  - 0 或 1：原本單一全螢幕 layout
  - 2：`grid-template-columns: 1fr 1fr`（左右兩格）
  - ≥3：`grid-template-columns: repeat(auto-fit, minmax(360px, 1fr))`
- 每個 cell 顯示 `{resourceName}` + 大號碼 + 副標「→ {resourceName} 看診」+ 「下位 / 等候」
- 各 cell 各自從 `queueStore.serviceMap[serviceId]?.resourceMap[resourceId]` 讀 live state
- **替代**：強制 ≥3 用 carousel — 大螢幕一眼看不全，劣
- **理由**：診所 ≤2 是壓倒性多數；3+ 時 grid 自適應仍能維持「一眼看全」原則

### 5. display.vue TTS：room 存在時用帶 room 變體；trigger 按 (serviceId, resourceId)

- **採用**：擴 `display-tts` 邏輯：當 WS 推 CALL_NEXT 帶 `resourceId/resourceName` 時，TTS 句子用 `display.tts.callPhraseWithRoom`（`{number} 號，請至 {room}`）；無 room fallback 原 `callPhrase`
- 為避免重複唸：每個 (serviceId, resourceId) 記 `lastSpokenNumber`（小 map 而非單一 ref）
- **替代**：合併成「依序唸所有 resource 最新號」— 多 resource 同時叫號會卡 queue 變慢
- **理由**：每個診間獨立號池本來就獨立播報；UX 上也是各自獨立提示

### 6. display.vue 自動挑 service：依「任一 resource 有 WAITING 且 currentServing 最小」

- **採用**：query 無 `serviceId` 時，從 `QueueServices` 過濾每個 service 至少一個 resource 有 `waitingCount > 0`；無則挑 ticketsTaken 最大；最終以 service 內各 resource `currentServing` 最小者為主
- **替代**：query 無 serviceId 時 carousel 輪播所有 service — 與原既有單 service 自動挑邏輯不一致，破壞迴歸
- **理由**：盡量延續既有自動挑邏輯，只在「有 resources」path 多一層展平

### 7. Store `serviceMap[serviceId].resourceMap`：以 `resourceId | '__null__'` 為 key

- **採用**：原 `ServiceServingState` 內欄位（currentServing / servingTicketId / 姓氏 / 稱謂 / avgServiceMinutes / lastEventAt）下沉一層成 `ResourceServingState`；`ServiceServingState` 留 `resourceMap: Record<string, ResourceServingState>`（key=`resourceId` 或 `'__null__'` 表 fallback 單一號池）
- 為向後相容（避免改既有 admin 端讀法），同步在 `ServiceServingState` 頂層保留「primary resource 投影」（aggregate）：當 resourceMap 只有一個 entry（無論 key 是 `'__null__'` 還是某 resource）就把它複製到頂層欄位；多 resource 時頂層欄位視為「最近被叫的那一個」projection。HandleMessage 在路由分發後額外 patch 頂層 projection（最小化 admin / 既有 status.vue 顯示變動）
- **替代**：直接破壞性改 `serviceMap[serviceId]` 頂層欄位 — 連動全站讀寫，工程量爆炸
- **理由**：增量、向後相容、admin 端不需重改

### 8. WS 推播路由：按 (serviceId, resourceId) 分發；無 resourceId 走 `'__null__'`

- **採用**：`HandleMessage` 第一步從 msg.serviceId 取得 service slot，第二步以 `msg.resourceId ?? '__null__'` 為 sub-key 寫入 `resourceMap`；同時對 `myTicket`：若 myTicket.ticket.resourceId 與 msg.resourceId 不一致則跳過更新（避免 A 診叫號污染我在 B 的票）
- **替代**：仍以 serviceId 為單一 key — 多診間同時叫號互相覆蓋 currentServing，畫面跳號
- **理由**：這是多 resource 顯示正確性的核心保證

### 9. 不修改 server route 邏輯（除 display-tts 測試擴充）

- **採用**：階段 1 已完整交付 server 端 API、WS payload、`/public/m/[slug]` 多 resource 結構；本階段只擴 `server/__tests__/display-tts.test.ts` 加 room 變體測試
- **理由**：server 端正確性已驗，動 server 反而引入迴歸風險

## Risks / Trade-offs

- **[Risk] resourceMap 與頂層欄位雙寫漂移** → Mitigation：所有 WS handler 集中在 `HandleMessage` 內，patch resourceMap 後最後一行同步 patch 頂層 projection；polling fallback 走相同 helper（重構成 `ApplyServiceResourceState({ serviceId, resourceId, partial })` 一支單函式，確保兩處不會走分歧路徑）
- **[Risk] status.vue 既有計算依賴 `MyTicket.ticket.serviceName`** → Mitigation：不刪 serviceName，只在 resourceName 存在時改顯示 key，serviceName 仍保留用於 document title 等次要文案
- **[Risk] display.vue 多 resource 動畫鍵 `animateKey` 全域單一導致動畫互衝** → Mitigation：改成 `animateKeyMap: Record<resourceKey, number>`，各 cell 獨立動畫
- **[Risk] 三語 i18n 漏 key** → Mitigation：tasks 內加一步「node 比對三語 keys 完整對齊」
- **[Risk] 拿號頁選擇器 UX 在小螢幕（375px）橫向溢出** → Mitigation：segmented control 加 `flex-wrap: wrap` + 各選項 min-width 約束；單一 resource 不顯示選擇器（最常見場景無影響）
- **[Risk] find.vue 既有單筆 UX 在轉成 list 後迴歸破壞** → Mitigation：只在 `tickets.length > 1` 時走 list，length === 1 時 fallback 原邏輯（含原跳轉行為）

## Migration Plan

無 schema 變動，純前端 + i18n + 一個測試擴充。部署步驟：
1. 合併到 main → 走既有 Docker / Railway 部署管線即可
2. 上線後檢查：
   - 既有未綁 resource 的 QUEUE service：take/status/find/display 行為與部署前對照無差
   - 新綁多 resource 的 service：依 Playwright 驗收腳本逐步檢視
3. Rollback：若顧客頁有嚴重 UX 問題，可直接 git revert 本 commit；後端不需 rollback

## Open Questions

無
