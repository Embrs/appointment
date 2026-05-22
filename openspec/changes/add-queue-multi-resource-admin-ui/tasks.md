## 1. 前置確認

- [ ] 1.1 確認階段 1 已歸檔（`openspec/changes/archive/2026-05-21-add-queue-multi-resource-backend/` 存在）且 main spec `queue-tickets/spec.md` 已含 `QueueTicket / QueueCounter 帶 resourceId` 等 6 個 ADDED requirements
- [ ] 1.2 確認 `GET /nuxt-api/queue/today` 對「未綁 resource」的 QUEUE service 回 `resources: [{ id: null, name: null, counter, tickets }]` fallback（若回空陣列要在前端加防呆）
- [ ] 1.3 確認 `refine-admin-queue-console` 之實作仍在 working tree（單卡 tabs / 搜尋 / 多 CALLED row 級操作 / split-button）— 本 change 會把這些 UX 下沉一層到子卡

## 2. i18n 文案（zh / en / ja 三語）

- [ ] 2.1 `i18n/locales/zh.js` 新增三個 keys：
  - `admin.queue.operatingRoom.label`: "目前操作"
  - `service.edit.queueResourcesLabel`: "可叫號的診間／櫃台／醫師（選填）"
  - `service.edit.queueResourcesHint`: "綁定後每個資源獨立一條號碼牌隊列；不綁則維持單一號池"
- [ ] 2.2 `i18n/locales/en.js` 補英文對應
- [ ] 2.3 `i18n/locales/ja.js` 補日文對應
- [ ] 2.4 node 比對三語 keys 完整對齊（無孤兒 key、無 typo）

## 3. Service 編輯彈窗（`app/components/open/dialog/service-edit.vue`）

- [ ] 3.1 找出 L39-41 附近 `showResource` computed / template 條件，把 `bookingMode` 白名單擴為 `['RESOURCE', 'RESOURCE_OPTIONAL', 'QUEUE']`（或對應的等效寫法）
- [ ] 3.2 標題 / 提示文按 `bookingMode === 'QUEUE'` 條件化：QUEUE 模式使用 `service.edit.queueResourcesLabel` + `service.edit.queueResourcesHint`，其他模式沿用既有 i18n
- [ ] 3.3 QUEUE 模式留空 `resourceIds` 必須能送出（不在前端加 required 驗證；後端已接受空陣列）
- [ ] 3.4 QUEUE 模式選多個 resource 也能送出，提交後彈窗 close、清單刷新

## 4. 叫號台子卡資料層改造（`app/pages/admin/queue.vue`）

- [ ] 4.1 確認 store / API 已取到 `service.resources[]`（階段 1 結果）；若 service `resources` 缺漏或空，前端做 fallback：`[{ id: null, name: null, counter: service.counter, tickets: service.tickets }]`
- [ ] 4.2 `ApiCallNext`（或對應 method）簽名擴為 `(serviceId, resourceId?: string | null)`，body 加 `resourceId` 後送 `POST /nuxt-api/queue/call-next`
- [ ] 4.3 「現場登記」入口（`openQueueWalkInDialog` 或對應呼叫）改為帶 `{ serviceId, resourceId }`；單卡情境傳 `resourceId: null`
- [ ] 4.4 把 `QueueControlPanel` 傳遞的 props 補上 service 完整資料（含 `resources[]`），不再只傳 `service.tickets`

## 5. 子卡渲染（`app/components/biz/QueueControlPanel.vue`）

- [ ] 5.1 template 改為「外層卡片 + 內層 `v-for="resource in service.resources"` 渲染 `.BizQueueControlPanel__resource` 區塊」；單一 resource 且 `resource.id === null` 時隱藏子卡標題（外觀同舊版單卡）
- [ ] 5.2 把 `ServingTickets` / `WaitingTickets` / `FilteredTickets` / `TabCounts` / `searchInput` / `activeTab` / `inflightDoneIds` / `inflightSkipIds` 等狀態從「service 層」下沉到「resource 層」：用 `Map<resourceKey, { tab, search, inflight... }>`，`resourceKey` 為 `resource.id ?? '__null__'`
- [ ] 5.3 子卡內動作列保留「叫下一號」+「現場登記」兩顆按鈕；移除子卡頂層的「完成 / 過號」（由 CALLED row 內各自掛載，沿用 refine 已實作的 row 級操作）
- [ ] 5.4 「服務中」區渲染對應 (service, resource) 的 CALLED 票；row 級「完成 / 過號」呼叫 `ApiDone(ticketId)` / `ApiSkip(ticketId)`（沿用既有）
- [ ] 5.5 tabs + 搜尋 + 列表 max-height 套用至子卡 scope（複用 refine 已實作的 segmented control / ElInput / max-height CSS，搬到子卡內）
- [ ] 5.6 子卡頂部顯示 resource name（`resource.id !== null` 時）與 currentServing 大字
- [ ] 5.7 「叫下一號」按鈕呼叫 `emit('click-call-next', service.id, resource.id ?? null)`；「現場登記」呼叫 `emit('click-walk-in', service.id, resource.id ?? null)`

## 6. Segmented control「目前操作」

