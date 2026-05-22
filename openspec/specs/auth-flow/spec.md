# auth-flow Specification

## Purpose
TBD - created by archiving change auth-and-onboarding. Update Purpose after archive.
## Requirements
### Requirement: Sign-in 同端點雙身分

系統 SHALL 在 `POST /nuxt-api/auth/sign-in` 接受 `{ type: 'admin' | 'merchant', email, password }`，以 `type` 切換身分；回傳統一響應格式並在成功時簽發 JWT。

#### Scenario: 商家成員以正確帳密登入

- **GIVEN** 一個 `MerchantUser`（isActive=true、deletedAt=null）所屬 `Merchant.status='ACTIVE'`、`deletedAt=null`
- **WHEN** 呼叫 `POST /nuxt-api/auth/sign-in` body `{ type:'merchant', email, password }`
- **THEN** 響應 200，`data` 含 `token`（HS256 JWT，payload `{ type:'merchant', sub:MerchantUser.id, merchantId, role }`）、`type='merchant'`、`role`、`merchantId`、`userName`、`userEmail`

#### Scenario: 商家所屬 Merchant 為 PENDING

- **GIVEN** `MerchantUser` 帳密正確，但所屬 `Merchant.status='PENDING'`
- **WHEN** 呼叫 sign-in
- **THEN** 響應 403，`status.message` 三語為「帳號待管理員審核 / Pending admin review / 管理者の審査待ち」

#### Scenario: 商家所屬 Merchant 為 SUSPENDED

- **GIVEN** `Merchant.status='SUSPENDED'` 或 `deletedAt` 非 null
- **WHEN** 呼叫 sign-in
- **THEN** 響應 403，三語訊息對應「商家已停用」

#### Scenario: 商家所屬 Merchant 為 REJECTED

- **GIVEN** `Merchant.status='REJECTED'`
- **WHEN** 呼叫 sign-in
- **THEN** 響應 403，三語訊息對應「註冊申請未通過」

#### Scenario: 平台管理員以正確帳密登入

- **GIVEN** `AdminUser`（isActive=true、deletedAt=null）
- **WHEN** body `{ type:'admin', email, password }`
- **THEN** 響應 200，JWT payload `{ type:'admin', sub:AdminUser.id }`（無 merchantId / role）

#### Scenario: 帳密錯誤統一回應

- **GIVEN** 任何 type 下密碼錯誤、帳號不存在、isActive=false 任一情形
- **WHEN** 呼叫 sign-in
- **THEN** 響應 401，三語訊息對應「帳號或密碼錯誤」（不可洩漏哪一項錯）

#### Scenario: 請求格式錯誤

- **WHEN** 缺欄位 / 格式不對 / type 不在白名單
- **THEN** 響應 400 `badRequestError`

### Requirement: Sign-up 商家自助註冊

系統 SHALL 在 `POST /nuxt-api/auth/sign-up` 同 transaction 內建立 `Merchant`（status=PENDING）與 `MerchantUser`（role=OWNER），且**不簽發 JWT、不設置 cookie**。

#### Scenario: 全新 email 註冊成功

- **GIVEN** Email 在所有 `MerchantUser` 中不存在
- **WHEN** body `{ email, password, merchantName }`
- **THEN** 響應 200，`data = { pending: true }`；DB 內：
  - `Merchant` 新增一筆 `status=PENDING`、`slug` 形如 `^[a-z0-9-]+$`
  - `MerchantUser` 新增一筆 `role=OWNER`、`passwordHash` 為 bcrypt
  - 兩筆同 `merchantId` 串接

#### Scenario: Email 已被註冊

- **GIVEN** 已存在同 email 的 `MerchantUser`
- **WHEN** 呼叫 sign-up
- **THEN** 響應 409，三語訊息對應「Email 已註冊」

#### Scenario: 密碼強度不足

- **WHEN** password 少於 8 碼、或不含字母+數字
- **THEN** 響應 400，提示密碼規則

#### Scenario: Slug 唯一性

- **GIVEN** 自動產生的 slug 在 DB 已存在
- **WHEN** 重試最多 3 次仍衝突
- **THEN** 響應 500 / 重新隨機；本 spec 不強制錯誤碼，僅要求最終 slug `@unique` 不違反

### Requirement: Me 自身資訊查詢

系統 SHALL 提供 `GET /nuxt-api/auth/me`，以 Authorization Bearer JWT 識別當前身分，回傳所需顯示欄位；若為代理 token 則於 merchant 分支額外帶回 `impersonatedBy`。當 JWT 解開後實際對應的 `MerchantUser` / `Merchant` / `AdminUser` 在資料庫已不存在（含軟刪除）或 Merchant 已 SUSPENDED/REJECTED 時，系統 SHALL 回 401 而非 404，使前端 401 自動清身分機制接管。

