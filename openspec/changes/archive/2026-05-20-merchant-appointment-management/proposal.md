## Why

商家後台「預約管理」雖然列表 API 與頁面 `/admin/appointments` 已存在，但 dashboard `/admin` 把今日預約卡片標記為「即將推出 —」，導致商家誤以為功能未上線；同時後端只有 `cancel`，缺少 `完成` / `未到` 狀態流轉 API，商家無法把已到場服務完成的預約標記為 `COMPLETED`，也無法把客人沒來的預約標記為 `NO_SHOW`，導致預約狀態長期停留在 `CONFIRMED`，影響後續分析、自動歸檔與顧客信用判斷。

## What Changes

- **Dashboard `/admin` 移除「即將推出」placeholder**：改為實際串接「今日 CONFIRMED 預約數」並可點擊導向 `/admin/appointments`
- **新增 `POST /nuxt-api/appointment/[id]/complete`**：將 `CONFIRMED` 預約改為 `COMPLETED`，須通過 `requireMerchant` 守衛、`startAt` 必須已過
- **新增 `POST /nuxt-api/appointment/[id]/no-show`**：將 `CONFIRMED` 預約改為 `NO_SHOW`，同上守衛 + 時間檢查
- **後台預約列表加狀態流轉操作**：`BizAppointmentTable.vue` 對 `CONFIRMED` 且 `startAt <= now` 的列加「標記完成 / 標記未到」按鈕；點擊後彈出 `ElMessageBox.confirm` 二次確認
- **`app/protocol/` 補對應 ApiCall**：`CompleteAppointment({ id })`、`NoShowAppointment({ id })`，回傳 ApiResponse 標準格式
- **三語訊息**：新增 `MSG_APPOINTMENT_NOT_CONFIRMED`（zh_tw: '只有已確認的預約可標記完成或未到'）與 `MSG_APPOINTMENT_NOT_YET_STARTED`（zh_tw: '預約時間尚未開始，無法標記完成或未到'）
- **確認側邊欄入口**：檢查 `layouts/back-desk.vue`（或對應元件）是否已有「預約管理」入口，若無則補

## Capabilities

### New Capabilities
<!-- 無新增 capability —— 本 change 僅擴充既有 merchant-platform 與 customer-booking 的需求 -->

### Modified Capabilities
- `merchant-platform`: 商家後台預約管理新增「標記完成 / 標記未到」狀態流轉端點與 UI；dashboard 顯示今日預約數
- `customer-booking`: 預約生命週期 spec 補上 `CONFIRMED → COMPLETED` 與 `CONFIRMED → NO_SHOW` 的合法轉換（時間 + 角色限制）

## Impact

- **後端新增檔案**：`server/routes/nuxt-api/appointment/[id]/complete.post.ts`、`server/routes/nuxt-api/appointment/[id]/no-show.post.ts`
- **後端修改檔案**：`server/utils/booking.ts`（新增兩個 I18nMessage 常數）
- **前端修改檔案**：
  - `app/pages/admin/index.vue`（dashboard 今日預約卡片）
  - `app/pages/admin/appointments/index.vue`（事件處理 + ApiLoad）
  - `app/components/biz/AppointmentTable.vue`（操作按鈕）
  - `app/protocol/`（補 2 個 ApiCall + types）
- **不動 schema**：`AppointmentStatus` enum 已含 `COMPLETED` / `NO_SHOW`
- **不影響顧客面**：不通知顧客；顧客查詢預約時看到的狀態文字會自然反映新狀態
- **依賴**：無新增 dependency；既有 `requireMerchant`、`prisma`、`successResponse` 已足夠