- [ ] 6.1 計算 `ShowOperatingControl = service.resources.length >= 2 && service.resources.some(r => r.id !== null)`，false 時不渲染
- [ ] 6.2 元件加 ref `operatingResourceId`，初始值從 `localStorage.getItem('queueOperatingResource:{merchantId}:{serviceId}')` 讀；若值不在當前 resources 內，fallback 到 `resources[0].id` 並回寫 localStorage
- [ ] 6.3 segmented control 元素（自製 button 或 ElSegmented）label 顯示 `admin.queue.operatingRoom.label`，options 為各 active resource name
- [ ] 6.4 切換時 `localStorage.setItem(...)` 立即寫入；觸發 `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` 至對應子卡 DOM ref
- [ ] 6.5 被選中的子卡套用 modifier class（如 `.BizQueueControlPanel__resource--is-active`），短暫高亮（CSS animation 1s 內結束）
- [ ] 6.6 確認 segmented control **不**鎖其他子卡按鈕：未被選中的子卡仍可點「叫下一號 / 現場登記 / 完成 / 過號」
- [ ] 6.7 watch `service.resources` 變化，若選中的 resourceId 被刪除或停用，自動 fallback 到 resources[0] 並寫回 localStorage

## 7. RWD 樣式

- [ ] 7.1 `.BizQueueControlPanel__resources` grid：≥ 1280px `repeat(auto-fit, minmax(360px, 1fr))`、768–1279px `repeat(auto-fit, minmax(320px, 1fr))`、< 768px `1fr`
- [ ] 7.2 子卡內各按鈕觸控區 ≥ 44px（平板）
- [ ] 7.3 segmented control 在 < 768px 可水平捲動（`overflow-x: auto`、`flex-wrap: nowrap`），避免換行擠壓
- [ ] 7.4 「服務中」區 row 在 < 768px `flex-wrap: wrap`（沿用 refine 既有規格）

## 8. 現場登記彈窗（`app/components/open/dialog/queue-walk-in.vue`）

- [ ] 8.1 彈窗 props / open payload 加 `resourceId: string | null`（由開啟方注入）
- [ ] 8.2 內部 state 初始 `resourceId` 來自開啟 payload；彈窗 open 時每次以開啟 payload 全量覆蓋（避免殘留上次值）
- [ ] 8.3 submit 時 body 含 `resourceId`（null 時可省略或送 `null`，後端皆兼容）
- [ ] 8.4 彈窗 close 時清空內部 state（含 `resourceId`）
- [ ] 8.5 確認 `useQueueWalkIn` composable / dialog 系統能正確傳遞 `resourceId`

## 9. 程式品質

- [ ] 9.1 `npm run lint` 本次改動範圍 0 警告 0 錯誤
- [ ] 9.2 `npm test` 全綠（本階段不新增 Vitest，但既有測試不可破）
- [ ] 9.3 TypeScript 不引入新類型噪音；新加的 `resourceId?: string | null` 型別正確傳遞
- [ ] 9.4 不新增多餘 helper / 抽象；遵循 karpathy-guidelines 與既有 codebase 風格

## 10. Playwright MCP 實機驗收

- [ ] 10.1 啟動 `npm run dev`（端口 3000）
- [ ] 10.2 商家後台登入測試商家
- [ ] 10.3 在「服務管理」找一個 QUEUE service（或新建一個），編輯彈窗驗證：
  - bookingMode 切到 QUEUE 時資源選擇器出現
  - 標題顯示「可叫號的診間／櫃台／醫師（選填）」
  - 提示顯示「綁定後每個資源獨立一條號碼牌隊列；不綁則維持單一號池」
  - 綁定 A、B 兩個 Resource 並儲存成功
- [ ] 10.4 進 `/admin/queue` 驗證綁了 A/B 的 service 渲染成兩張子卡並列
- [ ] 10.5 子卡 A 點「叫下一號」：DevTools Network 驗證 `POST /nuxt-api/queue/call-next` body 含 `resourceId: 'A_id'`；子卡 A 服務中區出現新 CALLED 票，子卡 B 不變
- [ ] 10.6 子卡 B 點「現場登記」：填姓名稱謂送出，Network 驗證 `POST /nuxt-api/queue/create-for-customer` body 含 `resourceId: 'B_id'`；子卡 B WAITING 列表新增票，子卡 A 不變
- [ ] 10.7 segmented control 切換 A↔B：子卡套用 active modifier 並 scroll-into-view；切換不阻止 B 子卡按鈕可點
- [ ] 10.8 重整頁面：segmented control 預設選中上次選的 resource（localStorage 持久化驗證）
- [ ] 10.9 切換到未綁 resource 的另一個 QUEUE service 卡片：UX 完全不變（單卡、無 segmented control、無子卡標題）；叫號與現場登記 body 不含 `resourceId`（或為 null）
- [ ] 10.10 切換 i18n 至 en：標題、提示、segmented control label、ticker controls 全部正確翻譯
- [ ] 10.11 切換 i18n 至 ja：同上驗證
- [ ] 10.12 `browser_resize` 至 1280×900：子卡橫排
- [ ] 10.13 `browser_resize` 至 1024×768：兩欄
- [ ] 10.14 `browser_resize` 至 375×812：單欄垂直堆疊、segmented control 可水平捲動、按鈕觸控區 ≥ 44px
- [ ] 10.15 截圖暫存於 `.playwright-mcp/`（已 gitignore），不入 repo

## 11. 文件 / 知識庫

- [ ] 11.1 更新 `.claude/knowledge/queue-realtime.md` 補「商家叫號台多 resource 子卡 + segmented control + 現場登記注入 resourceId」段，列出 i18n keys 與 RWD 斷點
- [ ] 11.2 確認 CLAUDE.md 對應段落不需更新（`queue-realtime.md` 描述已涵蓋本階段）
- [ ] 11.3 commit 訊息使用 `feat: 商家叫號台多 resource 子卡 UX 與 segmented control`（Conventional Commits）— 待使用者下指令時執行

## 12. 收尾與歸檔

- [ ] 12.1 跑完所有驗收後 `openspec status --change add-queue-multi-resource-admin-ui` 全綠
- [ ] 12.2 待使用者下指令時用 `openspec-archive-change` skill 歸檔本 change
