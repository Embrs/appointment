## MODIFIED Requirements

### Requirement: 顧客建立預約

The system SHALL allow customers to create appointments via public API without authentication, identifying themselves with a triplet (lastName, title, phone), and enforce a per-merchant active appointment limit per phone.

#### Scenario: 預約成功

- **Given** 商家 ACTIVE、服務 `bookingMode=TIME_SLOT`、目標 slot 仍有容量、該手機在本商家未來 CONFIRMED 預約 < `maxActiveAppointmentsPerCustomer`
- **When** 顧客 POST `/nuxt-api/public/appointment` 帶 `slug/serviceId/startAt/lastName/title/phone`
- **Then** 後端在事務內取 advisory lock、重檢容量、重檢上限、寫入 Appointment（status=CONFIRMED），回 `{ appointmentId, startAt, endAt }`

#### Scenario: 兩人同搶同 slot

- **Given** TIME_SLOT 容量 1、剩餘 1
- **When** 兩個 request 幾乎同時提交
- **Then** Advisory lock 序列化兩筆事務，後者重檢時 remaining=0，回 409 `MSG_SLOT_TAKEN`

#### Scenario: 過期 slot 拒絕

- **When** `startAt <= now()` 提交預約
- **Then** 回 400 `MSG_PAST_SLOT`

#### Scenario: RESOURCE 模式需資源

- **When** 服務 `bookingMode=RESOURCE` 但未帶 `resourceId`
- **Then** 回 400 `MSG_RESOURCE_REQUIRED`

#### Scenario: 達顧客預約上限拒絕

- **Given** 商家 `maxActiveAppointmentsPerCustomer=5`，該手機在本商家已有 5 筆未來 CONFIRMED 預約
- **When** 顧客 POST 第 6 筆預約
- **Then** 回 409 `MSG_BOOKING_LIMIT_EXCEEDED`，前端顯示「請取消舊預約後再試」並提供「我的預約」連結

#### Scenario: 上限只計未來 CONFIRMED

- **Given** 同手機在本商家有 10 筆預約：3 筆未來 CONFIRMED、4 筆過去 COMPLETED、2 筆 CANCELED、1 筆 NO_SHOW；商家上限 5
- **When** 顧客建第 4 筆未來 CONFIRMED
- **Then** count(未來 CONFIRMED)=3 < 5，成功

#### Scenario: 上限不影響其他商家

- **Given** 同手機在商家 A 已達上限 5
- **When** 該手機到商家 B 預約
- **Then** 不受影響（檢查鍵含 merchantId）

#### Scenario: 手機正規化前後等價

- **Given** 同手機輸入 `0912-345-678` 與 `0912 345 678` 與 `0912345678`
- **When** 連續預約
- **Then** 三筆都計入同一手機的 count（`normalizePhone` 去掉空白與連字號）

#### Scenario: 商家代客預約不受限

- **Given** 商家 A 已達顧客上限
- **When** 商家後台 POST `/nuxt-api/appointment` 代客預約
- **Then** 略過上限檢查，成功建立

#### Scenario: 商家未設定上限取 default 5

- **Given** 既有商家從未調整過上限欄位
- **When** 顧客建第 6 筆未來 CONFIRMED 預約
- **Then** 用 default 5 → 第 6 筆被拒
