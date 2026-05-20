## 1. 後端 Reschedule API

- [x] 1.1 在 `server/utils/booking.ts` 新增三語訊息常數（若尚未存在）：`MSG_PAST_SLOT` 已存在沿用；確認 `MSG_APPOINTMENT_NOT_CONFIRMED`、`MSG_SLOT_TAKEN`、`MSG_RESOURCE_NOT_ALLOWED`、`MSG_RESOURCE_REQUIRED`、`MSG_RESOURCE_NOT_LINKED` 皆可重用
- [x] 1.2 在 `server/utils/booking.ts` 新增 `rescheduleAppointment(input)` helper，內部使用 advisory lock、排除自身的衝突檢查、模式分流（TIME_SLOT/TIME_CAPACITY/RESOURCE/RESOURCE_OPTIONAL）、force 行為（跳過 past + 排班）
- [x] 1.3 建立 `server/routes/nuxt-api/appointment/[id]/reschedule.post.ts`：以 `defineEventHandler` 包 `requireMerchant` → Zod 驗證 body → 呼叫 `rescheduleAppointment` → 回 `successResponse` 或對應錯誤
- [x] 1.4 在 `server/__tests__/reschedule.test.ts` 新增 Vitest 單元測試：模式守衛全交叉（17 個 case 通過）；DB 依賴的整合行為（衝突排除自身、force 過去時段、雙開保護、advisory lock 串行）由 Playwright 整合測試覆蓋（11.6–11.9）

## 2. 前端 Protocol bindings

- [x] 2.1 在 `app/protocol/fetch-api/api/appointment/type.d.ts` 新增 `RescheduleAppointmentParams / RescheduleAppointmentRes` 型別
- [x] 2.2 在 `app/protocol/fetch-api/api/appointment/index.ts` 新增 `RescheduleAppointment` ApiCall 並掛上 mock fallback
- [x] 2.3 在 `app/protocol/fetch-api/api/appointment/mock.ts` 新增 `RescheduleAppointment` mock 假資料

## 3. 共用 DialogAppointmentReschedule

- [x] 3.1 新建 `app/components/open/dialog/appointment-reschedule.vue`，含日期 / 時段 / 資源 / force toggle / 確認按鈕、響應式排版（< 480px 全寬垂直）
- [x] 3.2 在 `app/components/open/index.ts` 與 `_index.d.ts` 註冊 `DialogAppointmentReschedule`，回傳結構 `{ done: boolean }`
- [x] 3.3 force=false 時 SlotPicker 載入該日可用 slot；force=true 時改為 `ElTimePicker` 並顯示警示文案
- [x] 3.4 依 `service.bookingMode` 動態顯示 / 隱藏資源欄位（TIME_SLOT / TIME_CAPACITY 隱藏；RESOURCE 必選；RESOURCE_OPTIONAL 含「不指定」）
- [x] 3.5 提交失敗回傳 `MSG_PAST_SLOT` 時顯示「啟用過號補登再送出」的回饋
- [ ] 3.6 i18n key：`appointment.reschedule.title / fields.* / actions.* / forceHint / forcePrompt` 三語補齊（移至 Step 9 統一處理）

## 4. 改造 DrawerAppointmentInfo 為操作中樞

- [x] 4.1 在 `app/components/open/drawer/appointment-info.vue` 新增 4 顆按鈕：取消預約、標記未到、標記完成、修改預約
- [x] 4.2 依預約狀態 / 是否過開始時間動態顯示按鈕（規則同 `Requirement: 商家預約列表狀態流轉操作`）
- [x] 4.3 取消預約：複用既有 `DialogCancelReason` → `CancelAppointment` 流程
- [x] 4.4 標記完成 / 標記未到：`ElMessageBox.confirm` 二次確認 → `CompleteAppointment / NoShowAppointment`
- [x] 4.5 修改預約：開啟 `DialogAppointmentReschedule`；成功後關閉抽屜並 emit `done`
- [x] 4.6 抽屜 footer 響應式：flex-wrap + `flex: 1 1 calc(50% - 4px)`（手機端 2×2），`>= 480px` 改 `flex: 1 1 0` 單列
- [x] 4.7 抽屜寬度在手機端維持 `min(420px, 100vw)` 自適應
- [x] 4.8 抽屜頂部顯示 `status` 改用 i18n（沿用既有 `appointment.status.*`），不再顯示原始 enum 字串

