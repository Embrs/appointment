# merchant-platform Specification

## Purpose
TBD - created by archiving change merchant-config. Update Purpose after archive.
## Requirements
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

### Requirement: 服務 CRUD

系統 SHALL 提供 Service 的列表 / 詳情 / 新增 / 更新 / 軟刪除端點，並強制以 `auth.merchantId` 限定。系統 SHALL 在 `Service` 新增 `requiresProvider: Boolean @default(false)` 欄位，並支援透過 `ProviderService(providerId, serviceId)` 多對多關聯指派可服務該服務的 Provider 清單。當 `requiresProvider=true` 時，body 必須提供 `providerIds: string[]` 且非空、所有 id 屬於同商家且未軟刪。

#### Scenario: 列表

- **GIVEN** 已登入商家
- **WHEN** `GET /nuxt-api/service`
- **THEN** 響應 200，`data.items` 為當前 merchantId、deletedAt=null 的所有 Service；每筆含 `resourceIds: string[]` 與 `providerIds: string[]` 與 `requiresProvider: boolean`；按 `displayOrder asc, createdAt asc`

#### Scenario: 新增服務（TIME_SLOT）

- **WHEN** `POST /nuxt-api/service` body `{ name: '拔牙', bookingMode: 'TIME_SLOT', durationMinutes: 60, slotIntervalMinutes: 30 }`
- **THEN** 響應 200，DB 寫入；capacityPerSlot 預設 1、requiresProvider 預設 false

#### Scenario: 新增服務（TIME_CAPACITY）

- **WHEN** body `{ name: '團體課', bookingMode: 'TIME_CAPACITY', durationMinutes: 60, slotIntervalMinutes: 60, capacityPerSlot: 10 }`
- **THEN** 響應 200

#### Scenario: 新增服務（RESOURCE + resourceIds）

- **WHEN** body `{ name: '醫師看診', bookingMode: 'RESOURCE', durationMinutes: 15, slotIntervalMinutes: 15, resourceIds: ['r1', 'r2'] }`
- **THEN** 響應 200；DB 寫入 Service + 兩筆 ServiceResource

#### Scenario: 新增服務（QUEUE）

- **WHEN** body `{ name: '排隊', bookingMode: 'QUEUE' }`
- **THEN** 響應 200；durationMinutes / capacityPerSlot 忽略（用 schema default）

#### Scenario: 新增服務（requiresProvider + providerIds）

- **GIVEN** 商家 `providerModeEnabled=true`、已有 Provider p1、p2
- **WHEN** `POST /nuxt-api/service` body `{ name: '看診', bookingMode: 'TIME_SLOT', durationMinutes: 30, slotIntervalMinutes: 30, requiresProvider: true, providerIds: ['p1', 'p2'] }`
- **THEN** 響應 200；DB 寫入 Service + 兩筆 ProviderService

#### Scenario: requiresProvider=true 但 providerIds 為空

- **WHEN** body `{ requiresProvider: true, providerIds: [] }` 或省略 `providerIds`
- **THEN** 響應 400，三語訊息「啟用『指定服務人員』時必須選擇至少一位」

#### Scenario: providerIds 含其他商家 Provider

- **WHEN** body `providerIds` 含的 id 不屬於 `auth.merchantId`
- **THEN** 響應 400 或 403（拒絕跨商家連結）

#### Scenario: 更新服務（整組覆蓋 resourceIds / providerIds）

- **GIVEN** Service 已存在綁定 resources `[r1, r2]`、providers `[p1]`
- **WHEN** `PUT /nuxt-api/service/[id]` body `{ resourceIds: ['r2', 'r3'], providerIds: ['p2', 'p3'] }`
- **THEN** transaction 內 deleteMany 既有 ServiceResource / ProviderService 後 createMany 新關聯；最終 resources 剩 `r2、r3`，providers 剩 `p2、p3`

#### Scenario: requiresProvider 切換警告

- **GIVEN** Service 已有 5 筆 CONFIRMED Appointment
- **WHEN** 後台 UI 切換 `requiresProvider` 從 false → true
- **THEN** UI 跳確認 dialog「將僅影響之後的新預約，既有預約不會回填 Provider」；確認後 API 寫入；既有 Appointment.providerId 不動

#### Scenario: RESOURCE 模式但 resourceIds 含其他商家資源

- **WHEN** `resourceIds` 含的 id 不屬於 `auth.merchantId`
- **THEN** 響應 400 或 403（拒絕跨商家連結）

#### Scenario: 軟刪除

- **WHEN** `DELETE /nuxt-api/service/[id]`
- **THEN** Service.deletedAt = now；列表不再出現

#### Scenario: 查不存在或他人服務

- **WHEN** id 不存在 / 屬其他 merchant / 已軟刪
- **THEN** 響應 404

### Requirement: 資源 CRUD

系統 SHALL 提供 Resource 同型態端點。

#### Scenario: 列表

- **WHEN** `GET /nuxt-api/resource`
- **THEN** 響應 200，所有當前商家 deletedAt=null 資源；按 `displayOrder asc, createdAt asc`

#### Scenario: 新增

- **WHEN** `POST /nuxt-api/resource` body `{ name: '王醫師' }`
- **THEN** 響應 200

#### Scenario: 編輯 / 軟刪

- **WHEN** PUT / DELETE，id 屬當前商家
- **THEN** 對應 update / 軟刪除

### Requirement: 整週時段規則設定

系統 SHALL 提供整週 ScheduleRule 的讀取與**整組覆蓋**寫入端點，按 `(merchantId, scope, resourceId, providerId)` 範圍隔離。`ScheduleRule` SHALL 新增 `providerId: String?` 欄位（nullable，向後相容）；`resourceId` 語意改為「該排班預綁診間 / 工位（選填）」。`scope` 列舉 SHALL 支援 `MERCHANT` / `RESOURCE` / `PROVIDER` 三值；`PROVIDER` scope 規則必須帶 `providerId`，可選填 `resourceId` 作為該時段預綁的診間。

#### Scenario: 讀取所有規則

- **WHEN** `GET /nuxt-api/schedule/rules`
- **THEN** 響應 200，`data.rules` 為當前商家所有 ScheduleRule（含 MERCHANT / RESOURCE / PROVIDER 三種 scope）

#### Scenario: 讀取單一 Provider scope

- **WHEN** `GET /nuxt-api/schedule/rules?scope=PROVIDER&providerId=p1`
- **THEN** 響應 200，僅該 (PROVIDER, p1) 的規則；每筆含可選的 `resourceId`

#### Scenario: 讀取單一 Resource scope

- **WHEN** `GET /nuxt-api/schedule/rules?scope=RESOURCE&resourceId=r1`
- **THEN** 響應 200，僅該 scope+resourceId 的規則（既有行為不變）

#### Scenario: 整組覆蓋 MERCHANT scope

- **GIVEN** 商家 MERCHANT scope 既有 3 筆 ScheduleRule
- **WHEN** `PUT /nuxt-api/schedule/rules` body `{ scope: 'MERCHANT', rules: [{ weekday: 1, startTime: '09:00', endTime: '12:00' }] }`
- **THEN** transaction 內 deleteMany 既有 3 筆後 createMany 新 1 筆；RESOURCE / PROVIDER scope 規則完全不動

#### Scenario: 整組覆蓋特定資源

- **WHEN** `PUT` body `{ scope: 'RESOURCE', resourceId: 'r1', rules: [...] }`
- **THEN** 僅該 (RESOURCE, r1) 範圍替換；其他資源 / Provider 規則不動

#### Scenario: 整組覆蓋特定 Provider（可帶預綁診間）

- **WHEN** `PUT` body `{ scope: 'PROVIDER', providerId: 'p1', rules: [{ weekday: 1, startTime: '09:00', endTime: '12:00', resourceId: 'r1' }, { weekday: 2, startTime: '14:00', endTime: '18:00', resourceId: 'r2' }] }`
- **THEN** 僅該 (PROVIDER, p1) 範圍替換；每筆 ScheduleRule 寫入對應 `resourceId`（可為 null）

#### Scenario: PROVIDER scope 但 providerId 不屬於該商家

- **WHEN** body `{ scope: 'PROVIDER', providerId: '其他商家 id', rules: [...] }`
- **THEN** 響應 400 或 403

