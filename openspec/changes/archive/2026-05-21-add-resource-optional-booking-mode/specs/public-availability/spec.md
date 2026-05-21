## ADDED Requirements

### Requirement: RESOURCE_OPTIONAL 模式可用時段查詢

系統 SHALL 對 `bookingMode === 'RESOURCE_OPTIONAL'` 的服務支援 `(slug, serviceId, date, resourceId?)` 兩種查詢路徑：

- **帶 `resourceId`**：行為等同 `RESOURCE` 模式——驗 ServiceResource 關聯與 Resource 啟用後，以 RESOURCE scope ScheduleRule、ScheduleOverride、僅該資源 CONFIRMED Appointment 計算 slots。
- **未帶 `resourceId`（聚合視圖）**：對 service 所有綁定的啟用資源各自計算 slots，再以 union 合併：某 slot 只要「任一資源 `remaining > 0`」即視為 `remaining=1`，否則 `remaining=0` 並附 `reason`；`reason` 取最寬鬆原因（優先序：past > taken > 全部不在班則該 slot 不出現）。

`capacity` 在 RESOURCE_OPTIONAL 模式恆為 1（每筆預約僅佔一資源 slot）。

#### Scenario: RESOURCE_OPTIONAL 帶 resourceId 等同 RESOURCE

- **GIVEN** Service `s3`（bookingMode=RESOURCE_OPTIONAL）綁定 Resource A、B；A 有 ScheduleRule RESOURCE scope 09:00–11:00；A 已有 1 筆 CONFIRMED Appointment 在 09:00（duration=60, step=60）
- **WHEN** `GET /nuxt-api/public/availability?slug=test&serviceId=s3&resourceId=A&date=2026-05-22`
- **THEN** 響應 200；回 2 個 slot：09:00（remaining=0, reason='taken'）、10:00（remaining=1, reason=undefined）；不含 B 的時段

#### Scenario: RESOURCE_OPTIONAL 不帶 resourceId 走 union 聚合

- **GIVEN** Service `s3`（bookingMode=RESOURCE_OPTIONAL）綁定 Resource A、B；A 09:00–11:00 排班、B 10:00–12:00 排班；A 在 09:00 已有 1 筆 CONFIRMED；B 無預約；duration=60、step=60
- **WHEN** `GET /nuxt-api/public/availability?slug=test&serviceId=s3&date=2026-05-22`
- **THEN** 響應 200；回 3 個 slot：
  - 09:00：A 被佔、B 未排班 → remaining=0, reason='taken'
  - 10:00：A 空、B 空 → remaining=1, reason=undefined
  - 11:00：A 未排班、B 空 → remaining=1, reason=undefined

#### Scenario: RESOURCE_OPTIONAL 未帶 resourceId 全部資源被佔

- **GIVEN** Service `s3` 綁定 A、B；某 slot A 與 B 皆有 CONFIRMED Appointment
- **WHEN** `GET .../availability?slug=test&serviceId=s3&date=...`
- **THEN** 該 slot remaining=0, reason='taken'

#### Scenario: RESOURCE_OPTIONAL 未帶 resourceId 全部資源不在班

- **GIVEN** Service `s3` 綁定 A、B；某時間範圍 A 與 B 皆無 ScheduleRule、無 override
- **WHEN** `GET .../availability?slug=test&serviceId=s3&date=...`
- **THEN** 該時間範圍不出現任何 slot（與既有「不在班不出 slot」一致）

#### Scenario: RESOURCE_OPTIONAL 帶 resourceId 與服務無關聯

- **GIVEN** Resource Z 存在但未綁定到 Service `s3`
- **WHEN** `GET .../availability?slug=test&serviceId=s3&resourceId=Z&date=...`
- **THEN** 響應 400（與 RESOURCE 同保護）

#### Scenario: RESOURCE_OPTIONAL 過濾停用資源