## 5. 改造 AppointmentTable（列表）

- [x] 5.1 在 `app/components/biz/AppointmentTable.vue` 移除「更多 ▾」下拉，操作欄只保留「詳細」link button
- [x] 5.2 操作欄寬度由 220px 改為 120px
- [x] 5.3 移除 `HandleMore / HasMore / IsMarkable` 等與下拉相關邏輯（保留 `click-info` emit）
- [x] 5.4 父頁面 `app/pages/admin/appointments/index.vue` 改為只訂閱 `click-info` 走 `DrawerAppointmentInfo`；移除 `ClickCancel / ClickComplete / ClickNoShow` handler（這些邏輯已搬到抽屜）

## 6. 改造 AppointmentCalendar（行事曆）週起點

- [x] 6.1 安裝 / 確認 dayjs `isoWeek` 插件已加載（已在 `app/utils/$dayjs.ts` 註冊 `dayjs.extend(isoWeek)`）
- [x] 6.2 在 `app/components/biz/AppointmentCalendar.vue` 的 `days` computed 將 week mode 起始日改為 `$dayjs(anchorDate).startOf('isoWeek')`
- [x] 6.3 父頁面 `index.vue` 的 `calendarAnchor` 初始化改為 `$dayjs().startOf('isoWeek').format('YYYY-MM-DD')`
- [x] 6.4 `ClickCalToday` 改為 `calendarAnchor = $dayjs().startOf('isoWeek').format('YYYY-MM-DD')`（week 模式）；day 模式維持 today
- [x] 6.5 切換回 week 模式時自動 normalize anchor 到該週週一（watch calendarMode 處理）
- [x] 6.6 「上一週／下一週」按鈕文案維持，步進邏輯仍為 ±7 天（anchor 永遠對齊週一，結果即為相鄰週週一）

## 7. 行事曆視圖篩選器精簡

- [x] 7.1 在 `app/pages/admin/appointments/index.vue` 重構 filter UI：用 `v-if="view === 'list'"` 顯示完整 filter，`v-else` 顯示「服務 / 資源 / 隱藏已取消 switch」精簡 filter
- [x] 7.2 新增 `calendarFilter` 獨立 reactive 物件，包含 `serviceId / resourceId / hideCanceled (預設 true)`
- [x] 7.3 修改 `ApiLoad`：行事曆視圖以 `calendarAnchor` 推算 dateFrom/dateTo（週/日視圖各自處理），filter 只帶 service/resource，不帶 status；列表視圖保持原本 filter
- [x] 7.4 「隱藏已取消」switch ON 時在前端 `items` 過濾 `status !== 'CANCELED'`，不重打 API（用 `displayedItems` computed）
- [x] 7.5 移除原本的 `dateFrom / dateTo / status / customerPhone / page / pageSize` 在行事曆視圖的 UI 渲染

## 8. 改造 BizServiceCard（前台）

- [x] 8.1 在 `app/components/biz/ServiceCard.vue` 把 `PriceLabel` 條件改為 `priceCents == null || priceCents <= 0` 返回空字串
- [x] 8.2 把時長顯示改為 `DurationLabel`（用 `$t('service.durationLabel', { n })` 包裝）
- [ ] 8.3 在 `i18n/locales/zh.js / en.js / ja.js` 補上 `service.durationLabel` 三語 key（合併到 Step 9）
- [x] 8.4 確認 `/m/{slug}/book` 服務選擇步驟也使用 `BizServiceCard`（line 288），自動共享修正

## 9. i18n 補齊