#### Scenario: PROVIDER scope 預綁 resourceId 不屬於該商家

- **WHEN** body 某 rule `resourceId` 屬於其他商家
- **THEN** 響應 400

#### Scenario: startTime ≥ endTime

- **WHEN** body 含任一 rule `startTime >= endTime`
- **THEN** 響應 400

#### Scenario: HH:mm 格式錯誤 / weekday 超範圍

- **WHEN** body 含 `weekday: 7` 或 `startTime: '9:00'`（缺零）
- **THEN** 響應 400

### Requirement: 特定日期覆寫

系統 SHALL 提供 ScheduleOverride CRUD 端點，按 `(merchantId, scope, resourceId, providerId, date)` 唯一。`ScheduleOverride` SHALL 新增 `providerId: String?` 欄位；`scope` 支援 `MERCHANT` / `RESOURCE` / `PROVIDER`。

#### Scenario: 列表

- **WHEN** `GET /nuxt-api/schedule/override?from=2026-05-15&to=2026-06-15`
- **THEN** 響應 200，list 該區間 override（含三種 scope）

#### Scenario: 新增（Provider 特定日期休息）

- **WHEN** `POST /nuxt-api/schedule/override` body `{ scope: 'PROVIDER', providerId: 'p1', date: '2026-06-01', isClosed: true, note: '王醫師當天請假' }`
- **THEN** 響應 200；DB upsert

#### Scenario: 新增（Provider 特定日期改時間且改診間）

- **WHEN** body `{ scope: 'PROVIDER', providerId: 'p1', date: '2026-06-02', startTime: '10:00', endTime: '14:00', resourceId: 'r2' }`
- **THEN** 響應 200

#### Scenario: 新增（特定日期休息 - MERCHANT / RESOURCE 既有行為）

- **WHEN** `POST` body `{ scope: 'MERCHANT', date: '2026-06-01', isClosed: true, note: '盤點' }`
- **THEN** 響應 200；DB upsert

#### Scenario: 新增（特定日期改時間 - RESOURCE 既有行為）

- **WHEN** body `{ scope: 'RESOURCE', resourceId: 'r1', date: '2026-06-02', startTime: '10:00', endTime: '14:00' }`
- **THEN** 響應 200

#### Scenario: 刪除

- **WHEN** `DELETE /nuxt-api/schedule/override/[id]`
- **THEN** 響應 200；DB delete

### Requirement: 整店休假日

系統 SHALL 提供 MerchantHoliday CRUD。

#### Scenario: 列表

- **WHEN** `GET /nuxt-api/holiday`
- **THEN** 響應 200，list 當前商家所有休假日；可選 `?year=2026` 過濾

#### Scenario: 新增

- **WHEN** `POST /nuxt-api/holiday` body `{ date: '2026-02-17', name: '春節' }`
- **THEN** 響應 200

#### Scenario: 同日重複

- **WHEN** 同一 `(merchantId, date)` 再次 POST
- **THEN** 響應 409

#### Scenario: 刪除

- **WHEN** `DELETE /nuxt-api/holiday/[id]`
- **THEN** 響應 200

### Requirement: 圖片上傳

系統 SHALL 提供 `POST /nuxt-api/upload/image` multipart 端點，將圖片儲存到 R2 並回 public URL。

#### Scenario: 成功上傳 logo

- **GIVEN** R2 已配置、商家已登入
- **WHEN** 提交 multipart `file=logo.png`、query `?kind=logo`
- **THEN** 響應 200，`data.url` 為 R2 endpoint URL，`data.key = merchant/{merchantId}/logo/{timestamp}-logo.png`

#### Scenario: 非圖片

- **WHEN** 提交 `file.txt`（text/plain）
- **THEN** 響應 400，三語訊息「僅支援 PNG/JPEG/WebP 圖片」

#### Scenario: 檔案過大

- **WHEN** 提交 > 5MB 的圖片
- **THEN** 響應 400，三語訊息「圖片需在 5MB 以內」

#### Scenario: R2 未配置（dev fallback）

- **GIVEN** `process.env.NODE_ENV !== 'production'` 且 R2 環境變數缺失
- **WHEN** 成功提交合法圖片
- **THEN** 響應 200，`data.url` 為 `https://placehold.co/...` placeholder

#### Scenario: 未登入

- **WHEN** 無 token
- **THEN** 響應 401

### Requirement: 商家成員管理

系統 SHALL 提供 MerchantUser 在當前商家下的 CRUD 與啟用切換，OWNER-only。

#### Scenario: 列表

- **WHEN** `GET /nuxt-api/merchant/staff`
- **THEN** 響應 200，list 當前商家 MerchantUser（不含 passwordHash）

#### Scenario: 新增

- **GIVEN** 當前用戶 role='OWNER'
- **WHEN** `POST /nuxt-api/merchant/staff` body `{ email, password, name, role: 'STAFF' }`
- **THEN** 響應 200；DB insert MerchantUser

#### Scenario: STAFF 嘗試新增

- **GIVEN** 當前用戶 role='STAFF'
- **WHEN** 呼叫 POST
- **THEN** 響應 401

#### Scenario: email 衝突（同商家內）

- **WHEN** 該 merchantId + email 已存在
- **THEN** 響應 409

#### Scenario: 編輯 / 切換啟用

- **WHEN** PUT / toggle-active
- **THEN** 對應更新

#### Scenario: 不能停用自己

- **WHEN** `toggle-active` 的 id === auth.sub
- **THEN** 響應 400

### Requirement: 商家後台配置頁面

系統 SHALL 提供 `back-desk` layout + `merchant` middleware 保護的商家後台頁面;sidebar 導覽 SHALL 以三個語意分群呈現:「營運」、「排班」、「設定」。「排班」分群下的 `/admin/schedule` SHALL 為四 tab 容器頁,內含「📅 預約時段」、「🔧 單日調整」、「🚫 公休日」、「🎟 現場領號時段」四個 tab,tab 顯示性依商家服務的 bookingMode 構成動態決定。原 `/admin/holidays` 與 `/admin/queue-window` SHALL 保留為 redirect 路由。當商家 `providerModeEnabled=true` 時，「營運」分群 SHALL 額外顯示「服務人員」項目連到 `/admin/providers`（顯示文字採用 `providerLabel` fallback 鏈解析），「排班」分群下的「📅 預約時段」與「🔧 單日調整」tab SHALL 額外提供 PROVIDER scope 切換器。

#### Scenario: Dashboard /admin

- **GIVEN** 商家已登入
- **WHEN** 訪 `/admin`
- **THEN** 渲染 Dashboard,三張卡片(服務數、資源數、今日預約數預留 "—")+ 最近編輯服務列表

#### Scenario: 設定 /admin/settings

- **WHEN** 訪 `/admin/settings`
- **THEN** 渲染商家欄位編輯表單(含 logo / cover ImageUploader、cancelPolicy 選擇、Provider 制開關 + 三語自訂稱呼欄位)

#### Scenario: 對外連結 /admin/share-link

- **WHEN** 訪 `/admin/share-link`
- **THEN** 渲染 `/m/{slug}` 連結(複製按鈕)+ QR code 圖片

#### Scenario: 服務 /admin/services

- **WHEN** 訪 `/admin/services`
- **THEN** 渲染表格 + 新增 / 編輯彈窗;bookingMode 切換時對應欄位動態顯示；商家 `providerModeEnabled=true` 時，編輯彈窗額外顯示「需指定服務人員」開關 + Provider 多選器

#### Scenario: 資源 /admin/resources

- **WHEN** 訪 `/admin/resources`
- **THEN** 渲染表格 + 新增 / 編輯彈窗;表格 SHALL 包含「已綁服務」column(詳見「資源頁顯示綁定服務」requirement)

#### Scenario: 服務人員 /admin/providers（啟用後）

- **GIVEN** 商家 `providerModeEnabled=true`
- **WHEN** 訪 `/admin/providers`
- **THEN** 渲染表格（欄位：頭像、姓名、職稱、已綁服務、啟停、排序）+ 新增 / 編輯彈窗（含 ImageUploader kind=provider-avatar）

#### Scenario: 服務人員入口未啟用時隱藏

