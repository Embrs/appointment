# fix-customer-booking-ux — Proposal

## Why

顧客面（`/m/{slug}/*`）四個關鍵 UX 缺陷在實機操作中明顯影響轉換：

1. **服務卡片「號碼牌」按鈕被 disabled，且按鈕未對齊到卡片底部**，造成 QUEUE 模式服務無法從首頁進入領號流程（領號頁 `/m/{slug}/queue` 其實已存在）。
2. **預約步驟的「選擇日期」採 14 天橫向 strip**，畫面單薄、無法跨月選擇、視覺重量與其他卡片不協調。
3. **預約步驟條在手機版只剩空圓圈**：CSS 把 `.PageBook__stepLabel` 整個 `display: none`，圓圈內數字又因 `background-color: currentColor` 與字色同色而看不見。
4. **`layouts/front-desk.vue` 的「語系」按鈕點擊無反應**：`ClickSwitchLocale` 只是空 TODO；icon 使用奇怪的 `⌐` 字符。

這些都是純前端問題，但直接影響顧客第一次接觸商家頁的體驗，必須在小流量擴張前修掉。

## What Changes

### 顧客面 UI 行為調整
- **BizServiceCard**：QUEUE 模式按鈕不再 `disabled`；點擊時 emit `click-queue` 事件，由父頁面導向 `/m/{slug}/queue`。文案維持「號碼牌」。
- **BizServiceCard CSS**：卡片內加 `flex-direction: column` 與 `.__footer { margin-top: auto }`，確保不同描述長度下按鈕對齊卡片底部。
- **新增 BizDatePickerCalendar 元件**：7 欄月曆 grid，支援切換月份、標示 today / disabled / 跨月灰階；保留 `v-model:string YYYY-MM-DD` 介面與 `BizDatePickerStrip` 對齊以便替換。
- **PageBook 步驟「date」與「slot」**：改用 `BizDatePickerCalendar`，並讓「slot」步驟保留小型 strip 以便快速跨日切換（或維持 calendar，依 design.md 決定）。
- **PageBook 步驟條 CSS**：
  - 圓圈內字色顯式 `color: $white`（不再依賴 `> * { color }`，因純文字節點無法選到）；
  - 手機版不再 `display: none` 整個 label，改為 `font-size: 11px` + `max-width` 截斷顯示，或僅保留 active step 的 label。
- **LayoutFrontDesk 語系切換**：
  - 換成 `ElDropdown`，選項：繁體中文 / English / 日本語；
  - 點選後呼叫 `useI18n().setLocale(code)`，並寫入 cookie（`@nuxtjs/i18n` 預設 `i18n_redirected`）；
  - icon 改用 `<NuxtIcon name="mdi:translate">`（或 `i-mdi:translate`），移除 `⌐`。

### 不變動
- 不動 Prisma schema、不動 API、不增資料表。
- 不更動既有 spec 對「預約建立／取消／查詢」的契約；只更新 UI 表現面的 scenario。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `customer-booking`：步驟式預約流程的「選擇日期 UI」與「步驟條呈現」要求調整，新增 QUEUE 服務首頁領號入口的 scenario。
- `finalize-deploy`：i18n 三語覆蓋章節新增「語系切換 UI 行為」requirement，明確規範下拉操作與 `setLocale` 行為。

## Impact

### 程式碼
- `app/components/biz/ServiceCard.vue` — 行為與樣式
- `app/components/biz/DatePickerStrip.vue` — 保留現狀（被取代或保留作小型輔助）
- `app/components/biz/DatePickerCalendar.vue` — **新增**
- `app/pages/m/[slug]/index.vue` — 接 `click-queue` 導向
- `app/pages/m/[slug]/book.vue` — 替換日期選擇器、修步驟條 CSS
- `app/layouts/front-desk.vue` — 語系下拉與 `setLocale`

### 系統 / 資料
- **無 Prisma schema 變更**；不需要 `prisma migrate` 跑新檔。
- **無 API 變更**；不影響 Nitro 路由與既有契約。
- 部署到測試／正式站走既有 Docker / Railway 流程即可，無需資料庫同步動作（使用者提醒的「資料結構變化要自動同步」條款本次不觸發）。

### 驗收
- Playwright MCP 桌機（1024×768）+ 手機（375×812）跑四項需求 E2E，截圖留存 `screenshots/fix-customer-booking-ux/`。
- 既有 Vitest 測試保持綠燈（`server/__tests__/availability.test.ts` 不受影響）。
