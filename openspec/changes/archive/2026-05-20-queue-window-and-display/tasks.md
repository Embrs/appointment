## 1. 後端：QueueWindow CRUD endpoints

- [x] 1.1 新建 `server/routes/nuxt-api/merchant/queue-window.get.ts`：
  - `requireMerchant`
  - Query Zod：`{ serviceId: string }`
  - 驗服務屬於該商家 + `bookingMode=QUEUE`
  - `findMany({ where: { merchantId, serviceId } })`，按 weekday 升序
  - 回 `successResponse({ windows: [...] })`
- [x] 1.2 新建 `server/routes/nuxt-api/merchant/queue-window.put.ts`：
  - `requireMerchant`
  - Body Zod：`{ serviceId: string, windows: { weekday: 0-6, startTime: HH:mm regex, endTime: HH:mm regex, maxTickets: >=0, isActive: boolean }[] }`
  - 驗服務存在且 `bookingMode=QUEUE`
  - 事務：`deleteMany({ merchantId, serviceId })` → `createMany(windows.map(w => ({ merchantId, serviceId, ...w })))`
  - 回 `successResponse({ windows: [...] })`（重查回傳）
- [x] 1.3 三語訊息確認 `MSG_NOT_QUEUE_SERVICE` 已存在於 `server/utils/queue.ts`，可直接重用

## 2. 後端：公開 API 擴充 currentServing

- [x] 2.1 修改 `server/routes/nuxt-api/public/m/[slug].get.ts`：
  - 取出所有 QUEUE 服務的 id（`queueServiceIds`）
  - 查當日 `QueueCounter`：`prisma.queueCounter.findMany({ where: { merchantId, counterDate: getTicketDate(merchant.timezone), serviceId: { in: queueServiceIds } }, select: { serviceId, lastCalledNumber, lastTicketNumber } })`
  - 組 `counterMap: Map<serviceId, counter>`
  - 對每個 service 物件，若 `bookingMode=QUEUE`，補欄位：
    - `currentServing = counter?.lastCalledNumber ?? 0`
    - `ticketsTaken = counter?.lastTicketNumber ?? 0`
    - `waitingCount = max(0, ticketsTaken - currentServing)`
  - 非 QUEUE 服務不加這些欄位
- [x] 2.2 確認 `app/protocol/` 對應 `GetPublicMerchant` 的 response type 包含新欄位（型別宣告為 optional）

## 3. 後端測試

- [x] 3.1 新建 `server/__tests__/queue-window-put.test.ts`（純函式部分；若需 mock prisma 同既有風格）：
  - [x] 3.1.1 整批覆寫成功（先 deleteMany 後 createMany）
  - [x] 3.1.2 空陣列 → 全清除
  - [x] 3.1.3 跨商家越權 → 404
  - [x] 3.1.4 非 QUEUE 服務 → 400
  - [x] 3.1.5 weekday=7 / startTime='24:00' → 400

## 4. 前端 Protocol bindings

- [x] 4.1 新增 `$api.GetQueueWindows({ serviceId })` → `GET /nuxt-api/merchant/queue-window`
- [x] 4.2 新增 `$api.UpdateQueueWindows({ serviceId, windows })` → `PUT /nuxt-api/merchant/queue-window`
- [x] 4.3 types：`QueueWindowItem = { weekday: number; startTime: string; endTime: string; maxTickets: number; isActive: boolean }`
- [x] 4.4 `GetPublicMerchant` response type 擴 `currentServing?: number; waitingCount?: number; ticketsTaken?: number`

## 5. 前端商家後台 — QueueWindowEditor 元件

- [x] 5.1 新建 `app/components/biz/QueueWindowEditor.vue`：
  - Prop：`modelValue: QueueWindowItem[]`、`maxRowsPerDay = 1`
  - 7 列 weekday（週日 0 到週六 6）每列：
    - `ElSwitch` isActive
    - `ElTimePicker` startTime / endTime（format 'HH:mm'）
    - `ElInputNumber` maxTickets（min=0、helper：「0 = 無限」）
  - emit `'update:modelValue'`
- [x] 5.2 確認元件可獨立掛載與測試（不依賴外部 store）

## 6. 前端商家後台 — 設定頁面

- [x] 6.1 新建 `app/pages/admin/queue-window.vue`：
  - `definePageMeta({ layout: 'back-desk', middleware: ['merchant'] })`
  - 載入時 `$api.GetServiceList()` 過濾 `bookingMode=QUEUE`
  - 上方 `ElSelect` 選服務
  - 中間 `BizQueueWindowEditor`
  - 下方「儲存」按鈕 → `$api.UpdateQueueWindows`
  - 無 QUEUE 服務時顯示引導到 `/admin/services`
- [x] 6.2 修改 `app/layouts/back-desk.vue`（或對應導航元件）：側邊欄「號碼牌」群組下加「領號時間設定」連結
- [x] 6.3 i18n 補 key `admin.queueWindow.title`、`admin.queueWindow.saveSuccess`、`admin.queueWindow.maxTicketsHint` 等三語