- **GIVEN** 商家 `providerModeEnabled=false`
- **WHEN** 訪 `/admin/*`
- **THEN** sidebar 不顯示「服務人員」入口；直訪 `/admin/providers` 仍可進入但頁首顯示 banner 引導到設定頁啟用

#### Scenario: 排班 /admin/schedule 預設 tab(有非 QUEUE 服務)

- **GIVEN** 商家至少有一個 `bookingMode !== 'QUEUE'` 的啟用服務
- **WHEN** 訪 `/admin/schedule` 不帶 query
- **THEN** 預設啟用「📅 預約時段」tab(`tab=weekly`),URL `router.replace` 為 `/admin/schedule?tab=weekly`

#### Scenario: 排班 /admin/schedule 預設 tab(僅 QUEUE 服務)

- **GIVEN** 商家所有啟用服務皆為 `bookingMode === 'QUEUE'`
- **WHEN** 訪 `/admin/schedule` 不帶 query
- **THEN** 預設啟用「🎟 現場領號時段」tab(`tab=queue-window`),URL `router.replace` 為 `/admin/schedule?tab=queue-window`

#### Scenario: 排班 /admin/schedule 預設 tab(無任何服務)

- **GIVEN** 商家無任何啟用服務
- **WHEN** 訪 `/admin/schedule`
- **THEN** 不渲染任何 tab,中央顯示 empty state:「尚未建立任何服務,請先到『服務』頁建立」+ 連到 `/admin/services` 的按鈕

#### Scenario: 排班 tab 切換同步 query

- **GIVEN** 已在 `/admin/schedule?tab=weekly`
- **WHEN** 使用者點擊「🚫 公休日」tab
- **THEN** 切換顯示對應 panel,URL 經 `router.replace` 更新為 `/admin/schedule?tab=holidays`(不堆 history)

#### Scenario: 排班 tab query 不合法或對應 tab 已隱藏

- **WHEN** 訪 `/admin/schedule?tab=foo`,或訪 `?tab=queue-window` 但商家無 QUEUE 服務
- **THEN** fallback 至「目前可見的第一個 tab」(`weekly` → `overrides` → `holidays` → `queue-window`),URL replace 為對應的合法 tab

#### Scenario: 預約時段 tab 內容（未啟用 Provider 制）

- **GIVEN** 商家 `providerModeEnabled=false`
- **WHEN** 啟用 `tab=weekly`(且該 tab 可見)
- **THEN** 渲染 scope 切換(MERCHANT / 各 RESOURCE) + SchedulerWeeklyEditor;副標顯示「設定每週固定營業時段。若有單日臨時變動請切換到『🔧 單日調整』tab」;同時顯示「影響服務:{逗號分隔的 bookingMode !== 'QUEUE' 啟用服務名}」

#### Scenario: 預約時段 tab 內容（啟用 Provider 制）

- **GIVEN** 商家 `providerModeEnabled=true`、已有 Provider p1
- **WHEN** 啟用 `tab=weekly`
- **THEN** scope 切換器額外列出 `PROVIDER:p1` 選項；切到 PROVIDER scope 時，編輯器每條規則加「預綁診間（選填）」下拉，下拉選項為當前商家所有啟用 Resource

#### Scenario: 單日調整 tab 內容

- **WHEN** 啟用 `tab=overrides`(且該 tab 可見)
- **THEN** 渲染特定日期覆寫清單 + 新增/編輯/刪除操作;tab 標題顯示為「🔧 單日調整」;副標顯示「設定某一天和平常不一樣的時段或休息。整店全日休請改用『🚫 公休日』tab」;影響服務行同「預約時段」tab；啟用 Provider 制時 scope 切換器加 PROVIDER 選項

#### Scenario: 公休日 tab 內容

- **WHEN** 啟用 `tab=holidays`(且該 tab 可見)
- **THEN** 渲染整店休假日清單 + 年份切換 + 新增彈窗;tab 標題顯示為「🚫 公休日」;副標顯示「整店休息日,會在顧客訂位頁顯示假日名稱。如果只是某天提早收或某資源請假,請改用『🔧 單日調整』tab」;副標補「影響:整店所有服務」

#### Scenario: 現場領號時段 tab 內容

- **WHEN** 啟用 `tab=queue-window`(且該 tab 可見)
- **THEN** 渲染服務選擇器 + 每週 7 天領號窗編輯(startTime/endTime/maxTickets/isActive);tab 標題顯示為「🎟 現場領號時段」;副標補「影響服務:{逗號分隔的 bookingMode === 'QUEUE' 啟用服務名}」

#### Scenario: 預約時段 tab 隱藏條件

- **GIVEN** 商家無任何 `bookingMode !== 'QUEUE'` 的啟用服務
- **WHEN** 訪 `/admin/schedule`
- **THEN** 「📅 預約時段」「🔧 單日調整」「🚫 公休日」三個 tab 不渲染;只渲染「🎟 現場領號時段」(若有 QUEUE 服務)

#### Scenario: 現場領號時段 tab 隱藏條件

- **GIVEN** 商家無任何 `bookingMode === 'QUEUE'` 的啟用服務
- **WHEN** 訪 `/admin/schedule`
- **THEN** 「🎟 現場領號時段」tab 不渲染;只渲染其他三個 tab(若有非 QUEUE 服務)

#### Scenario: 舊路由 /admin/holidays redirect

- **WHEN** 訪 `/admin/holidays`
- **THEN** 客戶端 redirect(`navigateTo('/admin/schedule?tab=holidays', { replace: true })`),不污染瀏覽器歷史

#### Scenario: 舊路由 /admin/queue-window redirect

- **WHEN** 訪 `/admin/queue-window`
- **THEN** 客戶端 redirect 至 `/admin/schedule?tab=queue-window`(replace mode)

#### Scenario: Sidebar 商家視角分群呈現

- **GIVEN** 商家已登入(非平台管理員)
- **WHEN** 渲染 sidebar
- **THEN** 顯示 3 個分群區塊,每塊含小標題:
  - 「營運」:首頁 / 預約管理 / 叫號
  - 「排班」:排班(連到 `/admin/schedule`)
  - 「設定」:商家設定 / 對外連結 / 服務 / 資源 / 成員
  順序固定如上;`商家設定` 與 `成員` 依 `HasRule` 條件顯示(維持既有行為)

#### Scenario: Sidebar 平台管理員視角

- **GIVEN** 平台管理員登入(`isAdmin=true`)
- **WHEN** 渲染 sidebar
- **THEN** 維持既有三個 NavLink(總覽 / 商家管理 / 管理員),不套用分群

#### Scenario: 員工 /admin/staff(OWNER only)

- **GIVEN** 當前用戶 role='OWNER'
- **WHEN** 訪 `/admin/staff`
- **THEN** 渲染員工表格 + 新增 / 編輯 / 啟用切換

#### Scenario: 員工頁 STAFF 訪問

- **GIVEN** 當前用戶 role='STAFF'
- **WHEN** 訪 `/admin/staff`
- **THEN** 顯示「無權限」訊息,不渲染表格

#### Scenario: 非商家訪 /admin/*

- **GIVEN** 未登入或 selfType !== 'merchant'
- **WHEN** 訪 `/admin/*`(含 redirect 舊路由)
- **THEN** middleware 跳轉到 `/sign-in`

### Requirement: SchedulerWeeklyEditor 元件

`app/components/biz/SchedulerWeeklyEditor.vue` SHALL 提供桌機 / 手機雙形態的整週時段編輯介面。

#### Scenario: 桌機顯示七列

- **GIVEN** viewport ≥ 641px
- **WHEN** 元件渲染
- **THEN** 顯示週日到週六七個橫列，每列含該日多個時段段落 + 「新增時段」按鈕

#### Scenario: 手機顯示折疊清單

- **GIVEN** viewport ≤ 640px
- **WHEN** 元件渲染
- **THEN** 顯示 ElCollapse 七節，每節展開該日所有時段

#### Scenario: 新增時段段落

- **WHEN** 點擊任一天的「新增時段」
- **THEN** 開啟 `OpenDialogScheduleRuleEdit`；確認後新增到該日 rules array

#### Scenario: 刪除時段段落

- **WHEN** 點擊段落上的 X
- **THEN** 從 rules array 移除

