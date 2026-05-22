## 1. 前置確認

- [x] 1.1 確認階段 1 已歸檔（`openspec/changes/archive/2026-05-21-add-queue-multi-resource-backend/` 存在）且 main spec `queue-tickets/spec.md` 已含「QueueTicket/QueueCounter 帶 resourceId / getResourcesForQueueService / resourceId 驗證規則 / queue/today 回 resources 陣列 / public/m/[slug] 回 resources 陣列」等 phase 1 ADDED requirements
- [x] 1.2 確認 `GET /public/m/[slug]` 回 `services[].resources[]`（含 `id/name/displayOrder/currentServing/waitingCount/avgServiceMinutes/estimatedNextCallMinutes` 等欄位）；未綁 resource 的 service 回 `[{id:null,name:null,...}]` 單元素陣列
- [x] 1.3 確認 `GET /public/queue/[id]` / `claim/[token]` 回 `resourceId/resourceName/ticketNumberDisplay` 三欄位（未綁時為 null）
- [x] 1.4 確認 WS payload `CALL_NEXT / TICKET_DONE / TICKET_SKIPPED / TICKET_TAKEN` 已帶 `resourceId/resourceName`（未綁時為 null/null）

## 2. i18n 文案（zh / en / ja 三語）

- [x] 2.1 `i18n/locales/zh.js` 新增 7 個 keys：
  - `queue.page.ticketWithRoom`: `"{room} {number} 號"`
  - `queue.page.statusCalledHintWithRoom`: `"請至 {room}，輪到您了！"`
  - `queue.take.selectRoomLabel`: `"選擇診間／櫃台"`
  - `queue.take.selectRoomHint`: `"目前各間等待狀況可幫您決策"`
  - `queue.take.roomStat`: `"現叫 {current} 號・等待 {waiting} 人"`
  - `display.gotoRoom`: `"請至 {room}"`
  - `display.tts.callPhraseWithRoom`: `"{number} 號，請至 {room}"`
- [x] 2.2 `i18n/locales/en.js` 補英文對應（保持 `{room}/{number}/{current}/{waiting}` 變數位）
- [x] 2.3 `i18n/locales/ja.js` 補日文對應（保持 `{room}/{number}/{current}/{waiting}` 變數位）
- [x] 2.4 用 node 比對三語 keys 完整對齊：執行 `node -e "const z=require('./i18n/locales/zh.js').default;const e=require('./i18n/locales/en.js').default;const j=require('./i18n/locales/ja.js').default;const keys=['queue.page.ticketWithRoom','queue.page.statusCalledHintWithRoom','queue.take.selectRoomLabel','queue.take.selectRoomHint','queue.take.roomStat','display.gotoRoom','display.tts.callPhraseWithRoom'];const get=(o,k)=>k.split('.').reduce((a,b)=>a&&a[b],o);keys.forEach(k=>console.log(k,'zh:',!!get(z,k),'en:',!!get(e,k),'ja:',!!get(j,k)))"` 確認全部 true（若 locales 不是 CommonJS 改用對應 ESM 讀法）

## 3. Realtime store 改造（`app/stores/7.store-queue-realtime.ts`）

- [x] 3.1 定義 `ResourceServingState` interface：`{ currentServing, servingTicketId, servingCustomerLastName, servingCustomerTitle, avgServiceMinutes, waitingCount, ticketsTaken, lastEventAt }`
- [x] 3.2 擴 `ServiceServingState` 加 `resourceMap: Record<string, ResourceServingState>`，保留原頂層欄位作為「最近事件投影」
- [x] 3.3 新增 helper `ApplyServiceResourceState({ serviceId, resourceId, partial })`：以 `resourceKey = resourceId ?? '__null__'` 寫入 `resourceMap`，並同步 patch 頂層 projection
- [x] 3.4 改 `HandleMessage` 內 `CALL_NEXT / TICKET_DONE / TICKET_SKIPPED / TICKET_TAKEN`：所有原本直接寫 `serviceMap[serviceId]` 的位置改呼叫 `ApplyServiceResourceState`，並從 msg 取 `resourceId/resourceName`（未帶時走 `'__null__'`）
- [x] 3.5 改 `HandleMessage` 的 myTicket 同步邏輯：除了既有的 `msg.servingTicketId === myTicketId.value` 比對外，再加 `myTicket.value.ticket.resourceId === msg.resourceId ?? null` 檢查（不一致時跳過 currentServing/waitingAhead patch）
- [x] 3.6 改 polling fallback（`StartPolling` 內）：取回 myTicket 後同樣以 `ApplyServiceResourceState({ serviceId, resourceId: res.data.resourceId ?? null, partial: {...} })` 寫入
- [x] 3.7 擴 `GetEtaForTicket(ticket, serviceId)` 加可選參數 `resourceId?: string | null`：從 `serviceMap[serviceId].resourceMap[resourceId ?? '__null__']` 取 currentServing 與 avgServiceMinutes；無參數時 fallback 至頂層 projection（向後相容既有 admin 呼叫端）
- [x] 3.8 確認 `myTicket` 的型別已涵蓋 `ticket.resourceId/resourceName`、`displayLabel`（從 `GetQueueTicketRes` 取；若 type 尚未含這些欄位，補在 `app/protocol/fetch-api/api/queue/type.d.ts`）
- [x] 3.9 驗向後相容：未綁 resource 的 service 走 `'__null__'` bucket，admin/queue.vue 既有讀 `serviceMap[s.id].currentServing` 仍能取到正確值

