## ADDED Requirements

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

## MODIFIED Requirements

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