#### Scenario: 儲存整週

- **WHEN** 元件呼叫 emit `update:rules`，父元件呼叫 `UpdateScheduleRules`
- **THEN** 後端整組覆蓋

### Requirement: ImageUploader 元件

`app/components/biz/ImageUploader.vue` SHALL 提供 v-model URL 字串的圖片上傳介面。

#### Scenario: 選檔上傳

- **GIVEN** 商家在 settings 頁
- **WHEN** 點擊上傳區、選擇 logo.png
- **THEN** 元件呼叫 `UploadImage({ file, kind: 'logo' })`、loading 中顯示遮罩；成功後 emit v-model 為新 URL

#### Scenario: 上傳失敗

- **WHEN** API 回非 200
- **THEN** ElMessage.error 顯示三語錯誤訊息

#### Scenario: 預覽

- **GIVEN** v-model 有值
- **WHEN** 元件渲染
- **THEN** 使用 ElImage 顯示預覽

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

### Requirement: 預約管理頁採同頁 toggle、預設行事曆

`/admin/appointments` SHALL 在同一個頁面內提供「行事曆 / 列表」兩種視圖切換，初次造訪 SHALL 預設停在行事曆視圖；視圖狀態 SHALL 透過 URL query `view=calendar | list` 持久化以便重整與分享連結時保留。

#### Scenario: 初次造訪預設行事曆

- **GIVEN** 商家已登入、瀏覽器歷史中無 `/admin/appointments` 任何 query 紀錄
- **WHEN** 訪 `/admin/appointments`（無 query）
- **THEN** 頁面渲染行事曆視圖；右上角 toggle 高亮「行事曆」；URL **不**自動補 `?view=calendar`（保持簡潔）

#### Scenario: 切換到列表並保留

- **GIVEN** 商家在 `/admin/appointments` 行事曆視圖
- **WHEN** 點擊 toggle 的「列表」
- **THEN** 視圖切為列表；URL 變為 `/admin/appointments?view=list`（用 `router.replace`，不污染 history）
- **AND** 重整頁面後仍停在列表

#### Scenario: query=calendar 顯式指定

- **WHEN** 訪 `/admin/appointments?view=calendar`
- **THEN** 顯示行事曆視圖；toggle 高亮「行事曆」

#### Scenario: query=list 顯式指定

- **WHEN** 訪 `/admin/appointments?view=list`
- **THEN** 顯示列表視圖

#### Scenario: 非法 view 值降級

- **WHEN** 訪 `/admin/appointments?view=unknown`
- **THEN** 視為 `calendar`（預設值），不報錯

#### Scenario: 舊 `/admin/appointments/calendar` 路由相容

- **WHEN** 訪 `/admin/appointments/calendar`（或從外部書籤連入）
- **THEN** 自動以 `router.replace` 導向 `/admin/appointments?view=calendar`

#### Scenario: filter 在兩視圖間共用

- **GIVEN** 商家在列表視圖設定 filter `dateFrom=2026-05-20 & status=CONFIRMED & serviceId=s1`
- **WHEN** 點擊 toggle 切換到行事曆
- **THEN** 行事曆以同樣的 dateFrom / dateTo / status / serviceId 範圍載資料；切回列表後 filter 仍保留

### Requirement: 預約管理頁的代客預約三入口

`/admin/appointments` 頁 SHALL 在行事曆與列表兩種視圖都提供「代客預約」按鈕；行事曆視圖額外 SHALL 支援點擊空白時段格直接打開代客預約 Dialog 並預填日期 / 時段；列表視圖維持現狀（僅右上角按鈕）。

#### Scenario: 列表視圖右上角代客預約按鈕

- **GIVEN** 商家在 `/admin/appointments?view=list`
- **WHEN** 點擊 header 右上角「代客預約」
- **THEN** 開啟 `DialogAppointmentCreate`，未預填任何欄位（既有行為）

#### Scenario: 行事曆視圖右上角代客預約按鈕

- **GIVEN** 商家在 `/admin/appointments?view=calendar`
- **WHEN** 點擊 header 右上角「代客預約」
- **THEN** 開啟 `DialogAppointmentCreate`，未預填任何欄位

#### Scenario: 點行事曆空白格預填日期

- **GIVEN** 行事曆週視圖、2026-05-22 該欄位有未被佔用且非休假的空檔
- **WHEN** 點擊 2026-05-22 該欄位的空白區域
- **THEN** 開啟 `DialogAppointmentCreate`，`prefillDate='2026-05-22'`；Dialog 內日期欄已自動填入

#### Scenario: 日視圖點空檔預填日期 + 時段

- **GIVEN** 行事曆日視圖，2026-05-22 14:00 該 hour 格為空檔
- **WHEN** 點擊 14:00 該 hour 格
- **THEN** 開啟 Dialog 並 `prefillDate='2026-05-22', prefillStartAt='2026-05-22T06:00:00.000Z'`（對應 14:00 +08:00）；選完 service 後該時段的 slot 自動高亮為 active

#### Scenario: 點到不可營業時段不開 Dialog

- **GIVEN** 2026-05-22 為整店休假日
- **WHEN** 點擊該日任一格
- **THEN** 不開啟 Dialog；hover 時 cursor 為 default，並可顯示 tooltip「本日為休假日」

#### Scenario: 點到已被預約的格

- **GIVEN** 2026-05-22 14:00 有一筆 CONFIRMED 預約卡片
- **WHEN** 點擊該預約卡片
- **THEN** 開啟既有 `DrawerAppointmentInfo`（既有行為），**不**開代客預約 Dialog

#### Scenario: Dialog 預填 startAt 但時段不可選

- **GIVEN** Dialog 以 `prefillStartAt='2026-05-22T06:00:00.000Z'` 開啟，選完 service 後該 startAt 對應的 slot `reason='taken'`
- **WHEN** Dialog 載入 slots
- **THEN** 該 slot 顯示為不可選狀態（badge + tooltip）；Dialog 頂部顯示提示「您選的 14:00 時段目前不可用：已被預約」；使用者可選其他可用 slot

### Requirement: 行事曆視圖空白格與不可營業時段視覺區分

`BizAppointmentCalendar` 元件 SHALL 對「可建立的空檔」「已被預約」「不可營業時段（holiday / closed / 排班外）」三種狀態給出視覺上明確區分。

#### Scenario: 可建立空檔

- **GIVEN** 某時段格無預約、屬營業時間
- **WHEN** 元件渲染
- **THEN** 該格底色為淺白色；hover 時顯示高亮邊框與「+ 代客預約」icon；cursor 為 pointer

#### Scenario: 不可營業時段顯示斜紋

- **GIVEN** 該日為 MerchantHoliday 或 ScheduleOverride.isClosed
- **WHEN** 元件渲染
- **THEN** 該日整欄（週視圖）或整欄該 hour（日視圖）顯示為斜紋背景（`repeating-linear-gradient`）；cursor 為 default；無 hover 高亮

#### Scenario: 排班外時段（無 ScheduleRule 覆蓋）

- **GIVEN** 某 hour 不在任何 ScheduleRule 範圍內
- **WHEN** 元件渲染
- **THEN** 同「不可營業時段」斜紋背景處理

#### Scenario: 已被預約卡片

- **GIVEN** 某 slot 有 CONFIRMED 預約
- **WHEN** 元件渲染
- **THEN** 顯示預約卡片（含顧客 lastName、服務、開始時間）；點擊開啟 `DrawerAppointmentInfo`（既有行為）

### Requirement: 代客預約 Dialog 接受 prefill 參數

`OpenDialogAppointmentCreate` SHALL 接受 optional `prefillDate / prefillStartAt / prefillServiceId / prefillResourceId` 參數，於 Dialog 開啟時自動填入對應欄位；若 prefill 涉及 slot（`prefillStartAt`），SHALL 在 slot 載入後自動 active 並在頂部顯示「您點選的時段」提示。

#### Scenario: 僅 prefillDate

- **WHEN** 以 `{ slug, prefillDate: '2026-05-22' }` 開啟
- **THEN** 日期欄填入 2026-05-22；service / resource / startAt 仍待使用者選

#### Scenario: prefillDate + prefillStartAt + 該 slot 可選

