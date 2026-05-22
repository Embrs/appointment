## MODIFIED Requirements

### Requirement: 顧客建立預約

The system SHALL allow customers to create appointments via public API without authentication, identifying themselves with a triplet (lastName, title, phone), and enforce a per-merchant active appointment limit per phone. For services with `bookingMode === 'RESOURCE_OPTIONAL'`, customers MAY omit `resourceId`; the server SHALL auto-assign a bound active resource per the rules in the "RESOURCE_OPTIONAL 模式預約建立" requirement.

當商家 `providerModeEnabled=true` 且服務 `requiresProvider=true` 時，POST 必須帶 `providerId`，且後端 SHALL 在現有 advisory lock 內檢查「該 Provider 同時段是否已有 CONFIRMED Appointment」，衝堂時回 409；當服務 `requiresProvider=false` 但 POST 帶 `providerId` 時，後端寫入但不額外限制（容量檢查同既有 bookingMode 行為）。所有寫入 `Appointment` 的請求 SHALL 將 `providerId` 持久化至 `Appointment.providerId`（nullable）。

#### Scenario: 預約成功

- **Given** 商家 ACTIVE、服務 `bookingMode=TIME_SLOT`、目標 slot 仍有容量、該手機在本商家未來 CONFIRMED 預約 < `maxActiveAppointmentsPerCustomer`
- **When** 顧客 POST `/nuxt-api/public/appointment` 帶 `slug/serviceId/startAt/lastName/title/phone`
- **Then** 後端在事務內取 advisory lock、重檢容量、重檢上限、寫入 Appointment（status=CONFIRMED、providerId=null），回 `{ appointmentId, startAt, endAt }`

#### Scenario: 預約成功（指定 Provider）

- **Given** 商家 `providerModeEnabled=true`、服務 `requiresProvider=true`、Provider p1 綁此服務、p1 對該時段無衝堂、上限未達
- **When** 顧客 POST 帶 `slug/serviceId/providerId=p1/startAt/lastName/title/phone`
- **Then** 後端在事務內取 advisory lock、重檢 Provider 同時段無 CONFIRMED Appointment、寫入 Appointment（providerId=p1），回 200

#### Scenario: 兩人同搶同 Provider 同時段

- **Given** Provider p1、目標時段、兩 request 幾乎同時提交
- **Then** Advisory lock 序列化，後者重檢時偵測 Provider 衝堂，回 409 `MSG_PROVIDER_TAKEN`，三語訊息「該{providerLabel}此時段已被預約」

#### Scenario: requiresProvider=true 但未帶 providerId

- **When** POST 未帶 `providerId`
- **Then** 回 400 `MSG_PROVIDER_REQUIRED`

#### Scenario: providerId 未綁此服務

- **Given** Provider p2 未透過 ProviderService 關聯此服務
- **When** POST 帶 `providerId=p2`
- **Then** 回 400 `MSG_PROVIDER_NOT_FOR_SERVICE`

#### Scenario: providerId 屬於其他商家

- **When** POST 帶 `providerId=<其他商家 id>`
- **Then** 回 404 或 400（拒絕跨商家）

#### Scenario: Provider 已停用或軟刪

- **Given** Provider p1 `isActive=false` 或 `deletedAt 非空`
- **When** POST 帶 `providerId=p1`
- **Then** 回 400 `MSG_PROVIDER_INACTIVE`

#### Scenario: 商家未啟用 Provider 制但帶 providerId

- **Given** 商家 `providerModeEnabled=false`
- **When** POST 帶 `providerId`
- **Then** providerId 被忽略；行為與既有一致（不寫入 Appointment.providerId）

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

#### Scenario: RESOURCE_OPTIONAL 模式可不帶資源

- **When** 服務 `bookingMode=RESOURCE_OPTIONAL` 未帶 `resourceId` 且至少一個綁定資源可用
- **Then** 後端 auto-assign 成功、Appointment.resourceId 寫入分配結果、回 200

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

### Requirement: 步驟式預約流程

The booking page SHALL guide customers through Service → Provider? → Resource? → DateTime → Triplet → Confirm steps with back navigation. Date selection and slot selection MUST be presented on the same step ("datetime") so that picking a date immediately reveals the available time slots without an extra "next" click. Advancing from the "datetime" step to "info" MUST require an explicit "next" click after a slot is picked, to avoid accidental progression on a mis-tap. Services with `bookingMode ∈ {RESOURCE, RESOURCE_OPTIONAL}` MUST go through the `resource` step; `RESOURCE_OPTIONAL` additionally MUST include "不指定（由系統自動分配）" as the first option.

當商家 `providerModeEnabled=true` 時，服務若 `requiresProvider=true` SHALL 插入「provider」步驟（位於 service 之後、resource / datetime 之前），且 SHALL 為強制步驟；服務若 `requiresProvider=false` SHALL 跳過 provider 步驟（與本變更前流程一致）。當商家 `providerModeEnabled=false` 時，無論服務 `requiresProvider` 值為何，SHALL 跳過 provider 步驟（資料層欄位存在但 UI 不暴露）。

