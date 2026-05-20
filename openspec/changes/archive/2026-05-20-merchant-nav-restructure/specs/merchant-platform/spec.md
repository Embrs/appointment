## MODIFIED Requirements

### Requirement: 商家後台配置頁面

系統 SHALL 提供 `back-desk` layout + `merchant` middleware 保護的商家後台頁面;sidebar 導覽 SHALL 以三個語意分群呈現:「營運」、「排班」、「設定」。「排班」分群下的 `/admin/schedule` SHALL 為四 tab 容器頁,內含「每週時段」、「單日調整」、「公休日」、「領號時間」四個 tab。原 `/admin/holidays` 與 `/admin/queue-window` SHALL 保留為 redirect 路由。

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
- **THEN** 渲染表格 + 新增 / 編輯彈窗

#### Scenario: 排班 /admin/schedule 預設 tab

- **WHEN** 訪 `/admin/schedule` 不帶 query
- **THEN** 渲染四 tab 容器,預設啟用「每週時段」tab(`tab=weekly`),並在 URL `router.replace` 為 `/admin/schedule?tab=weekly`

#### Scenario: 排班 tab 切換同步 query

- **GIVEN** 已在 `/admin/schedule?tab=weekly`
- **WHEN** 使用者點擊「公休日」tab
- **THEN** 切換顯示對應 panel,URL 經 `router.replace` 更新為 `/admin/schedule?tab=holidays`(不堆 history)

#### Scenario: 排班 tab query 不合法

- **WHEN** 訪 `/admin/schedule?tab=foo`
- **THEN** fallback 至 `weekly` tab,URL replace 為 `/admin/schedule?tab=weekly`

#### Scenario: 每週時段 tab 內容

- **WHEN** 啟用 `tab=weekly`
- **THEN** 渲染 scope 切換(MERCHANT / 各 RESOURCE) + SchedulerWeeklyEditor;副標顯示「設定每週固定營業時段。若有單日臨時變動請切換到『單日調整』tab」

#### Scenario: 單日調整 tab 內容

- **WHEN** 啟用 `tab=overrides`
- **THEN** 渲染特定日期覆寫清單 + 新增/編輯/刪除操作;tab 標題顯示為「單日調整」(原稱「特定日期覆寫」);副標顯示「設定某一天和平常不一樣的時段或休息。整店全日休請改用『公休日』tab」

#### Scenario: 公休日 tab 內容

- **WHEN** 啟用 `tab=holidays`
- **THEN** 渲染整店休假日清單 + 年份切換 + 新增彈窗;tab 標題顯示為「公休日」(原稱「休假」);副標顯示「整店休息日,會在顧客訂位頁顯示假日名稱。如果只是某天提早收或某資源請假,請改用『單日調整』tab」

#### Scenario: 領號時間 tab 內容

- **WHEN** 啟用 `tab=queue-window`
- **THEN** 渲染服務選擇器 + 每週 7 天領號窗編輯(startTime/endTime/maxTickets/isActive);tab 標題顯示為「領號時間」(原稱「領號時間設定」)

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
