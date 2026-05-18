## ADDED Requirements

### Requirement: 公開商家資訊查詢

系統 SHALL 提供無需 token 的公開端點，回傳指定 slug 商家的公開資訊與啟用中的服務 / 資源清單，並對 IP 套 5/秒固定窗口速率限制。

#### Scenario: 取得公開商家資訊

- **GIVEN** Merchant slug=`test`、status=ACTIVE、deletedAt=null
- **WHEN** 任意客戶端（無 Authorization header）發送 `GET /nuxt-api/public/m/test`
- **THEN** 響應 200，`data.merchant` 含 `{ slug, name, description, logoUrl, coverUrl, timezone, address, contactPhone, contactEmail, cancelPolicy: { mode, hoursBeforeCannotCancel? } }`
- **AND** `data.services` 為 `isActive=true` 且 `deletedAt=null` 的 Service 列表，欄位含 `{ id, name, description, bookingMode, durationMinutes, slotIntervalMinutes, capacityPerSlot, priceCents, resourceIds }`
- **AND** `data.resources` 為 `isActive=true` 且 `deletedAt=null` 的 Resource 列表，欄位含 `{ id, name, description }`

#### Scenario: 不存在的 slug

- **WHEN** `GET /nuxt-api/public/m/not-exist`
- **THEN** 響應 404，三語訊息

#### Scenario: PENDING 商家不可被查

- **GIVEN** Merchant slug=`pending-shop`、status=PENDING
- **WHEN** `GET /nuxt-api/public/m/pending-shop`
- **THEN** 響應 404

#### Scenario: SUSPENDED 商家不可被查

- **GIVEN** Merchant slug=`suspended-shop`、status=SUSPENDED
- **WHEN** `GET /nuxt-api/public/m/suspended-shop`
- **THEN** 響應 404

#### Scenario: 軟刪除商家不可被查

- **GIVEN** Merchant slug=`gone`、deletedAt 非空
- **WHEN** `GET /nuxt-api/public/m/gone`
- **THEN** 響應 404

#### Scenario: 過濾未啟用 / 軟刪除的服務與資源

- **GIVEN** Merchant 有 5 個 Service（其中 2 個 isActive=false，1 個 deletedAt 非空）
- **WHEN** `GET /nuxt-api/public/m/test`
- **THEN** `data.services` 僅包含 isActive=true 且 deletedAt=null 的 2 個

#### Scenario: cancelPolicy 只洩漏白名單欄位

- **GIVEN** Merchant.cancelPolicy = `{ mode: 'cutoff', hoursBeforeCannotCancel: 24, rejectReason: 'private note', internalFlag: true }`
- **WHEN** `GET /nuxt-api/public/m/test`
- **THEN** `data.merchant.cancelPolicy` 只含 `{ mode, hoursBeforeCannotCancel }`，**不**含 `rejectReason / internalFlag` 等其他 key

#### Scenario: IP 速率限制

- **GIVEN** 同一 IP 在 1 秒內已成功呼叫 5 次 `GET /nuxt-api/public/m/test`
- **WHEN** 第 6 次同秒內呼叫
- **THEN** 響應 429，含 `Retry-After` header（值 ≥ 1）

### Requirement: 可預約時段查詢

系統 SHALL 提供無需 token 的可預約時段查詢端點，給定 `(slug, serviceId, resourceId?, date)`，依商家時區計算當日所有 slot 並回剩餘容量；對 IP 套 5/秒固定窗口速率限制。

#### Scenario: 一般工作日 TIME_SLOT 切 slot

- **GIVEN** Service `s1`（bookingMode=TIME_SLOT、durationMinutes=60、slotIntervalMinutes=30）；ScheduleRule scope=MERCHANT、weekday=1（週一）、09:00–12:00；date=2026-05-18（週一）；無預約、無休假、無 override；Merchant.timezone=`Asia/Taipei`
- **WHEN** `GET /nuxt-api/public/availability?slug=test&serviceId=s1&date=2026-05-18`
- **THEN** 響應 200；`data.slots` 為 5 個 slot：09:00、09:30、10:00、10:30、11:00（11:30 + 60 = 12:30 > 12:00 故捨棄）
- **AND** 每個 slot `capacity=1, remaining=1`，`startAt / endAt` 為 ISO UTC 字串
- **AND** `data.timezone = 'Asia/Taipei'`、`data.date = '2026-05-18'`

#### Scenario: 午休跨段（多條規則）

- **GIVEN** Service（duration=30、step=30）；當日對應兩條 ScheduleRule：09:00–12:00、14:00–18:00
- **WHEN** 查當日 availability
- **THEN** slot 共 6 + 8 = 14 個；12:00–14:00 範圍內**無**任何 slot

#### Scenario: 整店休假日

- **GIVEN** date=2026-05-19；MerchantHoliday 有一筆 `(merchantId, 2026-05-19)`
- **WHEN** 查當日 availability
- **THEN** `data.slots` 為 `[]`

#### Scenario: 特定日期 override 取代當週規則

