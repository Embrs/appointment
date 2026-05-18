## ADDED Requirements

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
