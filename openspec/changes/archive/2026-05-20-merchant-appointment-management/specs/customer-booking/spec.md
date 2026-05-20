## MODIFIED Requirements

### Requirement: 商家管理預約

The system SHALL allow merchants to list, create, cancel, mark-complete, mark-no-show, and archive-query appointments via authenticated API.

#### Scenario: 列表 filter

- **WHEN** GET `/nuxt-api/appointment?dateFrom&dateTo&status&serviceId&resourceId`
- **Then** 回符合條件的 appointments（含關聯 service.name、resource.name）

#### Scenario: 商家代客預約

- **WHEN** 商家 POST `/nuxt-api/appointment`
- **Then** 與顧客建預約相同流程，但不檢查 cancelPolicy；canceledBy 不寫；customer 三元組儲存

#### Scenario: 商家取消填理由

- **WHEN** 商家 POST `/nuxt-api/appointment/[id]/cancel` 帶 `reason: '臨時休診'`
- **Then** Appointment status=CANCELED、canceledBy=MERCHANT、cancelReason='臨時休診'，顧客查詢時可看到此理由

#### Scenario: 商家取消不受 cutoff 限制

- **Given** cancelPolicy cutoff 已過
- **WHEN** 商家取消
- **Then** 仍成功

#### Scenario: 歷史紀錄查詢

- **WHEN** GET `/nuxt-api/appointment/archive?dateFrom&dateTo&customerPhone`
- **Then** 從 `AppointmentArchive` 表回傳

#### Scenario: 商家標記完成

- **GIVEN** 預約 status=CONFIRMED、startAt 已過
- **WHEN** 商家 POST `/nuxt-api/appointment/[id]/complete`
- **THEN** status 變更為 COMPLETED；不改 canceledBy、不寫 cancelReason；updatedAt 自動更新

#### Scenario: 商家標記未到

- **GIVEN** 預約 status=CONFIRMED、startAt 已過
- **WHEN** 商家 POST `/nuxt-api/appointment/[id]/no-show`
- **THEN** status 變更為 NO_SHOW；不改 canceledBy、不寫 cancelReason

#### Scenario: 狀態流轉合法性

- **GIVEN** 預約 status 不為 CONFIRMED（已 CANCELED / COMPLETED / NO_SHOW）
- **WHEN** 商家嘗試 complete 或 no-show
- **THEN** 回 400 `MSG_APPOINTMENT_NOT_CONFIRMED`

#### Scenario: 時間前置條件

- **GIVEN** 預約 startAt 在未來
- **WHEN** 商家嘗試 complete 或 no-show
- **THEN** 回 400 `MSG_APPOINTMENT_NOT_YET_STARTED`