- **GIVEN** ScheduleRule 09:00–17:00；ScheduleOverride `(scope=MERCHANT, date=2026-05-20, startTime=13:00, endTime=15:00, isClosed=false)`
- **WHEN** 查 2026-05-20 availability
- **THEN** slot 起點僅落在 13:00–15:00 範圍，不出現 09:00–13:00 與 15:00–17:00 的 slot

#### Scenario: override isClosed=true

- **GIVEN** ScheduleOverride `(date=2026-05-21, isClosed=true)`
- **WHEN** 查當日 availability
- **THEN** `data.slots = []`

#### Scenario: 容量耗盡（TIME_CAPACITY）

- **GIVEN** Service（bookingMode=TIME_CAPACITY、capacityPerSlot=2）；某 slot 起點對應的 CONFIRMED Appointment 已 2 筆
- **WHEN** 查當日 availability
- **THEN** 該 slot `capacity=2, remaining=0`；其他 slot 不受影響

#### Scenario: 取消的預約不佔位

- **GIVEN** 某 slot 對應 2 筆 Appointment，status 分別為 CONFIRMED 與 CANCELED；capacityPerSlot=2
- **WHEN** 查該日 availability
- **THEN** 該 slot `remaining = 2 - 1 = 1`

#### Scenario: 多資源（RESOURCE 模式）resourceId 過濾

- **GIVEN** Service（bookingMode=RESOURCE）關聯 Resource A 與 B；ScheduleRule scope=RESOURCE 各自一條（A: 09:00–11:00；B: 13:00–15:00）；當日 A 有 1 筆 CONFIRMED Appointment 在 09:00（duration=60、step=60，capacity=1）
- **WHEN** `GET .../availability?slug=test&serviceId=s2&resourceId=A&date=2026-05-22`
- **THEN** 回 2 個 slot：09:00（remaining=0）、10:00（remaining=1）；**不**含 B 的 13:00–15:00
- **AND** 同樣查 resourceId=B：回 13:00、14:00 兩個 slot，皆 remaining=1（A 的預約不計入 B）

#### Scenario: RESOURCE 模式必須帶 resourceId

- **WHEN** `GET .../availability?slug=test&serviceId=<RESOURCE 模式 service>&date=2026-05-22`（無 resourceId）
- **THEN** 響應 400，三語訊息

#### Scenario: 非 RESOURCE 模式不可帶 resourceId

- **WHEN** `GET .../availability?slug=test&serviceId=<TIME_SLOT service>&resourceId=x&date=2026-05-22`
- **THEN** 響應 400

#### Scenario: RESOURCE 但 resourceId 與服務無關聯

- **GIVEN** Resource Z 存在於 merchant，但 ServiceResource 中無 `(serviceId, Z)` 關聯
- **WHEN** `GET .../availability?slug=test&serviceId=<RESOURCE service>&resourceId=Z&date=...`
- **THEN** 響應 400

#### Scenario: QUEUE 服務拒絕

- **WHEN** `GET .../availability?slug=test&serviceId=<QUEUE service>&date=...`
- **THEN** 響應 400，訊息提示 QUEUE 服務請使用號碼牌介面

#### Scenario: 服務不存在或不屬該商家

- **WHEN** serviceId 不存在或屬其他商家
- **THEN** 響應 404

#### Scenario: 服務 isActive=false 或 deletedAt 非空

- **WHEN** 該 service 已停用或軟刪除
- **THEN** 響應 404

#### Scenario: date 格式錯誤

- **WHEN** `date=2026/05/20` 或 `date=2026-5-20`
- **THEN** 響應 400

#### Scenario: 時區一致性

- **GIVEN** Merchant.timezone=`Asia/Tokyo`；ScheduleRule 09:00–10:00、weekday=Tokyo 時區下的對應日；date=2026-05-20
- **WHEN** 查當日 availability
- **THEN** slot.startAt = `2026-05-20T00:00:00.000Z`（09:00 JST = 00:00 UTC）

#### Scenario: IP 速率限制

- **GIVEN** 同一 IP 在 1 秒內已成功呼叫 5 次 `GET /nuxt-api/public/availability`
- **WHEN** 第 6 次同秒內呼叫
- **THEN** 響應 429，含 `Retry-After` header

### Requirement: 算法純函式可單測

系統 SHALL 將時段切割演算法（`buildSlots`）實作為不依賴 Prisma / H3 的純函式，並提供 vitest 單元測試覆蓋邊界情境。

#### Scenario: vitest 安裝且可執行

- **GIVEN** 專案根
- **WHEN** 執行 `npx vitest run server/__tests__/availability.test.ts`
- **THEN** 所有測試通過，無 fail 無 skip

#### Scenario: 測試涵蓋邊界

測試檔 SHALL 覆蓋以下案例：

1. 一般工作日切 slot（單一規則、無預約、無休假）
2. 午休跨段（兩條規則中間缺口無 slot）
3. 整店休假日（回空陣列）
4. 特定日期 override 取代當週規則
5. override.isClosed=true 回空陣列
6. 容量耗盡（remaining=0）
7. 多資源 resourceId 過濾正確（透過 helper 或外殼測）
