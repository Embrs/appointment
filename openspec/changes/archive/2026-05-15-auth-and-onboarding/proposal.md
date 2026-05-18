## Why

Change 1（`setup-foundation`）已完成資料模型、`server/utils/auth.ts`（JWT 簽發/解析、bcrypt）、`server/utils/response.ts`（三語錯誤）、`StoreSelf` 多角色身分、`admin / merchant` 具名 middleware 與三套 layout 骨架。但目前仍**完全沒有任何認證 API、認證頁面、protocol 層 binding**，登入動作無從觸發，後續所有 changes（platform-admin-console、merchant-config、availability-engine、customer-booking-flow…）都需要先有可用的登入身分才能進行。

本 change 把商家與平台管理員的「註冊 → 審核 → 登入 → 取得自身資料 → 忘記密碼」這條認證主幹打通，並產出 `/sign-in`、`/sign-up`、`/forgot-password` 三個 default-layout 頁面。藍圖核心決策（商家自助註冊先進 `PENDING`，再由管理員審核）在這裡落地，但「管理員審核 UI」屬於 Change 3 範疇，本 change 僅實作「商家註冊後顯示『待管理員審核』提示，不直接登入」。

## What Changes

- **後端 API**：新增 `server/routes/nuxt-api/auth/` 四個端點
  - `sign-in.post.ts`：支援 `type: 'admin' | 'merchant'` 切換登入身份；管理員查 `AdminUser`，商家查 `MerchantUser`；商家需檢查 `Merchant.status === 'ACTIVE'`，PENDING/SUSPENDED/REJECTED 各回對應錯誤；驗證通過簽 JWT 並回傳身分資料
  - `sign-up.post.ts`：商家自助註冊；同 transaction 建立 `Merchant`（`status=PENDING`、`slug` 由 email 推導或隨機）與 `MerchantUser`（`role=OWNER`）；**不直接登入**，回傳成功標誌讓前端顯示待審核提示
  - `me.get.ts`：以當前 JWT 取自身資料（admin 查 AdminUser、merchant 查 MerchantUser + Merchant 商家名稱/status）；身分未授權 return 401
  - `forgot-password.post.ts`：MVP 不寄信，僅以 rate limit 防爆破並 return 通用成功訊息（不洩漏 email 是否存在）
- **JWT payload 規範**：沿用 Change 1 已定義 `{ sub, type: 'admin' | 'merchant', merchantId?, role? }`，本 change 是首個實際簽發使用者
- **Protocol 擴充**：`app/protocol/fetch-api/api/auth/` 新增/重構
  - 既有的 `SignIn / SignUp / ForgotPassword`（無 type 區分）替換為 `SignInAdmin / SignInMerchant / SignUpMerchant / MeInfo / ForgotPassword`
  - 補對應 type 定義、Mock（仍受 `NUXT_PUBLIC_TEST_MODE` 控制；本 change 將預設關掉 Mock 以走真實 API）
- **前端頁面**：
  - `app/pages/sign-in.vue`：用 `default` layout；由 `?type=merchant|admin` 切換登入身份（merchant 為預設）；商家版有「立即註冊」「忘記密碼」連結
  - `app/pages/sign-up.vue`：商家自助註冊表單；成功後顯示「待管理員審核」全頁訊息（提供「返回登入」按鈕，**不自動跳轉**）
  - `app/pages/forgot-password.vue`：填 email → 顯示通用成功提示
  - 三頁均用 Pug 模板、`UseVerify()` 驗證、Element Plus 表單；`ElInput` 必加 `maxlength`，密碼欄位 `show-password`，數字輸入加 `inputmode="numeric"`
- **Store 與 Mount**：`StoreSelf.SetIdentity` 已存在；本 change 在登入/me 成功後呼叫，不修改 store；登出沿用 `StoreSelf.SignOut()`
- **i18n**：補三語錯誤訊息 key（`auth.errors.*`、`auth.notice.*`）

### 非本 change 範圍（明確排除）

- 管理員審核 UI 與 API（屬 Change 3）
- 平台管理員代理登入（屬 Change 3）
- 商家後台主框架的 nav 內容（layout 已有殼，內容屬 Change 4）
- 顧客匿名身分流程（屬 Change 6）
- 真正的 email 寄送（MVP 無 Email 服務）
- OTP 驗證（schema 已預留，本 change 不接邏輯）

## Capabilities

### New Capabilities

- `auth-flow`：商家/管理員認證 API、JWT 流程、認證頁面與 protocol binding 的完整 spec

### Modified Capabilities

（無 — Change 1 的 `client-auth` spec 已涵蓋 store/middleware/401 行為；本 change 是接 API、補頁面，與既有 spec 不衝突）

## Impact

- **新增檔案**：`server/routes/nuxt-api/auth/{sign-in,sign-up,forgot-password}.post.ts`、`server/routes/nuxt-api/auth/me.get.ts`、`app/pages/{sign-in,sign-up,forgot-password}.vue`、`server/utils/validation.ts`（zod 共用工具，視需要）
- **修改檔案**：`app/protocol/fetch-api/api/auth/{index.ts,mock.ts,type.d.ts}`、`.env.dev`（將 `NUXT_PUBLIC_TEST_MODE` 改為 `F` 以走真實 API；保留切回 `T` 的 Mock 路徑）、`i18n/locales/{zh,en,ja}.js`
- **依賴**：無新增（bcrypt、jsonwebtoken、zod 在 Change 1 已安裝）
- **下游依賴**：Change 3（平台後台會用 `MeInfo` 與 admin token）、Change 4（商家後台會用 `MeInfo` 與 merchant token）、所有受保護 API 都依賴本 change 簽出的 JWT
