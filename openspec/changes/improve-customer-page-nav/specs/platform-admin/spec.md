# platform-admin — Delta for improve-customer-page-nav

## MODIFIED Requirements

### Requirement: 平台後台頁面

系統 SHALL 提供五個 `back-desk` layout + `admin` middleware 保護的頁面。二級詳情頁 SHALL 透過擴充後的 `BizPageHeader` 的 `backTo` props 提供回到列表頁的入口；本變更先套用於 `/sys/merchants/[id]`。

#### Scenario: Dashboard 路由 /sys

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys`
- **THEN** 渲染 dashboard，顯示 PENDING 數、ACTIVE 數、Admin 數，以及最近 5 筆商家連結

#### Scenario: 商家列表路由 /sys/merchants

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys/merchants`
- **THEN** 顯示 tabs（ALL/PENDING/ACTIVE/SUSPENDED/REJECTED）+ 搜尋框 + 表格 + 分頁
- **AND** URL 同步 `?status & ?keyword & ?page`

#### Scenario: 商家詳情路由 /sys/merchants/[id]

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys/merchants/[id]`
- **THEN** 顯示商家欄位、OWNER 摘要、編輯表單、依當前狀態的操作按鈕
- **AND** 頁首 `BizPageHeader` 設定 `backTo='/sys/merchants'`，提供「← 返回」入口

#### Scenario: Admin 列表路由 /sys/admins

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys/admins`
- **THEN** 顯示 admin 表格、新增 / 編輯 / 啟用切換按鈕

#### Scenario: 代理進入中介頁 /sys/impersonate/[merchantId]

- **GIVEN** Admin 已登入
- **WHEN** 訪 `/sys/impersonate/[merchantId]`
- **THEN** 頁面顯示 loading「正在進入商家後台...」
- **AND** 背景呼叫 impersonate API；成功後寫入 ss_back_* cookie 備份 admin 身分、覆寫 ss_t 為 merchant token、navigateTo `/admin`
- **AND** 失敗則 `ElMessage.error` 並 3 秒後返回 `/sys/merchants`

#### Scenario: 非 admin 訪 /sys/*

- **GIVEN** 未登入或 selfType !== 'admin'
- **WHEN** 訪任一 /sys/* 頁面
- **THEN** middleware 跳轉到 `/sys/sign-in`

#### Scenario: 商家詳情頁返回入口

- **GIVEN** Admin 已登入並進入 `/sys/merchants/[id]`
- **WHEN** 點擊頁首左上的「← 返回」
- **THEN** `navigateTo('/sys/merchants')`，回到列表頁並保留列表頁原有的 URL query（若有）由瀏覽器歷史機制處理
- **AND** 行為不依賴 `router.back()`
