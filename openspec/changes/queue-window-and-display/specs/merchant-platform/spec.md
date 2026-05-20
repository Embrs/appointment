## MODIFIED Requirements

### Requirement: 商家後台配置頁面

系統 SHALL 提供九個 `back-desk` layout + `merchant` middleware 保護的頁面（原八個 + 領號時間設定）。

#### Scenario: Dashboard /admin

- **GIVEN** 商家已登入
- **WHEN** 訪 `/admin`
- **THEN** 渲染 Dashboard，三張卡片（服務數、資源數、今日預約數預留 "—"）+ 最近編輯服務列表

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

#### Scenario: 領號時間設定 /admin/queue-window

- **GIVEN** 商家已登入
- **WHEN** 訪 `/admin/queue-window`
- **THEN** 渲染 `BizQueueWindowEditor`：上方下拉選 QUEUE 服務、下方每週 7 天的 startTime/endTime/maxTickets/isActive 編輯列、儲存按鈕

#### Scenario: 領號時間設定首次進入

- **GIVEN** 該服務尚無任何 QueueWindow
- **WHEN** 訪 `/admin/queue-window` 並選定該服務
- **THEN** 7 天皆顯示空白可填寫；isActive 預設 false

#### Scenario: 領號時間設定儲存

- **GIVEN** 填好週一至週五 09:00-18:00 maxTickets=20 isActive=true
- **WHEN** 點儲存
- **THEN** 呼叫 `$api.UpdateQueueWindows({ serviceId, windows })` → 成功 toast → 重新拉取顯示新值

#### Scenario: 無 QUEUE 服務時提示

- **GIVEN** 該商家無 `bookingMode=QUEUE` 的服務
- **WHEN** 訪 `/admin/queue-window`
- **THEN** 顯示「請先建立 QUEUE 模式服務」+ 連結到 `/admin/services`

### Requirement: Protocol bindings

`app/protocol/fetch-api/api/{merchant, service, resource, schedule, holiday, upload, queue}/` SHALL 暴露商家後台所有 API 方法，並支援 `NUXT_PUBLIC_TEST_MODE='T'` 時走 mock。

#### Scenario: service 模組 mock 路由

- **GIVEN** testMode='T'
- **WHEN** 呼叫 `$api.GetServiceList()`
- **THEN** 回 mock 資料，不發 HTTP 請求

#### Scenario: schedule 模組真實路由

- **GIVEN** testMode='F'
- **WHEN** 呼叫 `$api.UpdateScheduleRules({ scope: 'MERCHANT', rules: [...] })`
- **THEN** 向 `PUT /nuxt-api/schedule/rules` 發請求

#### Scenario: queue-window 讀寫 binding

- **WHEN** 呼叫 `$api.GetQueueWindows({ serviceId })` 與 `$api.UpdateQueueWindows({ serviceId, windows })`
- **THEN** 分別對應 `GET /nuxt-api/merchant/queue-window?serviceId=xxx` 與 `PUT /nuxt-api/merchant/queue-window`
