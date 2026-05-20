> 註:本 delta 預期在 `merchant-nav-restructure` sync 之後套用。MODIFIED 的 scenarios 指向該變更引入的場景內容。

## MODIFIED Requirements

### Requirement: 商家後台配置頁面

系統 SHALL 提供 `back-desk` layout + `merchant` middleware 保護的商家後台頁面;sidebar 導覽 SHALL 以三個語意分群呈現:「營運」、「排班」、「設定」。「排班」分群下的 `/admin/schedule` SHALL 為四 tab 容器頁,內含「📅 預約時段」、「🔧 單日調整」、「🚫 公休日」、「🎟 現場領號時段」四個 tab,tab 顯示性依商家服務的 bookingMode 構成動態決定。原 `/admin/holidays` 與 `/admin/queue-window` SHALL 保留為 redirect 路由。

#### Scenario: Dashboard /admin

- **GIVEN** 商家已登入
- **WHEN** 訪 `/admin`
- **THEN** 渲染 Dashboard,三張卡片(服務數、資源數、今日預約數預留 "—")+ 最近編輯服務列表

#### Scenario: 設定 /admin/settings

- **WHEN** 訪 `/admin/settings`
- **THEN** 渲染商家欄位編輯表單(含 logo / cover ImageUploader、cancelPolicy 選擇)

#### Scenario: 對外連結 /admin/share-link

- **WHEN** 訪 `/admin/share-link`
- **THEN** 渲染 `/m/{slug}` 連結(複製按鈕)+ QR code 圖片

#### Scenario: 服務 /admin/services

- **WHEN** 訪 `/admin/services`
- **THEN** 渲染表格 + 新增 / 編輯彈窗;bookingMode 切換時對應欄位動態顯示

#### Scenario: 資源 /admin/resources

- **WHEN** 訪 `/admin/resources`
- **THEN** 渲染表格 + 新增 / 編輯彈窗;表格 SHALL 包含「已綁服務」column(詳見「資源頁顯示綁定服務」requirement)

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

#### Scenario: 預約時段 tab 內容

- **WHEN** 啟用 `tab=weekly`(且該 tab 可見)
- **THEN** 渲染 scope 切換(MERCHANT / 各 RESOURCE) + SchedulerWeeklyEditor;副標顯示「設定每週固定營業時段。若有單日臨時變動請切換到『🔧 單日調整』tab」;同時顯示「影響服務:{逗號分隔的 bookingMode !== 'QUEUE' 啟用服務名}」

#### Scenario: 單日調整 tab 內容

- **WHEN** 啟用 `tab=overrides`(且該 tab 可見)
- **THEN** 渲染特定日期覆寫清單 + 新增/編輯/刪除操作;tab 標題顯示為「🔧 單日調整」;副標顯示「設定某一天和平常不一樣的時段或休息。整店全日休請改用『🚫 公休日』tab」;影響服務行同「預約時段」tab

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

## ADDED Requirements

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

`/admin/resources` 列表 SHALL 包含「已綁服務」column,顯示每個資源被哪些 `bookingMode === 'RESOURCE'` 服務的 `resourceIds` 包含;未被任何服務綁定的資源 SHALL 以視覺方式提醒商家。資料 SHALL 由客戶端 join `GetServiceList` 與 `GetResourceList` 計算,**不新增後端 endpoint**。

#### Scenario: 列表載入並 join 服務資料

- **WHEN** 訪 `/admin/resources`
- **THEN** 並行請求 `GetResourceList()` 與 `GetServiceList()`;組出 `Map<resourceId, ServiceItem[]>` 對應關係

#### Scenario: 已綁服務以 ElTag 列出

- **GIVEN** 資源 R 被服務 A 與服務 B 綁定
- **WHEN** 渲染 R 那一列的「已綁服務」column
- **THEN** 顯示兩個 ElTag,文字分別為 A.name 與 B.name

#### Scenario: 未綁服務顯示提醒

- **GIVEN** 資源 R 未被任何 RESOURCE 服務綁定
- **WHEN** 渲染 R 那一列
- **THEN** 「已綁服務」column 顯示「— 尚未綁定」(灰色文字)+ 小 hint「請在『服務』頁編輯 RESOURCE 服務時勾選此資源」

#### Scenario: 非 RESOURCE 服務不計入綁定

- **GIVEN** 服務 X 是 `bookingMode === 'TIME_SLOT'`,即使 schema 上未綁資源(不適用)
- **WHEN** 計算 R 的已綁服務
- **THEN** 不論 X 是否存在,只計入 `bookingMode === 'RESOURCE' && isActive` 的服務