- **WHEN** 以 `{ slug, prefillDate: '2026-05-22', prefillStartAt: '2026-05-22T06:00:00.000Z' }` 開啟、使用者後續選了 service 致 slot 載入、該 startAt 的 slot `reason=undefined`
- **THEN** 該 slot 自動 active（form.startAt 設為此值）；Dialog 頂部顯示「您點選的 14:00 已選中，請繼續填寫顧客資訊」

#### Scenario: prefillDate + prefillStartAt + 該 slot 不可選

- **GIVEN** 同上但 slot 載入後 `reason='taken'`
- **WHEN** Dialog 載完 slots
- **THEN** 該 slot 顯示為不可選狀態；form.startAt 維持空；Dialog 頂部顯示警示「您點選的 14:00 已被預約，請選其他時段」（黃色 alert）

#### Scenario: prefillServiceId 對應 RESOURCE 模式

- **WHEN** 以 `{ slug, prefillServiceId: 's-resource', prefillResourceId: 'r1' }` 開啟
- **THEN** service 與 resource 都自動填入；slot 自動載入

#### Scenario: prefillServiceId 為 QUEUE 模式（不合法）

- **WHEN** prefillServiceId 對應的 service `bookingMode='QUEUE'`
- **THEN** Dialog 載入後該 service 不出現在下拉（既有過濾邏輯）；form.serviceId 不設值；顯示提示「此服務不支援預約，請選擇其他服務」

### Requirement: 不可選時段顯示明確 reason 標示

`OpenDialogAppointmentCreate` 與 `BizAppointmentCalendar` 兩處 SHALL 在不可選 slot / 不可點格上顯示對應 reason 的本地化文字（badge + tooltip），並 SHALL 用視覺上與正常 slot 明顯不同的樣式區分。

#### Scenario: Dialog slot 顯示 reason badge

- **GIVEN** slot `reason='taken'`
- **WHEN** Dialog 渲染該 slot
- **THEN** button 顯示為淡灰底 + 中文字「14:00 · 已被預約」；hover 顯示完整 tooltip「此時段已被其他顧客預約」；`disabled=true`

#### Scenario: Dialog slot 顯示已過

- **GIVEN** slot `reason='past'`（startAt 在 now 之前）
- **WHEN** Dialog 渲染該 slot
- **THEN** button 為灰底 + 「09:00 · 已過」；hover tooltip「此時段已過，無法預約」

#### Scenario: Dialog slot 顯示已額滿（TIME_CAPACITY）

- **GIVEN** slot `reason='capacity'`
- **WHEN** Dialog 渲染
- **THEN** button 為「10:00 · 已額滿（10/10）」；hover tooltip「此時段名額已滿」

#### Scenario: Dialog 提供 i18n 切換

- **GIVEN** 使用者 locale 切換至 `en`
- **WHEN** Dialog 重新渲染同個 reason='taken' slot
- **THEN** 文字改為「14:00 · Booked」；tooltip 為英文版

#### Scenario: 行事曆斜紋格 tooltip

- **GIVEN** 2026-05-22 為 MerchantHoliday
- **WHEN** hover 該日欄位
- **THEN** tooltip 顯示「本日休假」（取自 MerchantHoliday.name 或 i18n 預設）

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

### Requirement: BizQueueWindowEditor 元件 UI

`app/components/biz/QueueWindowEditor.vue` SHALL 提供商家於 `/admin/queue-window` 編輯每週 7 天領號時段的 UI；星期欄 MUST 以本地化文字呈現、平日與週末 MUST 視覺區分、且 MUST 提供以「已啟用列」為來源的批次套用操作。

#### Scenario: 星期欄顯示本地化週名

- **GIVEN** 商家以任一語系（zh / en / ja）登入 `/admin/queue-window`
- **WHEN** 元件渲染 7 列
- **THEN** 每列日期欄顯示對應語系的完整週名（例如 zh：週日／週一／…／週六；en：Sun / Mon / … / Sat；ja：日曜／月曜／…／土曜），不得出現 i18n key 字串或單一字元

#### Scenario: i18n 取陣列失敗時的 fallback

- **GIVEN** `common.weekdayLong` 對應 message resource 不是長度 7 的字串陣列（key 漂移、locale 檔損壞）
- **WHEN** 元件渲染
- **THEN** 元件 MUST 顯示硬編碼的繁中週名 fallback（`週日 / 週一 / … / 週六`），不得顯示 i18n key 字串、不得顯示空白或單字元

#### Scenario: 平日與週末視覺區分

- **GIVEN** 元件渲染 7 列
- **WHEN** 使用者目視
- **THEN** 週日（weekday=0）與週六（weekday=6）兩列的背景色或日期欄文字色 MUST 與週一至週五（weekday=1..5）有可辨識的差異

#### Scenario: 無已啟用列時批次按鈕 disabled

- **GIVEN** 7 列皆 `isActive=false`
- **WHEN** 使用者檢視批次工具列
- **THEN** 「套用到所有平日」與「套用到所有日」按鈕 MUST 皆為 disabled 狀態，且 MUST 顯示提示文字「請先啟用任一列做為來源」（或對應語系翻譯）

#### Scenario: 套用到所有平日

- **GIVEN** 至少有一列 `isActive=true`（例如週一 startTime=10:00、endTime=17:00、maxTickets=30）
- **WHEN** 使用者點擊「套用到所有平日」
- **THEN** weekday 1..5 五列的 `startTime / endTime / maxTickets` MUST 與來源列一致、且 `isActive` 皆 true；weekday 0 與 weekday 6 的 `isActive` 與值 MUST 保持原狀不變

#### Scenario: 套用到所有日（需確認）

- **GIVEN** 至少有一列 `isActive=true`
- **WHEN** 使用者點擊「套用到所有日」
- **THEN** 元件 MUST 先彈出確認對話框（`ElMessageBox.confirm`）說明此操作會覆蓋週六、週日的設定
- **AND WHEN** 使用者確認
- **THEN** weekday 0..6 七列的 `startTime / endTime / maxTickets` MUST 與來源列一致、且 `isActive` 皆 true

#### Scenario: 多個 active 列時的 source 選擇

- **GIVEN** 有多列 `isActive=true`（例如週一、週三皆啟用，值不同）
- **WHEN** 使用者點擊任一批次按鈕
- **THEN** 元件 MUST 以**按 weekday 升序排列下的第一個** `isActive=true` 列作為來源（本例為週一）

#### Scenario: 不變更對外 v-model 契約

- **GIVEN** 父元件 `app/pages/admin/queue-window.vue` 仍以 `v-model: QueueWindowItem[]` 綁定
- **WHEN** 批次操作或單列編輯觸發 emit
- **THEN** emit 出去的陣列型別與順序語意 MUST 與本變更前一致（每列含 `weekday / startTime / endTime / maxTickets / isActive`），後端 `PUT /nuxt-api/merchant/queue-window` 行為不變

### Requirement: 排班頁警告未綁定資源

當商家在「📅 預約時段」tab 將 scope 切換到某個資源(非 MERCHANT)時,系統 SHALL 即時檢查該資源是否被任何 `bookingMode === 'RESOURCE'` 的啟用服務透過 `ServiceResource` 綁定;若未綁定,SHALL 顯示橘色警告 banner 提示商家此設定對顧客不可見,並提供一鍵跳轉服務頁的入口。警告 SHALL **不阻擋**任何排班操作,商家仍可正常設定與儲存時段。

#### Scenario: 未綁定資源顯示警告

- **GIVEN** 商家進入 `/admin/schedule?tab=weekly`
- **WHEN** 將 scope 切換到資源 R,且系統偵測到 R 沒有被任何 `bookingMode === 'RESOURCE' && isActive` 的服務的 `resourceIds` 包含
- **THEN** 在 scope 切換器下方顯示橘色 ElAlert,標題:「此資源尚未被任何服務綁定,顧客在預約頁與後台代客預約都無法選到他」;按鈕「前往服務頁綁定」連到 `/admin/services`

#### Scenario: 已綁定資源不顯示警告

- **GIVEN** 商家進入 `/admin/schedule?tab=weekly`
- **WHEN** 將 scope 切換到資源 R,且 R 至少被一個 RESOURCE 服務綁定
- **THEN** 不顯示警告 banner;正常渲染 SchedulerWeeklyEditor

