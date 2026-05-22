## 1. i18n 文案

- [x] 1.1 於 `i18n/locales/zh.js` 新增 `admin.queue.tabs.{waiting,called,history,countSuffix}`、`admin.queue.search.{placeholder,empty,clear}`、`admin.queue.serving.empty`、`admin.queue.conn.{live,off}`；按鈕文案複用既有 `queue.page.markDone/markSkip`、ticket 狀態複用 `queue.status.*`
- [x] 1.2 於 `i18n/locales/en.js` 補齊對應英文文案（與既有 `queue.*` / `display.*` 命名風格一致）
- [x] 1.3 於 `i18n/locales/ja.js` 補齊對應日文文案
- [x] 1.4 確認三檔 key 完整對齊，無孤兒 key（node 比對：三語各 10 keys、互無 diff）

## 2. 頁首動作列重整（admin/queue.vue）

- [x] 2.1 將「開啟顯示頁」與「複製連結」兩顆 ElButton 合併為 ElDropdown `split-button`：主按鈕觸發 `ClickOpenDisplay`、dropdown item 觸發 `ClickCopyDisplayLink`（透過 `HandleDisplayMenuCmd` command handler）
- [x] 2.2 無 QUEUE 服務時整顆 split-button disabled，保留既有 `display.needQueueService` tooltip（ElTooltip `:disabled="HasAnyQueueService"` 反向觸發）
- [x] 2.3 連線狀態 chip 樣式調整為頁首右上角獨立呈現（不再與兩顆 ElButton 平鋪，套 `margin-left: auto`）
- [x] 2.4 移除 `<template v-else>` / `v-if="!HasAnyQueueService"` 分支冗餘，統一以 disabled 控制
- [x] 2.5 確認 data-testid `admin-open-display-btn`、`admin-copy-display-link-btn` 仍存在（保留於 ElDropdown 與 ElDropdownItem 上）

## 3. 卡片動作層級重組（QueueControlPanel.vue）

- [x] 3.1 卡片頂層 `.BizQueueControlPanel__actions` 僅保留「叫下一號」（主，type=primary）與「現場登記」（次，default）兩顆按鈕
- [x] 3.2 移除卡片頂層的 `ElButton(完成)` 與 `ElButton(過號)`（由 row 內動作取代）
- [x] 3.3 將 `ServingTicket` computed 改為 `ServingTickets`（陣列、按 ticketNumber 升序）；`BizQueueDisplay` 大字顯示沿用最後叫到號碼
- [x] 3.4 props `servingTicketId` 標 `@deprecated` 仍接收以保持向後相容，UI 改用 `ServingTickets` 不再強依賴單值

## 4. 服務中區（多 CALLED 並列）

- [x] 4.1 新增 `.BizQueueControlPanel__serving` 區塊：垂直清單呈現 `ServingTickets`，每張 row 含號碼大字、姓 + 稱謂、行動按鈕區
- [x] 4.2 每張 CALLED row 內掛「完成 / 過號」兩顆 small ElButton（type=success / warning）
- [x] 4.3 過號確認彈窗沿用 admin/queue.vue 既有 `ApiSkip`（emit click-skip 經由 `useAsk.Any` 處理）；行為不變
- [x] 4.4 空狀態 `ServingTickets.length === 0` 顯示 `admin.queue.serving.empty`，data-testid `queue-serving-empty`
- [x] 4.5 row 級 loading：`inflightDoneIds` / `inflightSkipIds` 兩個 `Set<string>`，watch service.tickets 自動清除

## 5. 列表 tabs + 搜尋（QueueControlPanel.vue）

- [x] 5.1 `activeTab: TabId`（預設 `'waiting'`）與 `searchInput: string`
- [x] 5.2 `FilteredTickets` computed：依 activeTab 篩 status、再經 `MatchTicket` 純函式比對 searchInput
- [x] 5.3 `TabCounts` computed：`{ waiting, called, history }`，tab 標題後綴 `（{n}）`
- [x] 5.4 自製 segmented control（button.BizQueueControlPanel__tab）；切換 tab 不清空 `searchInput`
- [x] 5.5 搜尋框使用 `ElInput` + `clearable`（沿用 placeholder i18n）
- [x] 5.6 `.BizQueueControlPanel__list-body` 套 `max-height: min(60vh, 480px)` + `overflow-y: auto`
- [x] 5.7 搜尋無結果顯示 `admin.queue.search.empty` + 「清除搜尋」link button（data-testid `queue-search-clear`）

## 6. RWD 強化

