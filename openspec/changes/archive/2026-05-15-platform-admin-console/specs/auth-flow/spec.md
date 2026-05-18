# Auth Flow Spec（Modified by platform-admin-console）

## MODIFIED Requirements

### Requirement: Me 自身資訊查詢

系統 SHALL 提供 `GET /nuxt-api/auth/me`，以 Authorization Bearer JWT 識別當前身分，回傳所需顯示欄位；若為代理 token 則於 merchant 分支額外帶回 `impersonatedBy`。

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

#### Scenario: 無 token 或 token 失效

- **WHEN** 缺 Authorization header / token 過期 / 簽章錯
- **THEN** 響應 401

## ADDED Requirements

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
