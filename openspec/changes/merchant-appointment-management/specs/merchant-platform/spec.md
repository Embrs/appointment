## MODIFIED Requirements

### Requirement: 商家後台配置頁面

系統 SHALL 提供八個 `back-desk` layout + `merchant` middleware 保護的頁面。

#### Scenario: Dashboard /admin

- **GIVEN** 商家已登入
- **WHEN** 訪 `/admin`
- **THEN** 渲染 Dashboard，三張卡片（服務數、資源數、**今日預約數**）+ 最近編輯服務列表；點擊「今日預約」卡片導向 `/admin/appointments`

#### Scenario: 設定 /admin/settings

- **WHEN** 訪 `/admin/settings`
- **THEN** 渲染商家欄位編輯表單（含 logo / cover ImageUploader、cancelPolicy 選擇）

#### Scenario: 對外連結 /admin/share-link

- **WHEN** 訪 `/admin/share-link`
- **THEN** 渲染 `/m/{slug}` 連結（複製按鈕）+ QR code 圖片

#### Scenario: 服務 /admin/services

- **WHEN** 訪 `/admin/services`
- **THEN** 渲染表格 + 新增 / 編輯彈窗；bookingMode 切換時對應欄位動態顯示

#### Scenario: 資源 /admin/resources

- **WHEN** 訪 `/admin/resources`
- **THEN** 渲染表格 + 新增 / 編輯彈窗

#### Scenario: 時段 /admin/schedule

- **WHEN** 訪 `/admin/schedule`
- **THEN** 渲染 scope 切換（MERCHANT / 各 RESOURCE）+ SchedulerWeeklyEditor + 特定日期覆寫清單

#### Scenario: 休假 /admin/holidays

- **WHEN** 訪 `/admin/holidays`
- **THEN** 渲染休假日清單 + 新增彈窗

#### Scenario: 員工 /admin/staff（OWNER only）

- **GIVEN** 當前用戶 role='OWNER'
- **WHEN** 訪 `/admin/staff`
- **THEN** 渲染員工表格 + 新增 / 編輯 / 啟用切換

#### Scenario: 員工頁 STAFF 訪問

- **GIVEN** 當前用戶 role='STAFF'
- **WHEN** 訪 `/admin/staff`
- **THEN** 顯示「無權限」訊息，不渲染表格

#### Scenario: 非商家訪 /admin/*

- **GIVEN** 未登入或 selfType !== 'merchant'
- **WHEN** 訪 `/admin/*`
- **THEN** middleware 跳轉到 `/sign-in`

#### Scenario: Dashboard 今日預約卡片串接

- **GIVEN** 商家當日有 3 筆 CONFIRMED 預約、1 筆 CANCELED、1 筆 COMPLETED
- **WHEN** 訪 `/admin`
- **THEN** 今日預約卡片數字顯示 `3`（僅計 CONFIRMED）；點擊卡片導向 `/admin/appointments`

#### Scenario: Dashboard 今日預約使用商家時區

- **GIVEN** 商家 timezone='Asia/Taipei'、瀏覽器當前時間在 UTC 23:30（台灣 07:30 隔日）
- **WHEN** 訪 `/admin`
- **THEN** 「今日」採商家時區，顯示台灣日期的預約數，而非 UTC 日期

## ADDED Requirements

### Requirement: 商家標記預約完成

系統 SHALL 提供 `POST /nuxt-api/appointment/[id]/complete` 端點，允許已登入商家把已過開始時間的 `CONFIRMED` 預約改為 `COMPLETED`。

#### Scenario: 標記完成成功

- **GIVEN** 商家已登入、預約 `status=CONFIRMED`、`startAt < now()`
- **WHEN** POST `/nuxt-api/appointment/[id]/complete`
- **THEN** 後端用條件式 update（`where: { id, merchantId, status: 'CONFIRMED' }`）將 status 改為 `COMPLETED`；回 `successResponse({ id, status: 'COMPLETED' })`

#### Scenario: 預約時間尚未到拒絕

- **GIVEN** 預約 `status=CONFIRMED`、`startAt > now()`
- **WHEN** POST `/[id]/complete`
- **THEN** 回 400 `MSG_APPOINTMENT_NOT_YET_STARTED`

#### Scenario: 預約已取消拒絕

- **GIVEN** 預約 `status=CANCELED`
- **WHEN** POST `/[id]/complete`
- **THEN** 回 400 `MSG_APPOINTMENT_NOT_CONFIRMED`