#### Scenario: MERCHANT scope 不檢查綁定

- **GIVEN** 商家進入 `/admin/schedule?tab=weekly`
- **WHEN** scope 為 MERCHANT(整店)
- **THEN** 不渲染未綁定警告(此 scope 與資源綁定無關)

#### Scenario: 警告不阻擋儲存

- **GIVEN** 顯示未綁定警告中
- **WHEN** 使用者修改時段並點「儲存」
- **THEN** 排班正常儲存,警告維持顯示;ElMessage success 提示「已儲存」

### Requirement: 資源頁顯示綁定服務

`/admin/resources` 列表 SHALL 包含「已綁服務」column，顯示每個資源被哪些 service 透過 `ServiceResource` 綁定（含 RESOURCE / RESOURCE_OPTIONAL / QUEUE 三種 bookingMode，過濾條件為 `isActive === true && resourceIds` 包含該 resource）；未被任何 service 綁定的資源 SHALL 以視覺方式提醒商家。資料 SHALL 由客戶端 join `GetServiceList` 與 `GetResourceList` 計算，**不新增後端 endpoint**。

#### Scenario: 列表載入並 join 服務資料

- **WHEN** 訪 `/admin/resources`
- **THEN** 並行請求 `GetResourceList()` 與 `GetServiceList()`；組出 `Map<resourceId, ServiceItem[]>` 對應關係（過濾條件：`service.isActive === true` 且 `service.resourceIds` 包含該 resource）

#### Scenario: 已綁服務以 ElTag 列出

- **GIVEN** 資源 R 被服務 A（RESOURCE）與服務 B（QUEUE）綁定
- **WHEN** 渲染 R 那一列的「已綁服務」column
- **THEN** 顯示兩個 ElTag，文字分別為 A.name 與 B.name，**不依 `bookingMode` 過濾**

#### Scenario: 未綁服務顯示提醒

- **GIVEN** 資源 R 未被任何啟用 service 的 `resourceIds` 包含
- **WHEN** 渲染 R 那一列
- **THEN** 「已綁服務」column 顯示「— 尚未綁定」（灰色文字）+ 小 hint「請在『服務』頁編輯服務時勾選此資源」（**hint 不得提及任何特定 bookingMode 名稱**）

#### Scenario: QUEUE 模式多資源綁定正確顯示

- **GIVEN** 啟用的 QUEUE 服務「看診」綁定 A 診 / B 診
- **WHEN** 渲染 `/admin/resources`
- **THEN** A 診那列「已綁服務」顯示 ElTag「看診」；B 診那列亦顯示 ElTag「看診」

#### Scenario: 停用 service 不計入綁定

- **GIVEN** 服務 X 的 `isActive === false`，即使 `resourceIds` 包含 R
- **WHEN** 計算 R 的已綁服務
- **THEN** 不顯示 X（維持既有 UX：停用服務不出現在「已綁服務」column）

### Requirement: 服務頁顯示綁定資源

`/admin/services` 列表 SHALL 包含「資源」column，對於所有 `resourceIds.length > 0` 的 service（不依 `bookingMode` 過濾，含 RESOURCE / RESOURCE_OPTIONAL / QUEUE），SHALL 把 `resourceIds` 對照 `GetResourceList()` 結果展開為 ElTag 顯示資源名稱；`resourceIds` 為空陣列時 SHALL 顯示「—」placeholder。資料 SHALL 由客戶端 join `GetServiceList` 與 `GetResourceList` 計算，**不新增後端 endpoint**。

#### Scenario: RESOURCE 服務顯示已綁資源

- **GIVEN** RESOURCE 服務「美甲」綁定資源「技師 A」、「技師 B」
- **WHEN** 渲染 `/admin/services`
- **THEN** 「美甲」那列「資源」column 顯示兩個 ElTag：「技師 A」、「技師 B」

#### Scenario: QUEUE 服務顯示已綁資源

- **GIVEN** QUEUE 服務「看診」綁定資源「A 診」、「B 診」
- **WHEN** 渲染 `/admin/services`
- **THEN** 「看診」那列「資源」column 顯示兩個 ElTag：「A 診」、「B 診」（**不能顯示「—」**）

#### Scenario: RESOURCE_OPTIONAL 服務顯示已綁資源

- **GIVEN** RESOURCE_OPTIONAL 服務「按摩」綁定資源「按摩床 1」
- **WHEN** 渲染 `/admin/services`
- **THEN** 「按摩」那列「資源」column 顯示 ElTag「按摩床 1」

#### Scenario: 無資源綁定時顯示 placeholder

- **GIVEN** TIME_SLOT 服務「諮詢」的 `resourceIds` 為空陣列
- **WHEN** 渲染 `/admin/services`
- **THEN** 「諮詢」那列「資源」column 顯示「—」（灰色 placeholder）

#### Scenario: resourceId 對應不到 resource 時 fallback 顯示 id

- **GIVEN** service 的 `resourceIds` 含某個 id 在 `GetResourceList` 結果中找不到（例如資源已被軟刪除但 service 未同步）
- **WHEN** 渲染對應 ElTag
- **THEN** 該 ElTag 顯示原始 `rid` 字串（fallback），不阻塞整列渲染

### Requirement: 預約管理列表預設只顯示活躍預約

`/admin/appointments?view=list` SHALL 預設只顯示「活躍預約」：`status = CONFIRMED` 且 `startAt >= 當天 00:00`（以商家時區計）。篩選列 SHALL 提供顯眼的「顯示已結案」切換開關（建議 `ElSwitch`），預設關閉；開啟時 SHALL 清空 status 篩選預設值，並將 `dateFrom` 上限往前擴展至 90 天前（與 `appointment` 表保留範圍對齊），以同時顯示 `CANCELED / COMPLETED / NO_SHOW` 紀錄。「顯示已結案」開關狀態僅存在於當前 session（不持久化至 URL 或 localStorage），重新進頁面預設關閉。

行事曆 view 不受此預設過濾影響，仍 SHALL 顯示所有狀態的預約，避免格子空白。

#### Scenario: 預設過濾活躍預約

- **GIVEN** 商家於 2026-05-19 09:00 進入 `/admin/appointments?view=list`
- **AND** 資料庫存在多筆預約：A（CONFIRMED，2026-05-20）、B（CANCELED，2026-05-18）、C（COMPLETED，2026-05-18）、D（CONFIRMED，2026-05-19 08:00 已過）、E（CONFIRMED，2026-05-18）
- **WHEN** 列表載入完成
- **THEN** 只顯示 A、D（status=CONFIRMED 且 startAt >= 2026-05-19 00:00）
- **AND** 「顯示已結案」開關預設為關閉狀態

#### Scenario: 開啟「顯示已結案」顯示所有狀態

- **GIVEN** 同上初始狀態
- **WHEN** 使用者開啟「顯示已結案」開關
- **THEN** 列表重新查詢，顯示所有 status（含 CANCELED / COMPLETED / NO_SHOW），dateFrom 擴展至今日往前 90 天
- **AND** status 下拉篩選的預設值清空，使用者可自行選特定 status

#### Scenario: 行事曆 view 不受預設過濾影響

- **GIVEN** 商家在 `/admin/appointments?view=calendar`
- **WHEN** 行事曆載入完成
- **THEN** 顯示所有 status 的預約（包含 CANCELED / COMPLETED / NO_SHOW），不套用列表的活躍過濾

#### Scenario: 從行事曆切到列表觸發預設過濾

- **GIVEN** 商家在行事曆 view 看見所有狀態的預約
- **WHEN** 切換 toggle 到列表
- **THEN** 列表立即套用「只顯示 CONFIRMED + 今日起」的預設過濾
- **AND** 「顯示已結案」開關狀態為關閉

#### Scenario: 重新整理頁面後預設過濾仍有效

- **GIVEN** 商家在列表 view 已開啟「顯示已結案」開關
- **WHEN** 重新整理瀏覽器頁面
- **THEN** 開關恢復為關閉狀態，列表只顯示活躍預約

### Requirement: 預約狀態與顧客稱謂須經 i18n 顯示