- **GIVEN** Service `s3` 綁定 A（active=true）、C（active=false）
- **WHEN** `GET .../availability?slug=test&serviceId=s3&date=...`（未帶 resourceId）
- **THEN** 聚合僅計算 A 的時段；C 完全忽略

#### Scenario: RESOURCE_OPTIONAL 整店休假

- **GIVEN** Service `s3` 綁定 A、B；當日存在 MerchantHoliday
- **WHEN** `GET .../availability?slug=test&serviceId=s3&date=...`
- **THEN** `data.slots = []`

## MODIFIED Requirements

### Requirement: 可預約時段查詢

系統 SHALL 提供無需 token 的可預約時段查詢端點，給定 `(slug, serviceId, resourceId?, date)`，依商家時區計算當日所有 slot 並回剩餘容量；對 IP 套 5/秒固定窗口速率限制。每個 slot 在 `remaining=0` 時 SHALL 附帶 `reason` 欄位標示不可選原因，便於前端顯示「為什麼這格不能選」的提示文字。對 `RESOURCE_OPTIONAL` 模式的詳細聚合行為另見「RESOURCE_OPTIONAL 模式可用時段查詢」需求。

#### Scenario: 一般工作日 TIME_SLOT 切 slot

- **GIVEN** Service `s1`（bookingMode=TIME_SLOT、durationMinutes=60、slotIntervalMinutes=30）；ScheduleRule scope=MERCHANT、weekday=1（週一）、09:00–12:00；date=2026-05-18（週一）；無預約、無休假、無 override；Merchant.timezone=`Asia/Taipei`
- **WHEN** `GET /nuxt-api/public/availability?slug=test&serviceId=s1&date=2026-05-18`
- **THEN** 響應 200；`data.slots` 為 5 個 slot：09:00、09:30、10:00、10:30、11:00（11:30 + 60 = 12:30 > 12:00 故捨棄）
- **AND** 每個 slot `capacity=1, remaining=1, reason=undefined`，`startAt / endAt` 為 ISO UTC 字串
- **AND** `data.timezone = 'Asia/Taipei'`、`data.date = '2026-05-18'`

#### Scenario: 午休跨段（多條規則）

- **GIVEN** Service（duration=30、step=30）；當日對應兩條 ScheduleRule：09:00–12:00、14:00–18:00
- **WHEN** 查當日 availability
- **THEN** slot 共 6 + 8 = 14 個；12:00–14:00 範圍內**無**任何 slot

#### Scenario: 整店休假日

- **GIVEN** date=2026-05-19；MerchantHoliday 有一筆 `(merchantId, 2026-05-19)`
- **WHEN** 查當日 availability
- **THEN** `data.slots` 為 `[]`（整日不營業時 reason **不**用於佔位 slot）

#### Scenario: 特定日期 override 取代當週規則

- **GIVEN** ScheduleRule 09:00–17:00；ScheduleOverride `(scope=MERCHANT, date=2026-05-20, startTime=13:00, endTime=15:00, isClosed=false)`
- **WHEN** 查 2026-05-20 availability
- **THEN** slot 起點僅落在 13:00–15:00 範圍，不出現 09:00–13:00 與 15:00–17:00 的 slot

#### Scenario: override isClosed=true

- **GIVEN** ScheduleOverride `(date=2026-05-21, isClosed=true)`
- **WHEN** 查當日 availability
- **THEN** `data.slots = []`

#### Scenario: 容量耗盡（TIME_CAPACITY）reason=capacity

- **GIVEN** Service（bookingMode=TIME_CAPACITY、capacityPerSlot=2）；某 slot 起點對應的 CONFIRMED Appointment 已 2 筆
- **WHEN** 查當日 availability
- **THEN** 該 slot `capacity=2, remaining=0, reason='capacity'`；其他可用 slot `reason=undefined`

#### Scenario: TIME_SLOT 或 RESOURCE 被佔 reason=taken

