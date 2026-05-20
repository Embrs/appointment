# queue-window-editor-ui-fix — Proposal

## Why

商家後台「領號時間設定」（`BizQueueWindowEditor`）目前有兩項問題，讓商家無法順利完成領號時段配置：

1. **星期欄顯示成 `c, o, m, m, o, n, .`**：`QueueWindowEditor.vue:18` 使用 `t('common.weekdayLong')` 取 i18n 陣列翻譯，但 vue-i18n 的 `t()` 只回傳字串、遇到陣列會 fallback 成 key 本身，再被字串索引取 0–6 字元，剛好就是 `"common."`。商家完全無法辨識每列代表星期幾。
2. **缺乏批次套用**：7 列 weekday 設定完全各自獨立，常見的「平日同時段、週末關閉」案例需要點開七次切換、各填一次 09:00–18:00 與上限，操作冗長且易出錯。

兩者皆為純前端問題，但讓「為 QUEUE 服務設定領號時段」這個高頻商家操作近乎不可用，必須先修。

## What Changes

### Bug 修復
- `QueueWindowEditor.vue` 取 weekday 名稱改用 `tm('common.weekdayLong')`（vue-i18n 取 message resource 的正確 API），確保拿到陣列而非 key 字串。
- 加 type guard：若取回非長度 7 的陣列則 fallback 到硬編碼 `['週日', '週一', …, '週六']`，避免下次 i18n key 漂移時再次靜默壞掉。

### UX 改善
- 星期欄改顯示「週日 / 週一 … 週六」完整字樣；週六、週日列以淺色底或灰字標示，與平日視覺區隔，便於商家一眼辨識。
- 編輯器頂部加批次工具列：
  - **「套用到所有平日（一～五）」**：以當前任一已啟用列的 `startTime / endTime / maxTickets` 為來源，複製到週一～週五並開啟。
  - **「套用到所有日」**：複製到 7 天並全開。
  - 兩個動作都需先有「來源列」（active 列），否則按鈕 disabled 並顯示提示文字「請先啟用任一列做為來源」。
  - 若有多個 active 列，採「最近啟用的那列」或「最先啟用的那列」（細節在 design.md 決定）。
- 不變更現有 `v-model: QueueWindowItem[]` 介面與後端 `UpdateQueueWindows` API，批次操作僅在 emit 層組裝陣列。

### 不變動
- 不動 Prisma schema、不動 API、不動後端 `isWithinQueueWindow` 行為。
- 不動 `queue-tickets` 領號時的窗外判斷規格。

## Capabilities

### New Capabilities
<!-- 無 -->

### Modified Capabilities
- `merchant-platform`：「領號時間設定編輯器」requirement 補充 scenario：星期欄需顯示可辨識週名、平日/週末視覺區分、並支援以已啟用列為來源批次套用至平日或全週。

## Impact

### 程式碼
- `app/components/biz/QueueWindowEditor.vue` — i18n 取值修正、模板新增批次工具列、樣式區分平日週末
- `i18n/locales/zh.js`、`i18n/locales/en.js`、`i18n/locales/ja.js` — 補批次按鈕與提示 key（`admin.queueWindow.applyWeekdays`、`applyAllDays`、`needSourceRow`）

### 系統 / 資料
- **無 schema 變更**：本次完全不動 Prisma，部署到測試／正式站不需要 `prisma migrate`，使用者提醒的「資料結構變化要自動同步」條款本次不觸發。
- **無 API 變更**：不影響 `GET/PUT /nuxt-api/merchant/queue-window`、不影響 `BizQueueWindowEditor` 對父頁面的 `v-model` 契約。

### 驗收
- Playwright MCP 桌機（1280×800）登入商家、進 `/admin/queue-window`：
  - 截圖確認 7 列分別顯示「週日 / 週一 / 週二 … 週六」、週末列視覺有別於平日。
  - 啟用週一、填 10:00–17:00 / 上限 30，點「套用到所有平日」→ 週二～五同步啟用且三欄值一致、週六日仍關閉。
  - 接著點「套用到所有日」→ 7 列同步啟用同值。
  - 切換 locale 至 en / ja，再次截圖確認週名與按鈕文案三語皆正確。
  - 截圖留存 `screenshots/queue-window-editor-ui-fix/`。
- 既有 Vitest 測試保持綠燈（本變更不涉及 server-side 邏輯）。