#### Scenario: Admin 取得自身資訊

- **GIVEN** 有效 admin JWT
- **WHEN** 呼叫 me
- **THEN** 響應 200，`data` 含 `{ type:'admin', userName, userEmail }`，**不**含 impersonatedBy

#### Scenario: 一般 Merchant 取得自身資訊

- **GIVEN** 有效 merchant JWT（一般登入，payload 無 impersonatedBy）且所屬 Merchant.status=ACTIVE
- **WHEN** 呼叫 me
- **THEN** 響應 200，`data` 含 `{ type:'merchant', userName, userEmail, merchantId, merchantName, role }`，**不**含 impersonatedBy 或值為 undefined

#### Scenario: 代理 Merchant 取得自身資訊

- **GIVEN** 有效 merchant JWT（透過 impersonate 簽出，payload.impersonatedBy=adminId）
- **WHEN** 呼叫 me
- **THEN** 響應 200，`data` 含 `{ type:'merchant', userName, userEmail, merchantId, merchantName, role:'OWNER', impersonatedBy: adminId }`

#### Scenario: Merchant 在會話期間被停用

- **GIVEN** 有效 merchant JWT 但 Merchant.status 變為非 ACTIVE 或 MerchantUser.isActive=false
- **WHEN** 呼叫 me
- **THEN** 響應 401，前端 401 自動跳轉機制觸發登出

#### Scenario: Merchant 在資料庫已不存在（reseed / 軟刪除 / 部署遷移後 ID 換新）

- **GIVEN** 有效 merchant JWT，但 payload.merchantId 對應的 `Merchant` 已不存在或 `deletedAt` 非 null
- **WHEN** 呼叫 me
- **THEN** 響應 401，三語訊息對應「會話已失效，請重新登入 / Session expired, please sign in again / セッションが失効しました。再度ログインしてください」；**不**回 404

#### Scenario: AdminUser 在資料庫已不存在

- **GIVEN** 有效 admin JWT，但 payload.sub 對應的 `AdminUser` 已不存在或 `deletedAt` 非 null 或 `isActive=false`
- **WHEN** 呼叫 me
- **THEN** 響應 401，訊息同上「會話已失效」三語

#### Scenario: 無 token 或 token 失效

- **WHEN** 缺 Authorization header / token 過期 / 簽章錯
- **THEN** 響應 401

### Requirement: JWT 守衛資料庫存在性驗證

`server/utils/auth.ts` 的 `requireMerchant` / `requireAdmin` 守衛 SHALL 在 JWT 簽章驗證通過後，額外查 Prisma 確認 token payload 對應的身分主體（Merchant + MerchantUser，或 AdminUser）在資料庫仍存在且有效；若不存在或已停用，SHALL 直接從守衛回 401，使受保護端點不得進入業務邏輯。

#### Scenario: requireMerchant 攔截 Merchant 不存在

- **GIVEN** 攜帶有效簽章 merchant JWT 的請求，但 payload.merchantId 在資料庫不存在
- **WHEN** 呼叫任一掛 `requireMerchant` 的端點（如 `GET /nuxt-api/merchant`、`GET /nuxt-api/service`、`GET /nuxt-api/resource`、`GET /nuxt-api/appointment`）
- **THEN** 守衛回 401（`status.code=401`），三語訊息對應「會話已失效，請重新登入」；**不**進入端點 handler、**不**回 404

#### Scenario: requireMerchant 攔截 MerchantUser 不存在或停用

- **GIVEN** 攜帶 merchant JWT，merchantId 存在但 payload.sub 對應的 MerchantUser 已刪除或 `isActive=false`
- **WHEN** 呼叫任一掛 `requireMerchant` 的端點
- **THEN** 守衛回 401

#### Scenario: requireMerchant 攔截 Merchant 非 ACTIVE

- **GIVEN** merchant JWT 對應的 Merchant.status 為 SUSPENDED / REJECTED 或 deletedAt 非 null
- **WHEN** 呼叫任一掛 `requireMerchant` 的端點
- **THEN** 守衛回 401

#### Scenario: requireAdmin 攔截 AdminUser 不存在

- **GIVEN** 攜帶有效 admin JWT，但 payload.sub 對應的 AdminUser 已刪除或 `isActive=false`
- **WHEN** 呼叫任一掛 `requireAdmin` 的端點（如 `GET /nuxt-api/sys/*`）
- **THEN** 守衛回 401