- [x] 6.1 卡片 grid 桌機 ≥ 1280px `minmax(360px, 1fr)`、平板 768–1279px `minmax(320px, 1fr)`、< 768px 單欄
- [x] 6.2 平板（≥ 768px）卡片頂層按鈕觸控區 `min-height: 44px`
- [x] 6.3 手機（< 768px）`.BizQueueControlPanel__actions` 改 column，叫下一號 + 現場登記皆 100% 寬
- [x] 6.4 服務中區 row：< 768px `flex-wrap: wrap`，動作區換行至下方
- [x] 6.5 列表 row：< 768px `flex-wrap` 並把電話末 4 碼改為 chip 樣式換行
- [x] 6.6 toolbar：< 768px 改 column，tabs 橫向 `overflow-x: auto`、搜尋框 100% 寬

## 7. 行為一致性

- [x] 7.1 admin/queue.vue 既有 `watch(queueStore.lastEventAt)` 不動，WS done/skip 後仍會 `ApiLoad`，inflight Set 透過 `watch(service.tickets)` 同步清空
- [x] 7.2 `ServingTickets` 按 `ticketNumber asc` 排序，新叫到的票（號碼更大）排到末尾
- [x] 7.3 row 級 loading：`inflightDoneIds` / `inflightSkipIds` 個別追蹤每張 ticket，A、B 互不阻塞
- [x] 7.4 既有 data-testid 全數保留：`admin-open-display-btn`、`admin-copy-display-link-btn`、`queue-walk-in-entry`、`queue-row-eta`、`queue-no-window-alert`；另新增 `queue-call-next-btn` / `queue-serving-row` / `queue-row-done-btn` / `queue-row-skip-btn` / `queue-tab-*` / `queue-search-input` / `queue-search-clear` / `queue-list-empty` / `queue-serving-empty`

## 8. 程式品質

- [x] 8.1 `npm run lint` — 本次改動範圍（admin/queue.vue、QueueControlPanel.vue、3 個 i18n locale）0 警告 0 錯誤；既有 `.vscode/demo.vue` 一支與本次無關
- [x] 8.2 `npm test` — Vitest 13 test files / 189 tests 全綠
- [x] 8.3 TypeScript：本 repo CI 未啟用 vue-tsc，且 Pug template `v-for` scope inference 是既有 codebase limitation（admin/queue.vue 原本 `v-for="s in today.services"` 即報相同錯誤），本次未引入新類型噪音；runtime 行為正常
- [x] 8.4 移除 `template v-else / v-if HasAnyQueueService` 雙分支冗餘；`servingTicketId` prop 改為 `@deprecated` 標註保留以維持父層舊呼叫不破壞

## 9. 實機驗收（Playwright MCP）

- [x] 9.1 桌機 viewport（1440×900）：seed data 含 2 張 CALLED（04/05）+ 4 張 WAITING + 4 張歷史，操作 tabs / 搜尋 / row 完成過號全路徑通過
- [x] 9.2 平板 viewport（768×1024）：卡片 520px 單欄不破版；卡片頂層按鈕高度量測 44px（觸控達標）；服務中 row、tabs、搜尋皆排版正常
- [x] 9.3 手機 viewport（375×812）：actions 改 column 方向、叫下一號 + 現場登記各 303px 100% 寬；toolbar column、搜尋框 100% 寬；serving row `flex-wrap: wrap`
- [x] 9.4 split-button：主按鈕能正常 click 觸發 `ClickOpenDisplay`、下拉箭頭打開選單後點「複製連結」實測 clipboard.writeText 被呼叫並寫入 `http://localhost:3000/m/demo-clinic/display`
- [x] 9.5 多 CALLED 共存：對 04 號標完成 → serving 區僅剩 05、tab 計數「服務中（2）→（1）」「歷史（4）→（5）」、等待中不變 ✓
- [x] 9.6 搜尋邊界：搜「07」命中 ticketNumber=7（padStart 後）；搜「0003」命中 customerPhone 末 4 碼；搜「林」命中 customerLastName；搜「9999」顯示「找不到符合的號碼」+ 可清除；發現並修正了 padStart 比對 bug
- [x] 9.7 截圖暫存於 `.playwright-mcp/`（已 gitignore），不入 repo

## 10. 文件 / 知識庫

- [x] 10.1 更新 `.claude/knowledge/queue-realtime.md`：新增「商家叫號台 UX」段說明頁首 split-button、卡片動作層級、多 CALLED 並列、tabs+搜尋邏輯、RWD 斷點、i18n keys、data-testid 清單；同步 CLAUDE.md 知識庫目錄描述
- [ ] 10.2 commit 訊息使用 `feat: 重整商家叫號台動作層級、列表 tabs/搜尋與多 CALLED 操作`（Conventional Commits）— 待使用者下指令時執行