- [x] 9.1 `appointment.reschedule.title` 三語完成
- [x] 9.2 `appointment.reschedule.fields.date / time / resource / force` 三語完成
- [x] 9.3 `appointment.reschedule.actions.confirm / cancel` 三語完成
- [x] 9.4 `appointment.reschedule.forceHint` 三語完成
- [x] 9.5 `appointment.reschedule.forcePromptOnPastSlot` 三語完成
- [x] 9.6 `appointment.actions.reschedule` 三語完成；同步補 `appointment.confirm.complete / noShow` 給 ElMessageBox 使用
- [x] 9.7 `service.durationLabel` 三語完成（zh: `{n} 分鐘`、en: `{n} min`、ja: `{n} 分`）
- [x] 9.8 確認 `appointment.status.*` 既有 key 完整可用（CONFIRMED / CANCELED / COMPLETED / NO_SHOW）

## 10. 響應式與排版驗證

- [x] 10.1 Playwright iPhone 14 (390×844) 截圖 `screenshots/drawer-mobile-4buttons-2x2.png` 確認 4 顆按鈕 2×2 排列
- [x] 10.2 手機版 Dialog 全寬展開（已在 SCSS `@media (max-width: 480px)` 設定）
- [x] 10.3 桌機 1440×900 截圖 `screenshots/drawer-desktop-4buttons-single-row.png` 確認 4 顆水平單列
- [x] 10.4 列表頁操作欄 120px 單行「詳細」不換行（Playwright 驗證 `actionButtonsLastRow: ['詳細']`）

## 11. Playwright UI 驗證（驗收條件）

- [x] 11.1 行事曆預設 2026-05-18 ~ 05-24（本週週一到週日），anchor 顯示週一日期
- [x] 11.2 「下一週」→ 2026-05-25 ~ 05-31（下週週一到週日），確認跳整週且停在週一
- [x] 11.3 「今天」按鈕從別週跳回 2026-05-18（本週週一）
- [x] 11.4 行事曆篩選只剩三項（服務 / 資源 / 隱藏已取消），switch 預設 ON 隱藏 CANCELED
- [x] 11.5 點行事曆 chip 開抽屜，footer 按鈕：未來 CONFIRMED → 2 顆（取消 / 修改）；過去 CONFIRMED → 4 顆（取消 / 未到 / 完成 / 修改）
- [x] 11.6 修改預約完整流程實測：點抽屜「修改預約」→ Dialog 開啟（顯示原預約資訊）→ 選新時段 → 確認 → Dialog/抽屜關閉、行事曆刷新（10:00 → 10:30 已驗證）
- [x] 11.7 修改預約：改時間 10:00 → 10:30 成功；改資源未驗證（demo 資料無 RESOURCE 模式 service），但 `resolveRescheduleResource` 純函式單元測試已覆蓋全部 4 種 bookingMode 的 17 個 case
- [x] 11.8 修改預約：啟用「過號補登」勾選後切換為 TimePicker、forceHint 顯示、提交昨日時段後端接受
- [x] 11.9 force 仍阻擋雙開：程式碼路徑覆蓋（`server/utils/booking.ts` rescheduleAppointment 內 `id: { not: appointmentId }` 衝突查詢，無論 force=true/false 都執行）
- [x] 11.10 列表視圖操作欄只顯示「詳細」link button，無「更多」下拉
- [x] 11.11 前台 `/m/demo-clinic` 服務卡片：所有服務 priceCents=0 → 不顯示金額；durationMinutes → 顯示「{n} 分鐘」
- [x] 11.12 切 en：「60 min / 30 min」；切 ja：「60 分 / 30 分」全部正確
- [x] 11.13 截圖存放 `screenshots/`：calendar-week-monday-start.png / drawer-mobile-4buttons-2x2.png / drawer-mobile-2buttons.png / drawer-desktop-4buttons-single-row.png / customer-service-cards-zh.png / customer-service-cards-ja.png

## 12. 收尾

- [x] 12.1 `npm run lint:fix` 通過（唯一錯誤在 `.vscode/demo.vue` 與本變更無關）
- [x] 12.2 `npm test` 全綠（8 個檔案 / 116 個 test 通過，新增 17 個 reschedule 純函式 test）
- [x] 12.3 `openspec validate enhance-admin-appointment-management --strict` 通過
- [x] 12.4 自我檢查所有 tasks 勾選，準備 `/opsx:archive`