#### Scenario: 守衛保留現有 401 行為

- **WHEN** token 缺失 / 過期 / 簽章錯 / type 與守衛不符 / role 不足
- **THEN** 仍回 401（與既有行為一致），訊息保留既有「未授權」三語

#### Scenario: 業務端點「找不到子資源」維持 404

- **GIVEN** 已通過 requireMerchant、merchant 存在
- **WHEN** 呼叫 `GET /nuxt-api/service/[id]` 但該 service id 不存在或不屬於當前商家
- **THEN** 仍回 404；本變更**不**影響子資源 not-found 的狀態碼

### Requirement: 商家/管理員 middleware 進站 me 預檢

`app/middleware/merchant.ts` 與 `app/middleware/admin.ts` SHALL 改為 async，在進入受保護路由前先呼叫 `GET /nuxt-api/auth/me` 驗證 session；預檢失敗時 SHALL 清空所有身分 cookie 並導向對應的登入頁，避免使用者在過期/失效 session 下進入後台看到滿屏 404。

#### Scenario: 商家 middleware 預檢通過

- **GIVEN** 使用者 cookie 內有有效 `ss_t`，me 回 200
- **WHEN** 進入 `/admin/*` 任一頁
- **THEN** middleware 放行；頁面正常渲染

#### Scenario: 商家 middleware 預檢失敗 — token 已失效

- **GIVEN** cookie 內 `ss_t` 存在但 me 回 401（含 reseed 後 merchantId 不存在情境）
- **WHEN** 進入 `/admin` 或其子頁
- **THEN** middleware 清空 `ss_t` / `ss_mid` / `ss_type` 後 `navigateTo` 至 `/sign-in`；**不**讓使用者看到 admin 內容
- **AND** 不會發出後續 admin API 請求（避免錯誤地把過期 token 再帶一次）

#### Scenario: 商家 middleware 無 cookie 直接導回

- **GIVEN** cookie 無 `ss_t` 或 `ss_type !== 'merchant'`
- **WHEN** 進入 `/admin/*`
- **THEN** middleware 直接 `navigateTo('/sign-in')`，**不**呼叫 me（節省一次往返）

#### Scenario: 管理員 middleware 預檢失敗

- **GIVEN** cookie 內 `ss_t` 存在且 `ss_type='admin'`，但 me 回 401
- **WHEN** 進入 `/sys/*`
- **THEN** 清空身分 cookie，`navigateTo('/sign-in?type=admin')`

#### Scenario: SSR 場景 me 預檢

- **GIVEN** Nuxt SSR 啟用且 middleware 於 server 端執行
- **WHEN** 進入 `/admin/*`
- **THEN** middleware SHALL 使用 server-side fetch 帶上 cookie 呼叫 me；預檢結果與 client 行為一致

### Requirement: 前端 401 全域清身分行為

`app/protocol/fetch-api/methods.ts` 的 `onResponseError` 在收到 401 時 SHALL 完整清除 `StoreSelf` 管理的所有身分 cookie（`ss_t`、`ss_mid`、`ss_type`，以及未來追加的同類），然後導向 `/sign-in`；不可只清部分欄位導致 `isSignIn` 與實際 token 狀態不一致。

#### Scenario: 任何受保護 API 回 401

- **GIVEN** 使用者已登入，但 token 失效（reseed、過期或被撤銷）
- **WHEN** 任一 `/nuxt-api/*` API 回 401
- **THEN** `onResponseError`（或對應 `HandleUnauthorized`）SHALL 同時清 `ss_t`、`ss_mid`、`ss_type`；後續 `StoreSelf.isSignIn === false`
- **AND** 自動 `navigateTo('/sign-in')`（merchant）或 `/sign-in?type=admin`（admin）

#### Scenario: 4xx 非 401 不清身分

- **GIVEN** 使用者已登入
- **WHEN** API 回 400 / 403 / 404 / 409
- **THEN** **不**清身分 cookie；錯誤照常透過業務層處理（如 ElMessage 提示）

#### Scenario: 並發多支 API 同時 401

- **GIVEN** 進站時並發呼叫多支 API，全部回 401
- **WHEN** 第一個 401 觸發清身分 + redirect
- **THEN** 後續 401 不再重複 navigate（透過 `StoreSelf.isSignIn` 或 redirect lock 避免閃跳）

### Requirement: 代理 JWT 生命週期與限制

系統 SHALL 為「平台管理員代理進入商家」所簽發的 JWT 加上 30 分鐘 TTL 與 `impersonatedBy` 欄位，且代理身分不可再代理。