## 7. 前端顧客領號頁顯示叫號

- [x] 7.1 修改 `app/pages/m/[slug]/queue/index.vue`：
  - `ApiLoad` 後若 `merchant.value` 存在則 `queueStore.Connect(merchant.value.id)`
  - 計算 `displayState(serviceId)`：
    - 優先讀 `queueStore.serviceMap[serviceId]`（WS 推播後的最新值）
    - 否則 fallback 到 `queueServices.value.find(s => s.id === serviceId)` 的初始 `currentServing` / `waitingCount`
  - 每個服務卡片在原 `cardDesc` 與 `cardFoot` 之間插入新區塊：
    - `ticketsTaken === 0` → 顯示「尚未開始服務」
    - `currentServing === 0 && ticketsTaken > 0` → 「目前叫到 — · 等待 {waitingCount} 人」
    - 一般 → 「目前叫到 {currentServing} 號 · 等待 {waitingCount} 人」
  - `onBeforeUnmount` 呼叫 `queueStore.Disconnect()`
- [x] 7.2 i18n 補 key `queue.page.currentServing`、`queue.page.waitingCount`、`queue.page.notServing`、`queue.page.notStarted` 三語

## 8. 商家面引導

- [x] 8.1 在 `/admin/queue` 控制台頁面若該商家沒有任何 QueueWindow，加 `ElAlert` 提示「尚未設定領號時間 → 設定」+ 連結到 `/admin/queue-window`

## 9. 後端測試與整合

- [x] 9.1 新增 `server/__tests__/public-merchant-currentServing.test.ts`：
  - [x] 9.1.1 QUEUE service 含 counter 時回 currentServing/waitingCount
  - [x] 9.1.2 QUEUE service 無 counter 時回 0
  - [x] 9.1.3 非 QUEUE service 不含這些欄位（route 內 `if (s.bookingMode !== 'QUEUE') return base` 邏輯覆蓋）
- [x] 9.2 確認既有 `/public/queue/take` 測試仍通過（本 change 未動 take.post.ts；vitest 全 54 案通過）

## 10. UI 實機驗證（Playwright MCP）

> 待使用者本地端啟動 `npm run dev` 後執行；本 change 程式碼層 lint/test/build 已通過

- [ ] 10.1 商家登入 → `/admin/queue-window`（先建立 QUEUE 服務）→ 設定週一至週五 09:00-18:00 maxTickets=20 → 儲存（截圖：`screenshots/queue-window-and-display/01-window-saved.png`）
- [ ] 10.2 重新整理頁面 → 數值持久化（截圖：`02-reload.png`）
- [ ] 10.3 顧客面 `/m/[slug]/queue` → 在時間窗內可正常領號（**不再撞 MSG_QUEUE_WINDOW_CLOSED**）（截圖：`03-take-success.png`）
- [ ] 10.4 商家後台叫到下一號 → 顧客領號頁卡片即時更新「目前叫到 1 號」（不需重新整理）（截圖：`04-live-update.png`）
- [ ] 10.5 第二位顧客領號 → 第一位顧客的頁面「等待人數 +1」（截圖：`05-waiting-count.png`）
- [ ] 10.6 設定時間窗外（例如將週一改 08:00-09:00 且當前為 14:00） → 領號回 `MSG_QUEUE_WINDOW_CLOSED`（驗證根本問題已修：是「窗外」才報錯，而非「沒設定」必然報錯）（截圖：`06-window-closed.png`）
- [ ] 10.7 商家面 `/admin/queue` 若沒設定 QueueWindow → 看到引導 alert（截圖：`07-admin-prompt.png`）
- [ ] 10.8 開兩個瀏覽器 tab 模擬顧客 + 商家：商家叫號、顧客領號頁同步更新

## 11. 部署同步驗證

> 待 PR 合併 main 後執行；schema 未動，無 migration 需套用

- [ ] 11.1 PR 合併 main → Railway 拉新 image → 觀察日誌 build 成功（schema 無變動，無 migration 需套用）
- [ ] 11.2 測試站既有 QUEUE 服務商家進設定頁建立 QueueWindow → 顧客面驗證可領號
- [ ] 11.3 正式站部署完成後同樣驗證

## 12. 文件

- [x] 12.1 更新 `.claude/knowledge/queue-realtime.md`：補 `merchant/queue-window` API、補 `/public/m/[slug]` currentServing 欄位
- [x] 12.2 更新 `.claude/knowledge/api-modules.md`：merchant/ 表格加 `GET/PUT /merchant/queue-window`

## 13. 驗收

- [x] 13.1 `npm run lint` 通過（本 change 程式碼 0 errors；`.vscode/demo.vue` 既有錯誤來自 initial commit 與本 change 無關）
- [x] 13.2 `npm test` 通過（4 files / 54 cases）
- [x] 13.3 `npm run build` 通過（含 `queue-window.{get,put}.mjs`）
- [x] 13.4 `openspec validate queue-window-and-display --strict` 通過
