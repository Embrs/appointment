## MODIFIED Requirements

### Requirement: 商家自身資訊讀寫

系統 SHALL 提供商家讀取與修改**自己**的商家資訊端點，所有操作以 `auth.merchantId` 為唯一 tenancy 依據，不允許跨商家。

#### Scenario: 取得自身商家

- **GIVEN** 已登入商家
- **WHEN** `GET /nuxt-api/merchant`
- **THEN** 響應 200，`data.merchant` 含完整欄位（id、slug、name、description、logoUrl、coverUrl、cancelPolicy、contactPhone、contactEmail、timezone、address、status、createdAt、updatedAt、**maxActiveAppointmentsPerCustomer**）

#### Scenario: 修改自身商家

- **GIVEN** 已登入商家、`id === auth.merchantId`
- **WHEN** `PUT /nuxt-api/merchant/[id]` body 含 `{ name?, slug?, description?, logoUrl?, coverUrl?, contactPhone?, contactEmail?, timezone?, address?, cancelPolicy?, maxActiveAppointmentsPerCustomer? }`
- **THEN** 響應 200，DB 同步更新；cancelPolicy 與既有 Json 合併（保留未提及 key）

#### Scenario: 嘗試修改他人商家

- **GIVEN** 已登入商家
- **WHEN** `PUT /nuxt-api/merchant/[id]` 但 `id !== auth.merchantId`
- **THEN** 響應 403

#### Scenario: slug 衝突

- **WHEN** 新 slug 已被其他商家使用
- **THEN** 響應 409，三語訊息「網址已被使用」

#### Scenario: cancelPolicy 結構驗證

- **WHEN** body `cancelPolicy = { mode: 'cutoff', hoursBeforeCannotCancel: 24 }`
- **THEN** 響應 200；mode='cutoff' 時 hoursBeforeCannotCancel 必為整數 1–168

#### Scenario: cancelPolicy 結構錯誤

- **WHEN** `cancelPolicy.mode='cutoff'` 但 `hoursBeforeCannotCancel` 缺失或 < 1
- **THEN** 響應 400

#### Scenario: 預約上限欄位範圍驗證

- **WHEN** body `maxActiveAppointmentsPerCustomer = 5`
- **THEN** 響應 200；DB 更新

#### Scenario: 預約上限範圍錯誤

- **WHEN** body `maxActiveAppointmentsPerCustomer = 0` 或 `100` 或 `3.5` 或 `'abc'`
- **THEN** 響應 400（Zod 驗證失敗：必須是 1–99 的整數）

### Requirement: 商家後台配置頁面

系統 SHALL 提供八個 `back-desk` layout + `merchant` middleware 保護的頁面。

#### Scenario: Dashboard /admin

- **GIVEN** 商家已登入
- **WHEN** 訪 `/admin`
- **THEN** 渲染 Dashboard，三張卡片（服務數、資源數、今日預約數預留 "—"）+ 最近編輯服務列表

#### Scenario: 設定 /admin/settings

- **WHEN** 訪 `/admin/settings`
- **THEN** 渲染商家欄位編輯表單（含 logo / cover ImageUploader、cancelPolicy 選擇、**預約上限 ElInputNumber min=1 max=99**）

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

#### Scenario: 設定頁顯示與保存預約上限

- **GIVEN** 商家上限為 default 5
- **WHEN** 訪 `/admin/settings`、改為 10、按儲存
- **THEN** PUT `/nuxt-api/merchant/[id]` 帶 `maxActiveAppointmentsPerCustomer: 10`；成功 toast；重新整理後欄位顯示 10