#### Scenario: 代理 JWT TTL 為 30 分鐘

- **WHEN** Admin 呼叫 `POST /nuxt-api/sys/merchant/[id]/impersonate` 成功
- **THEN** 回傳 token 的 `exp - iat` 等於 30 分鐘（1800 秒）

#### Scenario: 代理 JWT payload 必含 impersonatedBy

- **WHEN** 代理 token 被解析
- **THEN** payload 含 `{ type:'merchant', sub, merchantId, role:'OWNER', impersonatedBy: <admin id> }`

#### Scenario: 拒絕代理鏈

- **GIVEN** 來源 JWT 為代理 token（type='merchant' 且 payload.impersonatedBy 已有值）
- **WHEN** 攜帶該 token 呼叫 `POST /nuxt-api/sys/merchant/[id]/impersonate`
- **THEN** 響應為錯誤（401 或 403），實際由 `requireAdmin` 攔下；端點額外保留 `impersonatedBy` 檢查作為第二道防線（如未來改放寬 admin 身分判斷時仍可擋住代理 token 自我代理）

#### Scenario: 代理 token 過期後行為

- **GIVEN** 代理 token 已過期（簽發時間 > 30 分鐘前）
- **WHEN** 攜帶該 token 呼叫任一受保護 API
- **THEN** 響應 401，前端 401 自動處理機制清除身分並跳轉登入頁

### Requirement: Forgot password 通用入口

系統 SHALL 提供 `POST /nuxt-api/auth/forgot-password`，以通用成功響應避免 email 列舉，並對 IP 套用速率限制。

#### Scenario: 正常請求

- **WHEN** body `{ email }`，IP 10 分鐘內請求次數 < 5
- **THEN** 響應 200，`data = { sent: true }`，不論 email 是否存在

#### Scenario: 達到速率上限

- **GIVEN** 同 IP 10 分鐘內已請求 5 次
- **WHEN** 第 6 次請求
- **THEN** 響應 429，三語訊息對應「請求過於頻繁」

#### Scenario: 格式錯誤

- **WHEN** email 非合法格式或缺欄位
- **THEN** 響應 400

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

### Requirement: 前端 API binding

`app/protocol/fetch-api/api/auth/` SHALL 對外暴露 `SignInAdmin / SignInMerchant / SignUpMerchant / MeInfo / ForgotPassword`，且各方法在 `NUXT_PUBLIC_TEST_MODE='T'` 時走 mock.ts。

#### Scenario: 真實模式打 server

- **GIVEN** `NUXT_PUBLIC_TEST_MODE='F'`
- **WHEN** 呼叫 `SignInMerchant`
- **THEN** 向 `/nuxt-api/auth/sign-in` 發 POST，request body 含 `type:'merchant'`

#### Scenario: Mock 模式跳過 server

- **GIVEN** `NUXT_PUBLIC_TEST_MODE='T'`
- **WHEN** 呼叫 `SignInMerchant`
- **THEN** 不發 HTTP 請求，直接回 mock res（含固定 token）

### Requirement: 商家 OWNER 與 STAFF 操作邊界

系統 SHALL 限制 STAFF 不可進行員工管理、商家設定（含 logo / cover 上傳）、商家帳務操作；OWNER 為當前商家內最高權限。

#### Scenario: STAFF 嘗試員工管理 API

- **GIVEN** 已登入商家成員 role='STAFF'
- **WHEN** 呼叫 `POST /nuxt-api/merchant/staff` 或 `PUT /nuxt-api/merchant/staff/[id]` 或 `POST /nuxt-api/merchant/staff/[id]/toggle-active`
- **THEN** 響應 401（`requireMerchant({ role: 'OWNER' })` 攔截）

#### Scenario: STAFF 嘗試商家設定 API

- **GIVEN** 已登入商家成員 role='STAFF'
- **WHEN** 呼叫 `PUT /nuxt-api/merchant/[id]`
- **THEN** 響應 401

#### Scenario: STAFF 可操作服務 / 資源 / 時段 / 休假

- **GIVEN** 已登入商家成員 role='STAFF'
- **WHEN** 呼叫 `POST /nuxt-api/service` 等服務 / 資源 / 時段 / 休假端點
- **THEN** 響應 200（允許）

#### Scenario: 前端 nav 對 STAFF 隱藏 OWNER-only 連結

- **GIVEN** 已登入 STAFF
- **WHEN** 渲染 back-desk layout
- **THEN** nav 不顯示「商家設定」「員工」連結（透過 `StoreSelf.HasRule('merchant.staff.manage')` 與 `merchant.settings.update` 判斷）

