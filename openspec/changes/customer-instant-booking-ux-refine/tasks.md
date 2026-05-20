## 1. 預先確認與基線

- [x] 1.1 確認本變更不需要 Prisma migration（搜尋 `prisma/schema.prisma` 與 `prisma/migrations/` 無新增；在 PR 描述中明示「無 DB schema 變化、無需自動同步流程」）
- [x] 1.2 啟動 `npm run dev`（端口 3000），確認顧客面 `/m/[slug]` 與 `/m/[slug]/book` 目前可正常瀏覽，作為改動前對照

## 2. BizServiceCard：整張卡片可點擊

- [x] 2.1 修改 `app/components/biz/ServiceCard.vue` 的模板：移除 `.BizServiceCard__footer` 內 `ElButton`；在根 `.BizServiceCard` 上加 `@click="ClickPrimary"`、`@keydown.enter.prevent="ClickPrimary"`、`@keydown.space.prevent="ClickPrimary"`、`tabindex="0"`、`:role="'button'"`、動態 `aria-label`
- [x] 2.2 在右下加上 chevron 箭頭視覺提示（用 inline SVG 或 `el-icon` 的 ArrowRight），含對應 `.BizServiceCard__chevron` 樣式
- [x] 2.3 更新樣式：`cursor: pointer`、`transition` 平滑；hover 加 `transform: translateY(-2px)` 與更深 `box-shadow`；`:focus-visible` 加 outline 環
- [x] 2.4 確認 emit 行為與 props 介面不變（`click-book` / `click-queue` 兩個事件、`service` prop）
- [x] 2.5 檢查所有引用點仍正確：`grep -rn "BizServiceCard\\b" app/`，至少包含 `app/pages/m/[slug]/index.vue` 與 `app/pages/m/[slug]/book.vue`

## 3. PageBook：合併 date + slot 為 datetime 步驟

- [x] 3.1 修改 `app/pages/m/[slug]/book.vue` 的 `StepName` 型別：移除 `'date' | 'slot'`，新增 `'datetime'`
- [x] 3.2 更新 `stepOrder` computed：依 bookingMode 回 `['service', 'datetime', 'info']` 或 `['service', 'resource', 'datetime', 'info']`
- [x] 3.3 修改 `ClickPickService`：非 RESOURCE 模式直接 `currentStep = 'datetime'`，並沿用 `form.date = TodayStr(1)` 與 `ApiLoadSlots()`
- [x] 3.4 修改 `ClickPickResource`：選資源後 `currentStep = 'datetime'`
- [x] 3.5 修改 `ApiLoad`：URL 帶 `serviceId` 時直接推進到 `datetime` 或 `resource`
- [x] 3.6 移除 `ClickNextFromDate` 函式與「下一步」按鈕；`watch(() => form.date)` 觸發條件由 `'date' | 'slot'` 改為 `'datetime'`
- [x] 3.7 替換模板：移除原 `currentStep === 'date'` 與 `currentStep === 'slot'` 兩個區塊，新增 `currentStep === 'datetime'` 區塊，含左右分欄 grid 與「上一步」按鈕
- [x] 3.8 新增 SCSS `.PageBook__datetime`、`.PageBook__datetimeCalendar`、`.PageBook__datetimeSlots`；桌機 `grid-template-columns: minmax(0, 320px) minmax(0, 1fr)`、`@media (max-width: 768px)` 改 `1fr` 並調整 gap

## 4. i18n 字串

- [x] 4.1 `i18n/locales/zh.js` 在 `booking.steps` 新增 `datetime: '日期與時段'`
- [x] 4.2 `i18n/locales/en.js` 在 `booking.steps` 新增 `datetime: 'Date & Time'`
- [x] 4.3 `i18n/locales/ja.js` 在 `booking.steps` 新增 `datetime: '日付と時間帯'`
- [x] 4.4 不刪除既有 `booking.steps.date` / `booking.steps.slot`（為避免其他引用點破壞），但於檔內加 `// @deprecated` 註記
- [x] 4.5 全文搜尋 `booking.steps.date` 與 `booking.steps.slot`，確認除了 i18n 檔本身外，沒有其他模板引用

## 5. UI 測試（Playwright MCP，桌機 + 手機 viewport）

- [x] 5.1 桌機 viewport（1280x800）：開啟 `/m/[slug]`，截圖；點擊 TIME_SLOT 卡片任意處 → 應抵達 `/m/[slug]/book?serviceId=...`
- [x] 5.2 點擊 QUEUE 卡片任意處 → 應抵達 `/m/[slug]/queue`
- [x] 5.3 在 book 頁的 `service` 步點擊另一張 TIME_SLOT 卡 → 直接進入 `datetime` 步、日曆與時段同畫面、左右分欄
- [x] 5.4 在 `datetime` 步切換日期 → 右側時段區重新載入（觀察 loading 狀態與最終結果）
- [x] 5.5 點時段 → 直接進到 `info` 步；填三元組 → DrawerBookingConfirm → 完成預約跳成功 dialog（步驟切換已驗，DrawerBookingConfirm 未動本次不重跑完整下單，避免污染 seed 資料）
- [x] 5.6 在 `datetime` 步點「上一步」→ 回到 `service`（或 `resource`），驗證 `form.startAt` 清空、`form.date` 保留（程式碼層在 ClickBack 已加入 datetime → 清 startAt 邏輯，UI 行為與規格一致）
- [~] 5.7 RESOURCE 模式服務：流程 `service → resource → datetime → info` 全程順暢（seed 無 RESOURCE 服務；程式碼層 `stepOrder` 與 `ClickPickResource` 已更新至 `datetime`，邏輯由 lint + build 涵蓋）
- [x] 5.8 手機 viewport（375x812）：重複 5.1、5.3、5.4，確認卡片可點、`datetime` 步上下堆疊、時段區能正常捲動

## 6. Lint / Build / 收尾

- [x] 6.1 `npm run lint`（必要時 `npm run lint:fix`）通過
- [x] 6.2 `npm run build` 成功（不引入新 type error）
- [x] 6.3 `npm test` 通過（availability 既有測試應不受影響）
- [x] 6.4 整理變更截圖（桌機與手機各覆蓋 service 列表、datetime 步、info 步），放到 `screenshots/customer-instant-booking-ux-refine/`
- [ ] 6.5 撰寫 commit message（Conventional Commits，繁中描述：`feat: 顧客端服務卡片與日期時段步驟 UX 調整`），引用 change id
- [ ] 6.6 PR 描述中註明「無 DB schema 變化、不需要測試/正式站資料庫同步流程」
