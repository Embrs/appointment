## MODIFIED Requirements

### Requirement: 商家後台配置頁面

系統 SHALL 提供 `back-desk` layout + `merchant` middleware 保護的商家後台頁面;sidebar 導覽 SHALL 以三個語意分群呈現:「營運」、「排班」、「設定」。「排班」分群下的 `/admin/schedule` SHALL 為四 tab 容器頁,內含「📅 預約時段」、「🔧 單日調整」、「🚫 公休日」、「🎟 現場領號時段」四個 tab,tab 顯示性依商家服務的 bookingMode 構成動態決定。原 `/admin/holidays` 與 `/admin/queue-window` SHALL 保留為 redirect 路由。當商家 `providerModeEnabled=true` 時，「**設定**」分群 SHALL 額外顯示「服務人員」項目連到 `/admin/providers`（顯示文字採用 `providerLabel` fallback 鏈解析），「排班」分群下的「📅 預約時段」與「🔧 單日調整」tab SHALL 額外提供 PROVIDER scope 切換器。Sidebar 中「服務」「資源」「成員」三個導覽項目的顯示文字 SHALL 為「服務項目」/「場所或設備」/「成員帳號」（三語同步），URL 路徑仍維持 `/admin/services` / `/admin/resources` / `/admin/staff` 不變。

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
- **THEN** 渲染表格 + 新增 / 編輯彈窗;bookingMode 切換時對應欄位動態顯示；商家 `providerModeEnabled=true` 時，編輯彈窗額外顯示「需指定服務人員」開關 + Provider 多選器；頁面標題、副標、新增按鈕、表格表頭、編輯/刪除按鈕、停用後綴等使用者可見文案 SHALL 全部透過 i18n key 渲染（不得硬編碼）；中文 locale 下 listTitle = "服務項目管理"、英文 locale = "Service Items"、日文 locale = "サービス項目"，並隨切換 locale 即時生效

#### Scenario: 資源 /admin/resources

- **WHEN** 訪 `/admin/resources`
- **THEN** 渲染表格 + 新增 / 編輯彈窗;表格 SHALL 包含「已綁服務」column(詳見「資源頁顯示綁定服務」requirement)；頁面標題、副標、新增按鈕、表格表頭、編輯/刪除按鈕、停用後綴等使用者可見文案 SHALL 全部透過 i18n key 渲染（不得硬編碼）；中文 locale 下 listTitle = "場所或設備管理"、英文 = "Venues or Equipment"、日文 = "場所・設備"，並隨切換 locale 即時生效

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
  - 「設定」:商家設定 / 對外連結 / 服務人員（providerModeEnabled=true 時）/ 服務項目 / 場所或設備 / 成員帳號
  順序固定如上;`商家設定` 依 `HasRule('merchant.settings.update')`、`服務人員` 依 `providerModeEnabled=true`、`成員帳號` 依 `HasRule('merchant.staff.manage')` 條件顯示

#### Scenario: Sidebar 平台管理員視角

- **GIVEN** 平台管理員登入(`isAdmin=true`)
- **WHEN** 渲染 sidebar
- **THEN** 維持既有三個 NavLink(總覽 / 商家管理 / 管理員),不套用分群

#### Scenario: 員工 /admin/staff(OWNER only)

- **GIVEN** 當前用戶 role='OWNER'
- **WHEN** 訪 `/admin/staff`
- **THEN** 渲染員工表格 + 新增 / 編輯 / 啟用切換；頁面標題、副標、新增按鈕、表格表頭（姓名 / Email / 角色 / 狀態 / 操作）、編輯按鈕、啟用/停用按鈕、權限封鎖訊息等使用者可見文案 SHALL 全部透過 i18n key 渲染（不得硬編碼）；中文 locale 下 listTitle = "成員帳號管理"、英文 = "Member Accounts"、日文 = "メンバーアカウント"，並隨切換 locale 即時生效

#### Scenario: 員工頁 STAFF 訪問

- **GIVEN** 當前用戶 role='STAFF'
- **WHEN** 訪 `/admin/staff`
- **THEN** 顯示「無權限」訊息,不渲染表格

#### Scenario: 非商家訪 /admin/*

- **GIVEN** 未登入或 selfType !== 'merchant'
- **WHEN** 訪 `/admin/*`(含 redirect 舊路由)
- **THEN** middleware 跳轉到 `/sign-in`

## ADDED Requirements

### Requirement: BookingMode UI 文案使用「場所或設備」術語

商家後台所有顯示 BookingMode 文案的位置（服務管理頁的 bookingMode 選擇器、服務列表的 bookingMode 標籤、相關 hint）SHALL 將 `RESOURCE` enum 顯示為「場所或設備指定」/「Venue or Equipment Required」/「場所・設備の指定」三語；`RESOURCE_OPTIONAL` enum 顯示為「可選場所或設備」/「Venue or Equipment Optional」/「場所・設備（任意）」三語。Prisma BookingMode enum 字串值與後端 API contract 中的 enum 字串 SHALL 維持為 `RESOURCE` / `RESOURCE_OPTIONAL` 不變。

#### Scenario: 服務編輯 bookingMode 選擇器顯示新文案

- **GIVEN** 商家進入 `/admin/services` 並點「新增服務」
- **WHEN** 展開 bookingMode 下拉
- **THEN** 看到的選項文案為「固定時段 / 時段+人數 / 場所或設備指定 / 可選場所或設備 / 號碼牌」
- **AND** 選定「場所或設備指定」後送出，API 收到的 `bookingMode` 仍為字串 `'RESOURCE'`

#### Scenario: 服務列表標籤顯示新文案

- **GIVEN** 商家已建立一個 bookingMode=RESOURCE 的服務
- **WHEN** 訪 `/admin/services`
- **THEN** 該服務 row 的 bookingMode 欄位顯示「場所或設備指定」（中文）/ "Venue or Equipment Required"（英文）/「場所・設備の指定」（日文）
