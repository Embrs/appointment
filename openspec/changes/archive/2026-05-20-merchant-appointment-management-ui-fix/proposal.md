## Why

商家後台「預約管理」與「歷史紀錄」頁面累積了 4 個影響日常使用的 UX 問題：（1）歷史紀錄頁缺少返回入口，使用者進去後沒辦法回到預約管理；（2）「列表」與「歷史紀錄」語意重疊，列表會顯示已取消、已完成、未到的舊預約，與使用者心智中「歷史 = 結案的紀錄」衝突；（3）狀態顯示為英文 enum 值（`CONFIRMED`、`CANCELED`、`COMPLETED`、`NO_SHOW`）與顧客稱謂未經過 i18n，三語切換時也都看到英文；（4）列表的「操作」欄寬度不足，導致「取消／更多」按鈕跑到第二行。這些都不是 schema 或後端的問題，但是直接影響商家每日操作體驗。

## What Changes

- **歷史紀錄頁加返回入口**：`/admin/appointments/archive` 在 `BizPageHeader` 的 `#actions` 加入「← 返回預約管理」按鈕。
- **列表 view 重新定義語意為「進行中的預約」**：
  - 預設只顯示 `CONFIRMED` 且 `startAt >= 今日 00:00` 的預約。
  - 加入「顯示已結案（已取消／已完成／未到）」切換開關，預設關閉；開啟後顯示所有狀態。
  - 行事曆 view 維持顯示所有狀態（避免空白格）。
  - 頁面副標、按鈕 tooltip 區分「列表 = 進行中的預約」「歷史紀錄 = 90 天前已歸檔的紀錄」。
- **狀態與顧客稱謂 i18n 化**：
  - 在 `i18n/locales/{zh,en,ja}.js` 新增 `appointment.status.CONFIRMED/CANCELED/COMPLETED/NO_SHOW`。
  - 在 `i18n/locales/{zh,en,ja}.js` 新增 `appointment.customerTitle.MR/MRS/MISS/MX`。
  - `AppointmentTable.vue`、`AppointmentCalendar.vue`、`archive.vue` 統一以 `$t()` 顯示，移除 hard-code 對照表。
- **列表操作欄重排**：
  - 主要按鈕只保留「詳細」與「更多」，「取消」併入「更多」下拉。
  - 操作欄寬度調整至 220–240px 確保不換行。
  - 「更多」下拉依狀態動態：未到時的 `CONFIRMED` 顯示「取消」；已過時間的 `CONFIRMED` 顯示「取消／標記完成／標記未到」；其他狀態不顯示「更多」按鈕。

## Capabilities

### New Capabilities

（無新增 capability，全部屬於既有商家平台預約管理章節的改動）

### Modified Capabilities

- `merchant-platform`：商家後台「預約管理」章節新增「列表預設過濾活躍預約」、「狀態與稱謂須經 i18n」、「歷史紀錄頁須提供返回入口」、「列表操作欄主要動作收斂為詳細＋更多」等需求。

## Impact

- **前端頁面**：`app/pages/admin/appointments/index.vue`、`app/pages/admin/appointments/archive.vue`
- **前端組件**：`app/components/biz/AppointmentTable.vue`、`app/components/biz/AppointmentCalendar.vue`（檢查狀態顯示）
- **多語系**：`i18n/locales/zh.js`、`i18n/locales/en.js`、`i18n/locales/ja.js`
- **後端**：不動 schema、不動 API；列表預設過濾完全在前端達成。
- **資料庫**：無 migration，測試站與正式站可直接部署。
- **驗收**：透過 Playwright 實際操作驗收 4 項需求，截圖留存於 `screenshots/`。