商家後台所有顯示 `AppointmentStatus`（`CONFIRMED / CANCELED / COMPLETED / NO_SHOW`）與 `CustomerTitle`（`MR / MRS / MISS / MX`）的位置 SHALL 透過 `$t()` 顯示在地化文字，禁止直接渲染英文 enum 值或在 component 內 hard-code 中文對照表。對應的 i18n key 採 enum 同名命名：

- `appointment.status.<ENUM>`（4 個 key）
- `appointment.customerTitle.<ENUM>`（4 個 key）

三個語系檔（`i18n/locales/zh.js / en.js / ja.js`）SHALL 同步補齊上述 8 個 key。未翻譯時 SHALL fallback 到原始 enum 值（透過 `$t(key, fallback)` 第二參數），避免畫面顯示 key 本身。

#### Scenario: 列表狀態顯示中文（zh）

- **GIVEN** 商家當前語系為 zh-tw
- **WHEN** 訪 `/admin/appointments?view=list` 且列表有 CONFIRMED / CANCELED / COMPLETED / NO_SHOW 各一筆
- **THEN** 狀態欄分別顯示「已預約」「已取消」「已完成」「未到」，不出現英文

#### Scenario: 列表狀態顯示英文（en）

- **GIVEN** 商家當前語系為 en
- **WHEN** 訪同頁面
- **THEN** 狀態欄分別顯示 `Confirmed / Canceled / Completed / No-show`

#### Scenario: 歷史紀錄狀態欄 i18n

- **GIVEN** 商家在 `/admin/appointments/archive` 看到一筆 status=CANCELED 的紀錄
- **WHEN** 語系切換為 ja
- **THEN** 狀態欄即時更新為「キャンセル」

#### Scenario: 顧客稱謂 i18n

- **GIVEN** 商家在歷史紀錄或列表看到顧客欄「王先生」
- **WHEN** 語系切到 en
- **THEN** 顯示為「Wang Mr.」（或對應的 customerLastName + i18n title 拼接），不出現 `MR` 字串

### Requirement: 歷史紀錄頁須提供返回預約管理入口

`/admin/appointments/archive` SHALL 在頁面右上角（`BizPageHeader` 的 `#actions` slot）提供「← 返回預約管理」按鈕，點擊以 `router.push('/admin/appointments')` 導回主頁，禁止改用 `router.back` 以避免從外部書籤直接進入 archive 時跳出站外。

#### Scenario: 從預約管理進歷史紀錄再返回

- **GIVEN** 商家在 `/admin/appointments?view=list` 點擊「歷史紀錄」按鈕
- **AND** 進入 `/admin/appointments/archive`
- **WHEN** 點擊頁面右上角「← 返回預約管理」按鈕
- **THEN** 跳回 `/admin/appointments`，view 為 calendar（預設）

#### Scenario: 從外部書籤直接進歷史紀錄也能返回

- **GIVEN** 商家透過外部書籤直接訪 `/admin/appointments/archive`
- **WHEN** 點擊「← 返回預約管理」按鈕
- **THEN** 進入 `/admin/appointments`（即使瀏覽器歷史只有 archive 一筆），不會跳出站外

### Requirement: 列表操作欄收斂為「詳細 + 更多」

`BizAppointmentTable` 的「操作」欄 SHALL 主要動作只保留兩個 link button：「詳細」與「更多▾」。「更多」下拉 SHALL 依預約狀態與時間動態決定內容：

- `status = CONFIRMED` 且 `startAt > now`：更多下拉只含「取消預約」。
- `status = CONFIRMED` 且 `startAt <= now`：更多下拉含「取消預約」「標記完成」「標記未到」。
- 其他狀態（`CANCELED / COMPLETED / NO_SHOW`）：不顯示「更多」按鈕，只剩「詳細」。

操作欄寬度 SHALL 設為 220px 且 `fixed="right"`，確保不換行且滑動表格時仍可見。

#### Scenario: 未到時間的 CONFIRMED 顯示「詳細 + 更多（取消）」

- **GIVEN** 列表有一筆 CONFIRMED 預約，startAt 為 2026-05-25（未到）
- **WHEN** 觀察該列的操作欄
- **THEN** 顯示「詳細」與「更多▾」兩個 link，「更多」下拉只含「取消預約」一個選項

#### Scenario: 已過時間的 CONFIRMED 顯示「詳細 + 更多（取消／完成／未到）」

- **GIVEN** 列表有一筆 CONFIRMED 預約，startAt 為昨日 14:00
- **WHEN** 觀察該列的操作欄
- **THEN** 顯示「詳細」與「更多▾」，下拉含「取消預約」「標記完成」「標記未到」三個選項

#### Scenario: 結案狀態只顯示「詳細」

- **GIVEN** 列表有一筆 CANCELED / COMPLETED / NO_SHOW 的預約
- **WHEN** 觀察該列的操作欄
- **THEN** 只顯示「詳細」一個 link button，不顯示「更多」

#### Scenario: 操作欄不換行

- **GIVEN** 列表載入完成，視窗寬度 >= 1280px
- **WHEN** 觀察任一列操作欄
- **THEN** 「詳細」與「更多▾」在同一行顯示，欄寬 220px 內可完整呈現，不換行

### Requirement: 列表與歷史紀錄入口須提供 tooltip 或副標說明用途

`/admin/appointments` 的右上角「列表」toggle 與「歷史紀錄」按鈕 SHALL 提供 tooltip 或副標說明，明確區分用途：

- 「列表」tooltip 內容：「進行中的預約（可開啟『顯示已結案』查看已取消／完成／未到）」
- 「歷史紀錄」tooltip 內容：「90 天前已歸檔的舊預約紀錄」

#### Scenario: hover「列表」toggle 顯示說明

- **GIVEN** 商家在 `/admin/appointments`
- **WHEN** 滑鼠移到「列表」radio button 上停留
- **THEN** 顯示 tooltip：「進行中的預約（可開啟『顯示已結案』查看已取消／完成／未到）」

#### Scenario: hover「歷史紀錄」按鈕顯示說明

- **GIVEN** 同上
- **WHEN** 滑鼠移到「歷史紀錄」按鈕上停留
- **THEN** 顯示 tooltip：「90 天前已歸檔的舊預約紀錄」

### Requirement: 服務 CRUD 支援 RESOURCE_OPTIONAL 模式

系統 SHALL 在 Service CRUD 端點接受 `bookingMode = 'RESOURCE_OPTIONAL'`，其驗證規則與 `RESOURCE` 一致：必須提供 `resourceIds` 且至少含一個屬於當前商家的啟用資源；商家後台「編輯服務」彈窗 SHALL 將 RESOURCE_OPTIONAL 與 RESOURCE 並列為可選模式並沿用同一資源綁定 UI。

#### Scenario: 新增服務（RESOURCE_OPTIONAL + resourceIds）

- **GIVEN** 已登入商家、存在啟用資源 `[r1, r2]`
- **WHEN** `POST /nuxt-api/service` body `{ name: '拔牙', bookingMode: 'RESOURCE_OPTIONAL', durationMinutes: 60, slotIntervalMinutes: 60, resourceIds: ['r1', 'r2'] }`
- **THEN** 響應 200；DB 寫入 Service（bookingMode=RESOURCE_OPTIONAL）+ 兩筆 ServiceResource

#### Scenario: RESOURCE_OPTIONAL 未提供 resourceIds 拒絕

- **WHEN** body `{ name: '拔牙', bookingMode: 'RESOURCE_OPTIONAL', resourceIds: [] }`
- **THEN** 響應 400，三語訊息提示需綁定至少一個資源

#### Scenario: RESOURCE_OPTIONAL 跨商家資源拒絕

- **WHEN** body 含的 `resourceIds` 任一 id 不屬於 `auth.merchantId`
- **THEN** 響應 400 或 403（與 RESOURCE 模式同等保護）

#### Scenario: 更新 RESOURCE_OPTIONAL 覆蓋 resourceIds

- **GIVEN** Service `bookingMode=RESOURCE_OPTIONAL` 已綁定 `[r1, r2]`
- **WHEN** `PUT /nuxt-api/service/[id]` body `{ resourceIds: ['r2', 'r3'] }`
- **THEN** transaction 內 deleteMany 後 createMany `[r2, r3]`；最終只剩 r2、r3 關聯

