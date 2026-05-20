# fix-customer-booking-ux — Tasks

## 1. 前置確認（Open Questions）

- [x] 1.1 讀 `app/pages/m/[slug]/queue/index.vue`，確認領號頁是否支援 `?serviceId=` query；若不支援則在 tasks 2.2 採「不帶 query」策略並記錄到 design Open Questions
  - 結論：queue 頁自己 filter 所有 QUEUE 服務並列表，**不**讀 query。2.2 採「不帶 query」導向 `/m/{slug}/queue`
- [x] 1.2 確認 `nuxt-icon` 是否已支援 `mdi:translate`（檢查 `nuxt.config.ts` 的 `icon.customCollections`、必要時 `@iconify-json/mdi` 是否安裝）；不支援則改用 `i-heroicons:language` 或 emoji `🌐`
  - 結論：`@nuxt/icon` v2.2.1 已裝，支援 iconify 動態抓 mdi 系列。可直接用 `<NuxtIcon name="mdi:translate">`
- [x] 1.3 grep `BizDatePickerStrip` 使用點，確認除了 `book.vue` 之外是否還有其他呼叫者（決定是否保留 strip）
  - 結論：僅 `book.vue:258, :270` 兩處用。保留元件不刪，本次只替換 book.vue 內呼叫點

## 2. ServiceCard 行為與排版

- [x] 2.1 `app/components/biz/ServiceCard.vue`：新增 `click-queue` event；QUEUE 模式按鈕不再 `:disabled`，改 emit `click-queue`
- [x] 2.2 `app/pages/m/[slug]/index.vue`：監聽 `@click-queue` → `navigateTo('/m/{slug}/queue?serviceId={id}')`（或依 1.1 決定是否帶 query）
- [x] 2.3 `app/pages/m/[slug]/book.vue` 服務選擇步驟：監聽 `@click-queue`（理論上 `services` 已 filter 掉 QUEUE，仍保險寫上）；維持既有 `click-book` 行為
- [x] 2.4 `app/components/biz/ServiceCard.vue` SCSS：卡片改 `display: flex; flex-direction: column; height: 100%`，`.__footer { margin-top: auto }`
- [x] 2.5 桌機 1024px 與手機 375px 各打開 `/m/{slug}` 截圖驗證三張卡片按鈕底邊對齊

## 3. 月曆日期元件

- [x] 3.1 新增 `app/components/biz/DatePickerCalendar.vue`，依 design.md D3 介面實作：`modelValue` / `minDate` / `maxDate` / `disabledDates`，emit `update:modelValue`
- [x] 3.2 元件內以 `$dayjs` 計算當月第一天、最後一天、補齊 6 週 grid（避免高度跳動）；跨月格子 `opacity: 0.35`
- [x] 3.3 上下月切換鈕、月份標題、週標題（依 i18n locale 切換中／英／日週名）
- [x] 3.4 today 角標、`disabled` 樣式（與 strip 一致使用 `#f5f7fa` + 不可點）
- [x] 3.5 手機版（≤ 640px）格子最小邊長 38px、月份切換按鈕加大觸控區
- [x] 3.6 `app/pages/m/[slug]/book.vue` step=date 與 step=slot：將 `BizDatePickerStrip` 替換為 `BizDatePickerCalendar`，預設 `maxDate = today + 60`
- [x] 3.7 桌機與手機各跑一次「選日期 → 進時段 → 退回 → 跨月再選」流程截圖

## 4. 步驟條呈現修正

- [x] 4.1 `app/pages/m/[slug]/book.vue` SCSS：`.PageBook__stepNum` 直接設 `color: $white`，移除 `> * { color: $white }` 規則
- [x] 4.2 SCSS 手機 media query：拿掉 `.PageBook__stepLabel { display: none }`，改為 `.PageBook__step:not(.--active) .PageBook__stepLabel { display: none }`；active 的 label `font-size: 11px`、`white-space: nowrap`
- [x] 4.3 手機 375px 截圖驗證步驟條：圓圈數字清楚、active 步驟有完整中文 label

## 5. 語系切換

- [x] 5.1 `app/layouts/front-desk.vue`：用 `useI18n()` 拉 `locale`、`locales`、`setLocale`
- [x] 5.2 把 `button.LayoutFrontDesk__localeBtn` 包進 `ElDropdown(trigger="click" @command="ClickSetLocale")`；下拉項目來自 `locales`，當前語系項 `:disabled`
- [x] 5.3 icon 換成 `<NuxtIcon name="mdi:translate">`（依 1.2 決定 collection），原 `⌐` 字符移除
- [x] 5.4 按鈕內顯示當前 locale `name`（如「繁體中文」「English」「日本語」）
- [x] 5.5 桌機與手機各驗證：zh → en → ja → zh 一輪，每次切換後 PageBook 步驟 label、首頁卡片按鈕、語系按鈕文字都跟著變
- [x] 5.6 檢查瀏覽器 cookie `i18n_redirected` 在切換後寫入正確 code

## 6. Lint / Test / 整合

- [x] 6.1 `npm run lint:fix` 通過
- [x] 6.2 `npm test` 既有 vitest 維持綠燈
- [x] 6.3 `npm run dev` 啟動成功、首頁無 Vue 警告（特別是 i18n missing key、Element Plus prop warning）

## 7. Playwright MCP 驗收

- [x] 7.1 啟動 `npm run dev`；以 Playwright MCP 開 dev server 的首頁
- [x] 7.2 桌機 1024×768 跑：首頁 → QUEUE 卡片可點 → 領號頁載入；首頁 → 一般卡片 → 預約 step=date 顯示月曆 → 切下個月 → 選日 → step=slot；header 切 en/ja
- [x] 7.3 手機 375×812 跑同樣流程；額外驗證步驟條 active label 與圓圈數字可讀
- [x] 7.4 截圖留存到 `screenshots/fix-customer-booking-ux/{viewport}/{step}.png`（每個關鍵畫面一張）
- [x] 7.5 列出驗收清單對照 specs scenario，全部勾選後通知使用者

## 8. 收尾

- [ ] 8.1 PR description 引用 `openspec show fix-customer-booking-ux` 的摘要
- [ ] 8.2 確認本次無 prisma schema 變更，PR 描述標註「無需 migration」
- [ ] 8.3 提交完成、等待 review 後 merge；merge 後在測試站 smoke 同樣 4 個需求點
