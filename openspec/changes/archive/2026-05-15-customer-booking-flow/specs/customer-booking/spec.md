# Capability：customer-booking

## ADDED Requirements

### Requirement: 顧客建立預約

The system SHALL allow customers to create appointments via public API without authentication, identifying themselves with a triplet (lastName, title, phone).

#### Scenario: 預約成功

- **Given** 商家 ACTIVE、服務 `bookingMode=TIME_SLOT`、目標 slot 仍有容量
- **When** 顧客 POST `/nuxt-api/public/appointment` 帶 `slug/serviceId/startAt/lastName/title/phone`
- **Then** 後端在事務內取 advisory lock、重檢容量、寫入 Appointment（status=CONFIRMED），回 `{ appointmentId, startAt, endAt }`

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

### Requirement: 顧客查詢預約

The system SHALL allow customers to look up their appointments using the triplet, with rate limiting and 7-day soft expiration filter.

#### Scenario: 三元組查詢

- **When** POST `/public/appointment/lookup` 帶三元組
- **Then** 回該商家當前 session 內所有符合三元組的預約，過濾掉 `startAt < now() - 7 days` 且 `status != CONFIRMED` 的

#### Scenario: RateLimit 觸發

- **When** 同 IP 1 分鐘內第 11 次查詢
- **Then** 回 429 + `Retry-After` header

#### Scenario: 多商家彙整

- **When** POST `/public/customer/lookup` 帶三元組 + 商家 slug 列表
- **Then** 回每商家 group，包含商家名、預約清單

### Requirement: 顧客取消預約

The system SHALL allow customers to cancel their own appointments, subject to merchant cancellation policy.

#### Scenario: 自由取消政策

- **Given** 商家 `cancelPolicy.mode = 'free'`
- **When** 顧客取消任一未來預約
- **Then** Appointment status=CANCELED、canceledBy=CUSTOMER、canceledAt=now()

#### Scenario: cutoff 政策卡關

- **Given** `cancelPolicy = { mode: 'cutoff', hoursBeforeCannotCancel: 2 }`、預約 startAt 在 1 小時後
- **When** 顧客取消
- **Then** 回 400 `MSG_CANCEL_TOO_LATE`

#### Scenario: 三元組不符

- **When** 顧客以錯誤三元組嘗試取消他人預約
- **Then** 回 404 `MSG_APPOINTMENT_NOT_FOUND`（不洩漏存在與否）

### Requirement: 商家管理預約

The system SHALL allow merchants to list, create, cancel, and archive-query appointments via authenticated API.

#### Scenario: 列表 filter

- **When** GET `/nuxt-api/appointment?dateFrom&dateTo&status&serviceId&resourceId`
- **Then** 回符合條件的 appointments（含關聯 service.name、resource.name）

#### Scenario: 商家代客預約

- **When** 商家 POST `/nuxt-api/appointment`
- **Then** 與顧客建預約相同流程，但不檢查 cancelPolicy；canceledBy 不寫；customer 三元組儲存

#### Scenario: 商家取消填理由

- **When** 商家 POST `/nuxt-api/appointment/[id]/cancel` 帶 `reason: '臨時休診'`
- **Then** Appointment status=CANCELED、canceledBy=MERCHANT、cancelReason='臨時休診'，顧客查詢時可看到此理由

#### Scenario: 商家取消不受 cutoff 限制

- **Given** cancelPolicy cutoff 已過
- **When** 商家取消
- **Then** 仍成功

#### Scenario: 歷史紀錄查詢

- **When** GET `/nuxt-api/appointment/archive?dateFrom&dateTo&customerPhone`
- **Then** 從 `AppointmentArchive` 表回傳

### Requirement: 顧客 Session 持久化

The frontend SHALL persist the customer triplet locally so subsequent visits skip the form, while never sending it to the server outside explicit booking/lookup actions.

#### Scenario: 再次造訪 my-bookings

- **Given** 上次預約已存三元組
- **When** 顧客造訪 `/m/{slug}/my-bookings`
- **Then** 自動以儲存的三元組查當前 slug 的預約

### Requirement: 步驟式預約流程

The booking page SHALL guide customers through Service → Resource? → Date → Slot → Triplet → Confirm steps with back navigation.

#### Scenario: 跳過 Resource 步驟

- **Given** 選的 Service `bookingMode != RESOURCE`
- **Then** 步驟器自動跳到 Date

#### Scenario: 回退重選

- **When** 在 Slot 步退回 Date
- **Then** 已選 slot 清空、Date 仍保留

#### Scenario: URL 帶 serviceId

- **When** 進入 `/m/{slug}/book?serviceId=xxx`
- **Then** Service 步預選且立即推進