## 4. 拿號頁（`app/pages/m/[slug]/queue/index.vue`）

- [x] 4.1 從 `PublicServiceItem` 取 `service.resources[]`；若 `resources` 為空陣列或 `resources.length === 1 && resources[0].id === null`，視為「未綁 resource」走原 UX
- [x] 4.2 服務卡片新增 segmented control：條件 `resources.length >= 1 && resources.some(r => r.id !== null)` 時渲染；單一 resource（`resources.length === 1`）內部自動選定但隱藏選擇器 UI（仍保留 hidden state）
- [x] 4.3 segmented control label 用 `queue.take.selectRoomLabel`、hint 用 `queue.take.selectRoomHint`；每個 option 顯示 `resource.name`，副標 `queue.take.roomStat` 帶 `current=resource.currentServing`、`waiting=resource.waitingCount`
- [x] 4.4 卡片內維護 `selectedResourceIdByServiceId: Record<string, string|null>`；初始值：單一 resource 時自動選 `resources[0].id`、多 resource 時 null（必須使用者選一個才能送）
- [x] 4.5 「拿號」按鈕：未綁 resource 時與本變更前一致；綁 resource 時 disabled 直到 `selectedResourceIdByServiceId[serviceId]` 有值；submit 時 `$api.PostPublicQueueTake({ ..., resourceId: selectedResourceIdByServiceId[serviceId] })`
- [x] 4.6 RWD：segmented control 加 `flex-wrap: wrap`、每個 option `min-width` 約束（避免 375px 寬時溢出）
- [x] 4.7 驗未綁 resource service 卡片 UI 與本變更前完全一致（無新元件、無新文字）

## 5. 查號頁（`app/pages/m/[slug]/queue/status.vue`）

- [x] 5.1 從 `MyTicket.value.ticket` 讀 `resourceId/resourceName/displayLabel`（型別來自 store 的 myTicket）
- [x] 5.2 主號碼顯示：若 `resourceName` 非空字串，改用 `queue.page.ticketWithRoom` 帶 `{room:resourceName, number:MyNumber}`；否則沿用既有 key（注意：display 可能在多處組件 `BizQueueDisplay` 內，需檢查傳入 prop 或直接在 status.vue 內 computed）
- [x] 5.3 `StatusHint` computed：`IsCalled` 時若有 `resourceName` 用 `queue.page.statusCalledHintWithRoom`，否則 fallback `queue.page.statusCalledHint`
- [x] 5.4 document title (`useHead`) 暫不改（既有 titleCalled 已含 serviceName + n，避免破壞），確認 CALLED 時瀏覽器分頁仍能正確顯示
- [x] 5.5 驗無 resource ticket：所有文案與本變更前對照無差異

## 6. 找號頁（`app/pages/m/[slug]/queue/find.vue`）

- [x] 6.1 inspect 既有 API 回傳結構（可能單筆或多筆）；若目前只回單筆需確認 phase 1 是否擴成 `tickets[]`，若否，find 頁直接以「最多一筆」處理但仍要顯示 resourceName
- [x] 6.2 `tickets.length > 1` 時渲染列表：每筆顯示 `resourceName` 存在則「{resourceName} {ticketNumber} 號 - {serviceName}」否則「{ticketNumber} 號 - {serviceName}」；每筆附 ElButton「查看狀態」跳 `status?id={ticketId}&token={claimToken}`
- [x] 6.3 `tickets.length === 1` 時走本變更前單筆 UX（保留既有自動跳轉行為）
- [x] 6.4 `tickets.length === 0` 時走本變更前查無資料 UX
- [x] 6.5 驗未綁 resource 的回查行為（單筆無 resourceName）與本變更前一致

## 7. 店面大螢幕（`app/pages/m/[slug]/display.vue`）