- **GIVEN** Service（bookingMode=TIME_SLOT 或 RESOURCE，capacity=1）；某 slot 起點對應 1 筆 CONFIRMED Appointment
- **WHEN** 查當日 availability
- **THEN** 該 slot `capacity=1, remaining=0, reason='taken'`

#### Scenario: 已過時段 reason=past

- **GIVEN** 當前時間是 2026-05-18 11:30（Asia/Taipei）；ScheduleRule 09:00–12:00 涵蓋多個 slot
- **WHEN** 查當日 availability（含已過的 09:00、10:00、11:00）
- **THEN** 已過的 slot `remaining=0, reason='past'`；尚未到的 slot `reason=undefined`

#### Scenario: 取消的預約不佔位

- **GIVEN** 某 slot 對應 2 筆 Appointment，status 分別為 CONFIRMED 與 CANCELED；capacityPerSlot=2
- **WHEN** 查該日 availability
- **THEN** 該 slot `remaining = 2 - 1 = 1, reason=undefined`

#### Scenario: 多資源（RESOURCE 模式）resourceId 過濾

- **GIVEN** Service（bookingMode=RESOURCE）關聯 Resource A 與 B；ScheduleRule scope=RESOURCE 各自一條（A: 09:00–11:00；B: 13:00–15:00）；當日 A 有 1 筆 CONFIRMED Appointment 在 09:00（duration=60、step=60，capacity=1）
- **WHEN** `GET .../availability?slug=test&serviceId=s2&resourceId=A&date=2026-05-22`
- **THEN** 回 2 個 slot：09:00（remaining=0, reason='taken'）、10:00（remaining=1, reason=undefined）；**不**含 B 的 13:00–15:00
- **AND** 同樣查 resourceId=B：回 13:00、14:00 兩個 slot，皆 remaining=1, reason=undefined（A 的預約不計入 B）

#### Scenario: RESOURCE 模式必須帶 resourceId

- **WHEN** `GET .../availability?slug=test&serviceId=<RESOURCE 模式 service>&date=2026-05-22`（無 resourceId）
- **THEN** 響應 400，三語訊息

#### Scenario: 不允許 resourceId 的模式拒絕（TIME_SLOT / TIME_CAPACITY）

- **WHEN** `GET .../availability?slug=test&serviceId=<TIME_SLOT 或 TIME_CAPACITY service>&resourceId=x&date=2026-05-22`
- **THEN** 響應 400

#### Scenario: RESOURCE_OPTIONAL 允許不帶 resourceId

- **WHEN** `GET .../availability?slug=test&serviceId=<RESOURCE_OPTIONAL service>&date=2026-05-22`
- **THEN** 響應 200（走 union 聚合，不回 400）

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

系統 SHALL 將時段切割演算法（`buildSlots`）實作為不依賴 Prisma / H3 的純函式，並提供 vitest 單元測試覆蓋邊界情境；`buildSlots` SHALL 接受 `now: Date` 參數以決定 `reason='past'` 的判定基準，且該參數在測試中可注入。RESOURCE_OPTIONAL 的 union 聚合 SHALL 同樣以純函式（例如 `mergeResourceSlots`）實作，且其單元測試 SHALL 覆蓋「任一資源可用」、「全部被佔」、「全部不在班」三類邊界。

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
6. 容量耗盡（remaining=0, reason='capacity'）
7. TIME_SLOT/RESOURCE 被佔（remaining=0, reason='taken'）
8. 已過時段（remaining=0, reason='past'，注入固定 now）
9. 未過 + 無預約 slot（reason=undefined）
10. 多資源 resourceId 過濾正確（透過 helper 或外殼測）
11. RESOURCE_OPTIONAL union 聚合：任一資源可用 → remaining=1
12. RESOURCE_OPTIONAL union 聚合：全部資源被佔 → remaining=0, reason='taken'
13. RESOURCE_OPTIONAL union 聚合：全部資源不在班 → 該 slot 不出現