#### Scenario: 跨商家越權拒絕

- **GIVEN** 商家 A 已登入、預約屬於商家 B
- **WHEN** POST `/[id]/complete`
- **THEN** 回 404 `MSG_APPOINTMENT_NOT_FOUND`（不洩漏存在與否）

#### Scenario: 未登入拒絕

- **WHEN** 無 token 呼叫 `/[id]/complete`
- **THEN** `requireMerchant` 回 401

#### Scenario: 並發競態保護

- **GIVEN** 商家 A 與商家 B 同時點「完成」（同一預約屬於某商家，兩 owner 同時操作）
- **WHEN** 兩 request 抵達後端
- **THEN** Prisma `updateMany` 條件式更新只有一個會回 `count: 1`，另一個 `count: 0` 回 400 `MSG_APPOINTMENT_NOT_CONFIRMED`

### Requirement: 商家標記預約未到

系統 SHALL 提供 `POST /nuxt-api/appointment/[id]/no-show` 端點，允許已登入商家把已過開始時間的 `CONFIRMED` 預約改為 `NO_SHOW`。

#### Scenario: 標記未到成功

- **GIVEN** 商家已登入、預約 `status=CONFIRMED`、`startAt < now()`
- **WHEN** POST `/nuxt-api/appointment/[id]/no-show`
- **THEN** 後端條件式 update status → `NO_SHOW`；回 `successResponse({ id, status: 'NO_SHOW' })`

#### Scenario: 預約時間尚未到拒絕

- **GIVEN** 預約 `startAt > now()`
- **WHEN** POST `/[id]/no-show`
- **THEN** 回 400 `MSG_APPOINTMENT_NOT_YET_STARTED`

#### Scenario: 已完成預約拒絕

- **GIVEN** 預約 `status=COMPLETED`
- **WHEN** POST `/[id]/no-show`
- **THEN** 回 400 `MSG_APPOINTMENT_NOT_CONFIRMED`

#### Scenario: 跨商家越權拒絕

- **GIVEN** 預約不屬於當前商家
- **WHEN** POST `/[id]/no-show`
- **THEN** 回 404 `MSG_APPOINTMENT_NOT_FOUND`

### Requirement: 商家預約列表狀態流轉操作

商家後台預約列表頁 `/admin/appointments` SHALL 對「已過開始時間且狀態為 CONFIRMED」的列顯示「標記完成」與「標記未到」操作；其他狀態不顯示。

#### Scenario: 顯示與隱藏條件

- **GIVEN** 列表渲染中
- **WHEN** 某列 `status=CONFIRMED` 且 `startAt <= now()`
- **THEN** 該列顯示「標記完成 / 標記未到」按鈕（建議用 dropdown「更多」收納，避免擠壓）

#### Scenario: 未到時間不顯示操作

- **GIVEN** 列 `status=CONFIRMED`、`startAt > now()`
- **WHEN** 渲染
- **THEN** 不顯示「標記完成 / 標記未到」按鈕，僅顯示「詳情」與「取消」

#### Scenario: 非 CONFIRMED 不顯示操作

- **GIVEN** 列 `status ∈ {CANCELED, COMPLETED, NO_SHOW}`
- **WHEN** 渲染
- **THEN** 不顯示「標記完成 / 標記未到」也不顯示「取消」，僅顯示「詳情」

#### Scenario: 點擊標記完成有二次確認

- **WHEN** 點擊「標記完成」
- **THEN** 跳 `ElMessageBox.confirm`「確定將此預約標記為已完成？」，確認後才呼叫 API；取消則不動

#### Scenario: 操作後即時刷新列表

- **GIVEN** 標記完成 API 成功
- **WHEN** 收到 success response
- **THEN** 列表 ApiLoad 重新拉取，該列狀態變成「已完成」

### Requirement: 標記端點 Protocol bindings

`app/protocol/` SHALL 提供 `CompleteAppointment({ id })` 與 `NoShowAppointment({ id })` 兩個 ApiCall，回傳標準 `ApiResponse<{ id, status }>`。

#### Scenario: TypeScript 型別正確

- **WHEN** 任一 Vue 組件呼叫 `$api.CompleteAppointment({ id })`
- **THEN** 編譯時 `res.data.status` 推斷為 `'COMPLETED'` 字面型別
