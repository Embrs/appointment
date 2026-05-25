## MODIFIED Requirements

### Requirement: 商家自身資訊讀寫

系統 SHALL 提供商家讀取與修改**自己**的商家資訊端點，所有操作以 `auth.merchantId` 為唯一 tenancy 依據，不允許跨商家。

對於 `PUT /nuxt-api/merchant/[id]` 的可空字串欄位（`description`、`logoUrl`、`coverUrl`、`contactPhone`、`contactEmail`、`address`），系統 SHALL 將空字串 `""` 視為與 `null` 等價、最終皆寫入 DB 為 `null`，且 SHALL NOT 因此觸發格式驗證失敗（例如 `contactEmail=""` 不得被 `email` 規則拒絕）。非空字串仍須通過原有的 trim / max / email / regex 驗證。

#### Scenario: 取得自身商家

- **GIVEN** 已登入商家
- **WHEN** `GET /nuxt-api/merchant`
- **THEN** 響應 200，`data.merchant` 含完整欄位（id、slug、name、description、logoUrl、coverUrl、cancelPolicy、contactPhone、contactEmail、timezone、address、status、createdAt、updatedAt、**maxActiveAppointmentsPerCustomer**）

#### Scenario: 修改自身商家

- **GIVEN** 已登入商家、`id === auth.merchantId`
- **WHEN** `PUT /nuxt-api/merchant/[id]` body 含 `{ name?, slug?, description?, logoUrl?, coverUrl?, contactPhone?, contactEmail?, timezone?, address?, cancelPolicy?, maxActiveAppointmentsPerCustomer? }`
- **THEN** 響應 200，DB 同步更新；cancelPolicy 與既有 Json 合併（保留未提及 key）

#### Scenario: 嘗試修改他人商家

- **GIVEN** 已登入商家
- **WHEN** `PUT /nuxt-api/merchant/[id]` 但 `id !== auth.merchantId`
- **THEN** 響應 403

#### Scenario: slug 衝突

- **WHEN** 新 slug 已被其他商家使用
- **THEN** 響應 409，三語訊息「網址已被使用」

#### Scenario: cancelPolicy 結構驗證

- **WHEN** body `cancelPolicy = { mode: 'cutoff', hoursBeforeCannotCancel: 24 }`
- **THEN** 響應 200；mode='cutoff' 時 hoursBeforeCannotCancel 必為整數 1–168

#### Scenario: cancelPolicy 結構錯誤

- **WHEN** `cancelPolicy.mode='cutoff'` 但 `hoursBeforeCannotCancel` 缺失或 < 1
- **THEN** 響應 400

#### Scenario: 預約上限欄位範圍驗證

- **WHEN** body `maxActiveAppointmentsPerCustomer = 5`
- **THEN** 響應 200；DB 更新

#### Scenario: 預約上限範圍錯誤

- **WHEN** body `maxActiveAppointmentsPerCustomer = 0` 或 `100` 或 `3.5` 或 `'abc'`
- **THEN** 響應 400（Zod 驗證失敗：必須是 1–99 的整數）

#### Scenario: 可空字串欄位以空字串送出視為清空

- **GIVEN** 已登入商家、`id === auth.merchantId`
- **WHEN** `PUT /nuxt-api/merchant/[id]` body 含 `{ contactEmail: '', contactPhone: '', description: '', logoUrl: '', coverUrl: '', address: '' }`
- **THEN** 響應 200；DB 對應六個欄位皆更新為 `null`；後續 `GET /nuxt-api/merchant` 回傳這六個欄位為 `null`

#### Scenario: 啟用 Provider Mode 時不被空字串欄位連帶 400

- **GIVEN** 已登入商家、商家其他欄位多為未填寫狀態
- **WHEN** `PUT /nuxt-api/merchant/[id]` body 含 `{ providerModeEnabled: true, providerLabel: { zh: '醫師' }, contactEmail: '', contactPhone: '', logoUrl: '', coverUrl: '', address: '', description: '' }`
- **THEN** 響應 200；`providerModeEnabled=true` 寫入；`providerLabel.zh='醫師'` 與既有 JSON 合併

#### Scenario: 非法 email 仍須拒絕

- **GIVEN** 已登入商家、`id === auth.merchantId`
- **WHEN** `PUT /nuxt-api/merchant/[id]` body 含 `{ contactEmail: 'not-an-email' }`
- **THEN** 響應 400（Zod 驗證失敗：非空字串時須符合 email 格式）

#### Scenario: 超過 max 長度的字串仍須拒絕

- **GIVEN** 已登入商家、`id === auth.merchantId`
- **WHEN** `PUT /nuxt-api/merchant/[id]` body 含 `{ description: '<長度 > 1000 字串> }`
- **THEN** 響應 400（Zod 驗證失敗：超過 max(1000)）