- [x] 7.1 從 `ActiveService.resources` 推導 `IsMultiResource` computed：`resources.length >= 2 && resources.some(r => r.id !== null)`
- [x] 7.2 改 `ActiveServiceId` 自動挑邏輯：query 無 serviceId 時，先把 QueueServices 各 service 的 `resources[]` 展平判斷「至少一個 resource waitingCount > 0」者納入候選池；候選池為空時退到 ticketsTaken 最大
- [x] 7.3 template 加多 resource 分區區塊：`v-if="IsMultiResource"` 顯示 `<div class="display__grid" :class="GridClass">`，內部 `v-for="resource in ActiveService.resources" :key="resource.id"`，每個 cell 顯示 `{resourceName}` 大字、`resourceMap[resource.id].currentServing`、副標 `display.gotoRoom { room: resource.name }`、「下位」「等候」資訊
- [x] 7.4 `GridClass` computed：`resources.length === 2` 回 `display__grid--two`，`>= 3` 回 `display__grid--auto`；CSS 對應分別為 `grid-template-columns: 1fr 1fr` 與 `repeat(auto-fit, minmax(360px, 1fr))`
- [x] 7.5 `v-else`（單一 / 未綁 resource）維持本變更前單一全螢幕 layout
- [x] 7.6 改 `animateKey` 為 `animateKeyMap: Record<string, number>`（key=resourceId 或 '__null__'）；各 cell 用各自 key
- [x] 7.7 改 TTS 觸發：watch 多 resource 的 `resourceMap` 變化（不是只 watch ActiveService 頂層 currentServing），對每個 (serviceId, resourceId) 各自記錄 `lastSpokenNumberByResource: Record<string, number>`；新 currentServing 與既存不同時呼叫 `tts.Speak(...)`
- [x] 7.8 TTS 句子：當 cell 對應 resource `resourceName` 存在時用 `display.tts.callPhraseWithRoom { number, room }`，否則 fallback `display.tts.callPhrase { number }`
- [x] 7.9 init 階段：`ApiLoad` 內把 `services[i].resources[j]` 灌入 `serviceMap[serviceId].resourceMap[resource.id ?? '__null__']`（透過 `ApplyServiceResourceState`）
- [x] 7.10 RWD：1920 / 1280 / 768 / 375 寬度下分區排版皆能保持「一眼看全」原則（≥3 resource 在 768 以下可能換行，可接受）；未綁 resource 路徑全螢幕單號碼仍居中

## 8. 後端測試擴充

- [x] 8.1 開 `server/__tests__/display-tts.test.ts` 查既有結構（既存 test fixture / mock 風格）
- [x] 8.2 新增 test case「`resourceName` 存在時挑 `callPhraseWithRoom`」：mock i18n / TTS helper，input ticketNumber=5、resourceName='A 診間'，assert 句子為「5 號，請至 A 診間」（zh）
- [x] 8.3 新增 test case「`resourceName` 為 null 時 fallback `callPhrase`」：assert 句子無 room 變數
- [x] 8.4 三語 fixture 各補一組（zh/en/ja）確保 i18n key 替換正常

## 9. Lint / 單元測試

- [x] 9.1 執行 `npm test`，全綠（含新加的 display-tts test、既有 queue-* 測試不破壞）
- [x] 9.2 執行 `npm run lint`，無新增 warning / error

## 10. Playwright MCP 端到端驗收（必做）

- [x] 10.1 啟動 `npm run dev`，確認端口 3000 可訪
- [x] 10.2 使用 Playwright MCP 開瀏覽器，登入既有測試商家後台、確認有 QUEUE service 綁 A、B 兩 resource（若無，先補設）
- [x] 10.3 開兩個 `/admin/queue` 分頁，分別把 segmented control「目前操作」切到 A、B
- [x] 10.4 開公開頁 `/m/{slug}/queue/`，選 A 拿號（驗證得 A 1 號 + 顧客 status 頁顯示「A 診間 1 號」）
- [x] 10.5 用第二個瀏覽器分頁開 `/m/{slug}/queue/`，選 B 拿號（驗證得 B 1 號 + 顯示「B 診間 1 號」）
- [x] 10.6 在 A 分頁 admin 點「叫下一號」→ 開 `/m/{slug}/display` 驗大螢幕顯示「A 診間 / 1」+ TTS 播放「1 號，請至 A 診間」；A 顧客頁顯示「請至 A 診間，輪到您了！」
- [x] 10.7 在 B 分頁 admin 點「叫下一號」→ 大螢幕 B 區更新「B 診間 / 1」；B 顧客頁顯示「請至 B 診間，輪到您了！」
- [x] 10.8 兩診同時叫號驗證 TTS 不互相壓制（A 播完再播 B、不丟句）
- [x] 10.9 切換到「未綁 resource」的 QUEUE service：take/status/display UX 完全不變（迴歸驗證）
- [x] 10.10 切 locale 至 en、ja 各跑一次 take/status/display 主畫面，驗 i18n 文案正確替換、無 missing key
- [x] 10.11 `browser_resize` 至 1920 / 1280 / 768 / 375 寬度，驗 display 與 take 頁 RWD：display 多 resource 分區 ≤2 左右、≥3 grid 自適應；take segmented control 不溢出
- [x] 10.12 find.vue 同手機末 4 碼回查：在 A、B 都拿過號的顧客回查驗證列出兩筆

## 11. 結束

- [x] 11.1 全部任務完成、Playwright 驗收 pass 後，呼叫 `openspec validate add-queue-multi-resource-customer-ui --strict` 確認 spec 合法
- [x] 11.2 用 openspec-archive-change skill 歸檔
