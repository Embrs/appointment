# auth-flow — Delta for improve-customer-page-nav

## MODIFIED Requirements

### Requirement: 認證頁面

系統 SHALL 提供三個 `default` layout 頁面，承載商家/管理員登入、商家註冊、忘記密碼流程。三個頁面（`/sign-in`、`/sign-up`、`/forgot-password`）SHALL 使用 `BizCustomerPageHeader` 渲染統一的「← 返回」入口；既有左欄手刻連結（`← 回首頁`、`返回登入`）SHALL 移除。

#### Scenario: 路由 /sign-in 預設商家版

- **GIVEN** 使用者打開 `/sign-in` 不帶 query
- **THEN** 頁面以「商家登入」標題渲染，並顯示「立即註冊」「忘記密碼」連結

#### Scenario: 路由 /sign-in?type=admin 切換管理員版

- **GIVEN** 使用者打開 `/sign-in?type=admin`
- **THEN** 頁面以「平台管理員登入」標題渲染，**不**顯示註冊連結

#### Scenario: 商家登入成功跳轉

- **GIVEN** 商家登入成功
- **WHEN** API 回傳 token
- **THEN** 前端 `StoreSelf.SetIdentity` 後跳轉到 `/admin`，cookie `ss_t` 已寫入

#### Scenario: 管理員登入成功跳轉

- **GIVEN** 管理員登入成功
- **THEN** 跳轉到 `/sys`，cookie `ss_t`、`ss_type='admin'` 已寫入

#### Scenario: 註冊頁顯示待審核

- **GIVEN** 使用者填寫合法表單於 `/sign-up`
- **WHEN** API 回傳 `pending: true`
- **THEN** 頁面切換為靜態「待管理員審核」訊息，提供「返回登入」按鈕；**不自動跳轉**、**不設置任何 cookie**

#### Scenario: 忘記密碼成功提示

- **GIVEN** 使用者填寫 email 於 `/forgot-password`
- **WHEN** API 回傳 `sent: true`
- **THEN** 頁面顯示「若帳號存在，將寄送重設連結」通用訊息

#### Scenario: /sign-in 與 /sign-up 頁首返回到站台首頁

- **GIVEN** 使用者進入 `/sign-in` 或 `/sign-up`
- **THEN** 頁面頂部以 `BizCustomerPageHeader` 渲染，左上顯示「← 返回」
- **WHEN** 點擊返回
- **THEN** 跳轉至 `/`（站台首頁），不依賴瀏覽器歷史

#### Scenario: /forgot-password 頁首返回到登入頁

- **GIVEN** 使用者進入 `/forgot-password`
- **THEN** 頁面頂部以 `BizCustomerPageHeader` 渲染，左上顯示「← 返回登入」（使用 `backLabel` 覆蓋預設文案）
- **WHEN** 點擊返回
- **THEN** 跳轉至 `/sign-in`