#### Scenario: 跳過 Resource 步驟

- **Given** 選的 Service `bookingMode ∉ {RESOURCE, RESOURCE_OPTIONAL}` 且不需 Provider
- **When** 顧客在步驟一點擊服務卡片
- **Then** 步驟器自動跳到 `datetime`（不再先進入 `date` 再進入 `slot`）

#### Scenario: 啟用 Provider 制且服務需指定 Provider

- **Given** 商家 `providerModeEnabled=true`、Service `requiresProvider=true` 綁 p1、p2、p3（皆 isActive=true）
- **When** 顧客在 service 步驟點擊該服務
- **Then** 步驟切到 `provider`；列出 3 張 Provider 卡片，含頭像、姓名、職稱、簡介；未選不可進入下一步

#### Scenario: 選 Provider 後推進

- **Given** 顧客在 `provider` 步
- **When** 點擊某張 Provider 卡片並按「下一步」
- **Then** `form.providerId` 被填入；步驟切到 `resource`（若 `bookingMode ∈ {RESOURCE, RESOURCE_OPTIONAL}`）或 `datetime`（其他模式）

#### Scenario: Provider 卡片標題用商家自訂稱呼

- **Given** 商家 `providerLabel.zh='醫師'`、locale=zh
- **When** 顧客進入 `provider` 步
- **Then** 步驟標題顯示「選擇醫師」（非寫死「服務人員」）

#### Scenario: 啟用 Provider 制但服務 requiresProvider=false

- **Given** 商家 `providerModeEnabled=true`、Service `requiresProvider=false`
- **When** 顧客在 service 步驟點擊該服務
- **Then** 跳過 provider 步、直接進入 resource / datetime（依 bookingMode）；Appointment.providerId 寫入為 null

#### Scenario: 商家未啟用 Provider 制

- **Given** 商家 `providerModeEnabled=false`（不論 Service.requiresProvider 為何）
- **When** 顧客點擊服務卡片
- **Then** 流程與本變更前完全一致（無 provider 步驟）

#### Scenario: RESOURCE 進入 resource 步驟需選具名資源

- **Given** Service `bookingMode=RESOURCE` 綁 A、B
- **Then** resource 步驟列出 A、B 兩個選項；無「不指定」選項；未選不可進入 datetime

#### Scenario: RESOURCE_OPTIONAL 進入 resource 步驟提供「不指定」

- **Given** Service `bookingMode=RESOURCE_OPTIONAL` 綁 A、B
- **Then** resource 步驟列出三個選項：「不指定（由系統自動分配）」、A、B；預設未選；可選任一進入 datetime

#### Scenario: 選日期立即載入時段

- **Given** 顧客處於 `datetime` 步、左側日曆顯示
- **When** 顧客點擊某個日期格
- **Then** 右側時段區（< 768px 為下方）立即觸發 `GET /public/availability`（若已選 Provider 帶 `providerId`）並渲染時段；不需要按「下一步」

#### Scenario: 選時段後須點下一步

- **Given** 顧客已選好日期、右側顯示時段
- **When** 顧客點擊某個可用時段
- **Then** `form.startAt` / `form.endAt` 被填入、該時段呈現選中視覺；步驟 **不** 自動切換
- **And** 「下一步」按鈕由 disabled 變為 enabled
- **When** 顧客點擊「下一步」
- **Then** 步驟切到 `info`

#### Scenario: 未選時段時下一步不可用

- **Given** 顧客在 `datetime` 步、尚未選擇時段
- **Then** 「下一步」按鈕 disabled、無法點擊推進

#### Scenario: 回退重選

- **When** 在 `datetime` 步點上一步
- **Then** 回到上一個有效步驟（依 provider / resource 步是否存在）；已選 slot 清空但 `form.date` 保留以便回來時不需重選

#### Scenario: URL 帶 serviceId

- **When** 進入 `/m/{slug}/book?serviceId=xxx`
- **Then** Service 步預選並立刻推進到下一個有效步驟（`provider` → `resource` → `datetime` 依序評估）

#### Scenario: URL 帶 serviceId + providerId

- **Given** 商家啟用 Provider 制、Service `requiresProvider=true`、Provider p1 綁此服務
- **When** 進入 `/m/{slug}/book?serviceId=xxx&providerId=p1`
- **Then** Service 與 Provider 兩步皆預選並推進到 `resource` 或 `datetime`

#### Scenario: RWD 切換版面

- **Given** 視窗寬度 >= 768px
- **Then** `datetime` 步呈現左右分欄（日曆在左、時段在右）

- **Given** 視窗寬度 < 768px
- **Then** `datetime` 步切為上下堆疊（日曆在上、時段在下）
