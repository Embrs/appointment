## 1. 後端共用 helper

- [x] 1.1 在 `server/utils/booking.ts` 新增三語訊息 `MSG_APPOINTMENT_NOT_CONFIRMED`（zh_tw: '只有已確認的預約可標記完成或未到', en, ja）
- [x] 1.2 在 `server/utils/booking.ts` 新增三語訊息 `MSG_APPOINTMENT_NOT_YET_STARTED`（zh_tw: '預約時間尚未開始，無法標記完成或未到', en, ja）

## 2. 後端 endpoint

- [x] 2.1 新建 `server/routes/nuxt-api/appointment/[id]/complete.post.ts`：`requireMerchant` → 查 appointment（限同 merchantId）→ 驗 `status=CONFIRMED` 與 `startAt < now()` → `updateMany({ where: { id, merchantId, status: 'CONFIRMED' } }, { status: 'COMPLETED' })` → `count===0` 回 400 `MSG_APPOINTMENT_NOT_CONFIRMED`、否則回 `successResponse({ id, status: 'COMPLETED' })`
- [x] 2.2 新建 `server/routes/nuxt-api/appointment/[id]/no-show.post.ts`：同 2.1 但 status 改為 `NO_SHOW`
- [x] 2.3 兩支 endpoint 對「找不到 / 跨商家」回 `notFoundError(event)`（與既有 cancel 一致）

## 3. 後端測試

- [x] 3.1 在 `server/__tests__/` 新增 `appointment-state-transition.test.ts`（純邏輯部分；若需要 mock prisma，與既有測試風格一致）
  - [x] 3.1.1 CONFIRMED + 過去 → 成功
  - [x] 3.1.2 CONFIRMED + 未來 → 拒絕
  - [x] 3.1.3 已 CANCELED → 拒絕
  - [x] 3.1.4 跨 merchantId → 拒絕

## 4. Protocol bindings

- [x] 4.1 在 `app/protocol/` 找到 `appointment.ts`（或對應檔），補 `CompleteAppointment({ id })` 與 `NoShowAppointment({ id })`
- [x] 4.2 對應 types：response data 為 `{ id: string; status: 'COMPLETED' | 'NO_SHOW' }`

## 5. 前端 dashboard

- [x] 5.1 修改 `app/pages/admin/index.vue`：
  - 移除 `card--placeholder`「即將推出」classes 與「將於下一階段開放」hint
  - 改為呼叫 `$api.GetAppointmentList({ dateFrom: today, dateTo: today, status: 'CONFIRMED', pageSize: 1 })`，用 `res.data.total`
  - 用 `$dayjs.tz(merchantInfo.timezone).format('YYYY-MM-DD')` 取「今日」字串
  - 包裝為 `NuxtLink` 導向 `/admin/appointments`
- [x] 5.2 載入失敗時顯示 `—`，與服務數 / 資源數失敗時表現一致

## 6. 前端列表頁狀態流轉

- [x] 6.1 修改 `app/components/biz/AppointmentTable.vue`：
  - 計算 prop / computed `isMarkable` = `status === 'CONFIRMED' && new Date(item.startAt).getTime() <= Date.now()`
  - 將「取消」按鈕保留為主按鈕；加 `ElDropdown`「更多」收納「標記完成 / 標記未到」
  - emit `'click-complete'` 與 `'click-no-show'` 事件
- [x] 6.2 修改 `app/pages/admin/appointments/index.vue`：
  - 加 `ClickComplete(a)` 與 `ClickNoShow(a)`：呼叫 `$open.DialogConfirm` 或 `ElMessageBox.confirm` → 確認後呼 API → 成功 toast + `ApiLoad()`
  - 失敗顯示後端三語訊息

## 7. 側邊欄入口確認

- [x] 7.1 檢視 `app/layouts/back-desk.vue`（或對應導航元件），確認已有「預約管理」連結到 `/admin/appointments`；若無則補

## 8. UI 實機驗證（Playwright MCP）

- [x] 8.1 商家登入 → `/admin` dashboard：今日預約卡片顯示正確數字、點擊跳 `/admin/appointments`（截圖：`screenshots/merchant-appointment-management/01-dashboard.png`）
- [x] 8.2 用 Prisma Studio 或 seed 建立「已過時間 CONFIRMED」預約 → 列表頁顯示「更多」下拉
- [x] 8.3 點「標記完成」→ 確認彈窗 → 確認 → 狀態變「已完成」（截圖：`02-mark-complete.png`）
- [x] 8.4 點「標記未到」→ 流程同上（截圖：`03-mark-no-show.png`）
- [x] 8.5 對未到時間的 CONFIRMED 預約，「更多」下拉不顯示這兩個選項
- [x] 8.6 對 COMPLETED 預約嘗試打 API（用 DevTools / postman）→ 400 `MSG_APPOINTMENT_NOT_CONFIRMED`（截圖：`04-error-not-confirmed.png`）

## 9. 文件

- [x] 9.1 更新 `.claude/knowledge/api-modules.md` 在 `appointment/` 表格補上 `POST /appointment/[id]/complete` 與 `/no-show`

## 10. 驗收

- [x] 10.1 `npm run lint` 通過（本變更涉及檔案 0 錯誤；既有 `.vscode/demo.vue` 報錯與本變更無關）
- [x] 10.2 `npm test` 通過（31 個測試全通過）
- [x] 10.3 `npm run build` 通過（complete/no-show endpoint chunk 已產出）
- [x] 10.4 `openspec validate merchant-appointment-management --strict` 通過