#### Scenario: RESOURCE 與 RESOURCE_OPTIONAL 互轉

- **GIVEN** Service `bookingMode=RESOURCE` 綁定 `[r1, r2]`
- **WHEN** `PUT /nuxt-api/service/[id]` body `{ bookingMode: 'RESOURCE_OPTIONAL' }`（resourceIds 未送）
- **THEN** 響應 200；bookingMode 更新；既有 ServiceResource 關聯保留不動
- **WHEN** 再 PUT `{ bookingMode: 'RESOURCE' }`
- **THEN** 響應 200；既有資源綁定不變；既有 Appointment 不受影響

#### Scenario: 商家後台彈窗模式選項

- **GIVEN** 商家進入「服務管理」並點擊「新增 / 編輯」按鈕
- **THEN** 「預約模式」下拉至少含五個選項：`TIME_SLOT / TIME_CAPACITY / RESOURCE / RESOURCE_OPTIONAL / QUEUE`
- **AND** 選 `RESOURCE_OPTIONAL` 時，顯示「綁定資源」多選區塊（同 RESOURCE 行為）
- **AND** 文案以三語標明 RESOURCE_OPTIONAL 為「顧客可選不指定」、RESOURCE 為「顧客必須指定」

### Requirement: 商家啟用 Provider 制與自訂稱呼

系統 SHALL 在 `Merchant` 模型新增 `providerModeEnabled: Boolean @default(false)` 與 `providerLabel: Json @default("{}")` 兩個欄位。`providerLabel` 結構 SHALL 為 `{ zh?: string, en?: string, ja?: string }`，存放商家對「服務人員」一詞的三語自訂稱呼。系統 SHALL 在 `PUT /nuxt-api/merchant/[id]` 接受並寫入這兩個欄位；`GET /nuxt-api/merchant` 與 `GET /nuxt-api/public/m/[slug]` SHALL 回傳這兩個欄位。系統 SHALL 提供共用 helper（`shared/i18n/provider-label.ts`）依「自訂 label[locale] → 自訂 label[商家偏好語] → i18n 預設」三層 fallback 解析顯示稱呼，i18n 預設為 zh:「服務人員」、en:「Provider」、ja:「スタッフ」。

#### Scenario: 啟用 Provider 制

- **GIVEN** 已登入商家、`providerModeEnabled` 原為 false
- **WHEN** `PUT /nuxt-api/merchant/[id]` body `{ providerModeEnabled: true, providerLabel: { zh: '醫師', en: 'Doctor', ja: '医師' } }`
- **THEN** 響應 200；DB 兩欄位同步更新

#### Scenario: 僅更新自訂稱呼

- **WHEN** `PUT` body 僅含 `{ providerLabel: { zh: '技師' } }`
- **THEN** 響應 200；`providerLabel` 與既有 Json 合併（en / ja 既值保留）

#### Scenario: 自訂稱呼結構錯誤

- **WHEN** `PUT` body `{ providerLabel: { fr: 'Provider' } }` 或 `{ providerLabel: 'doctor' }`
- **THEN** 響應 400（Zod 驗證：僅接受 zh/en/ja 三 key 且值為非空字串）

#### Scenario: 未填自訂稱呼時 fallback i18n 預設

- **GIVEN** 商家 `providerLabel = {}`、目前 locale=zh
- **WHEN** helper `resolveProviderLabel(merchant, 'zh')`
- **THEN** 回傳「服務人員」

#### Scenario: 部分語言缺值時 fallback 商家偏好語

- **GIVEN** 商家 `providerLabel = { zh: '醫師' }`、商家 `timezone` 暗示偏好語=zh、目前 locale=en
- **WHEN** `resolveProviderLabel(merchant, 'en')`
- **THEN** 回傳「醫師」（zh 既有自訂 label，較 i18n 預設「Provider」優先）

#### Scenario: 公開端點回傳兩欄位

- **WHEN** `GET /nuxt-api/public/m/{slug}`
- **THEN** `data.merchant` 含 `providerModeEnabled: boolean` 與 `providerLabel: { zh?, en?, ja? }`

### Requirement: Provider CRUD

系統 SHALL 提供 Provider 的列表 / 詳情 / 新增 / 更新 / 軟刪除 / 啟停 / 排序端點，並強制以 `auth.merchantId` 限定 tenancy。Provider 模型欄位為 `{ id, merchantId, name, title?, bio?, avatarUrl?, isActive: Boolean @default(true), displayOrder: Int @default(0), createdAt, updatedAt, deletedAt }`。

#### Scenario: 列表

- **GIVEN** 已登入商家
- **WHEN** `GET /nuxt-api/provider`
- **THEN** 響應 200，`data.items` 為當前 merchantId、deletedAt=null 的所有 Provider；每筆含 `serviceIds: string[]`（透過 ProviderService 關聯）；按 `displayOrder asc, createdAt asc`

#### Scenario: 新增 Provider

- **WHEN** `POST /nuxt-api/provider` body `{ name: '王醫師', title: '院長', bio: '...', avatarUrl: 'https://...' }`
- **THEN** 響應 200，DB 寫入；`isActive` 預設 true、`displayOrder` 預設 0

#### Scenario: 更新 Provider

- **WHEN** `PUT /nuxt-api/provider/[id]` body `{ name: '王大明', isActive: false }`
- **THEN** 響應 200；DB 更新

#### Scenario: 軟刪除

- **WHEN** `DELETE /nuxt-api/provider/[id]`
- **THEN** Provider.deletedAt = now；列表不再出現；既有 Appointment.providerId 不動

#### Scenario: 跨商家拒絕

- **WHEN** 商家 A 嘗試 `PUT` / `DELETE` 屬於商家 B 的 providerId
- **THEN** 響應 404（與服務 CRUD 同政策）

#### Scenario: 圖片上傳 kind=provider-avatar

- **WHEN** `POST /nuxt-api/upload/image?kind=provider-avatar` multipart `file=avatar.png`
- **THEN** 響應 200，`data.url` 為 R2 URL、`data.key = merchant/{merchantId}/provider-avatar/{timestamp}-avatar.png`

### Requirement: 商家後台 Provider 管理頁

系統 SHALL 在 `/admin/providers` 提供 Provider 列表與 CRUD 頁面，使用 `back-desk` layout + `merchant` middleware 保護；sidebar 「營運」分群 SHALL 在 `providerModeEnabled=true` 時顯示「服務人員」項目（標題用商家 `providerLabel` fallback 後的稱呼），未啟用時隱藏。

#### Scenario: 啟用後 sidebar 顯示

- **GIVEN** 商家 `providerModeEnabled=true`、`providerLabel.zh='醫師'`、目前 locale=zh
- **WHEN** 訪 `/admin/*` 任一頁
- **THEN** 左側 sidebar 「營運」分群顯示「醫師」項目連到 `/admin/providers`

#### Scenario: 未啟用時 sidebar 隱藏

- **GIVEN** 商家 `providerModeEnabled=false`
- **WHEN** 訪 `/admin/*`
- **THEN** sidebar 不顯示 Provider 連結；直接訪 `/admin/providers` 仍可進入（手動 URL），但頁面頂部顯示 banner「目前未啟用服務人員制，到設定頁啟用」

#### Scenario: 列表頁

- **WHEN** 訪 `/admin/providers`
- **THEN** 渲染表格 + 新增 / 編輯彈窗 + 頭像欄位 + 啟停 toggle + 排序欄位 + 已綁服務欄位

#### Scenario: 啟用精靈

- **GIVEN** 商家 `providerModeEnabled=false`
- **WHEN** 商家在 `/admin/settings` 切開 Provider 制開關並按儲存
- **THEN** 前端彈出 dialog「啟用後，顧客預約時將先選服務人員」+ 「建立第一位」CTA → 點擊跳轉 `/admin/providers/new`；建立完成後再提示「請到排班頁把規則綁到服務人員」+ 「前往排班」CTA

#### Scenario: 設定頁顯示 Provider 制區塊

- **WHEN** 訪 `/admin/settings`
- **THEN** 表單含「Provider 制」區塊：`providerModeEnabled` 開關 + 三語 `providerLabel` 三個輸入欄；未啟用時三語欄位 disabled 且顯示 placeholder（i18n 預設稱呼）

