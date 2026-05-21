# Capability：customer-booking

## Purpose

顧客公開預約流程：無需登入即可選服務 / slot、填寫三元組（lastName, title, phone）送出，後端以 advisory lock 防併發、依商家 cancelPolicy 控管取消、提供顧客手機末 4 碼自助查預約與取消。涵蓋 TIME_SLOT / TIME_CAPACITY / RESOURCE / RESOURCE_OPTIONAL / QUEUE 多模式。
## Requirements
### Requirement: 顧客建立預約

The system SHALL allow customers to create appointments via public API without authentication, identifying themselves with a triplet (lastName, title, phone), and enforce a per-merchant active appointment limit per phone. For services with `bookingMode === 'RESOURCE_OPTIONAL'`, customers MAY omit `resourceId`; the server SHALL auto-assign a bound active resource per the rules in the "RESOURCE_OPTIONAL 模式預約建立" requirement.

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

### Requirement: 顧客 Session 持久化

The frontend SHALL persist the customer triplet locally so subsequent visits skip the form, while never sending it to the server outside explicit booking/lookup actions.

#### Scenario: 再次造訪 my-bookings

- **Given** 上次預約已存三元組
- **When** 顧客造訪 `/m/{slug}/my-bookings`
- **Then** 自動以儲存的三元組查當前 slug 的預約

### Requirement: 步驟式預約流程

The booking page SHALL guide customers through Service → Resource? → DateTime → Triplet → Confirm steps with back navigation. Date selection and slot selection MUST be presented on the same step ("datetime") so that picking a date immediately reveals the available time slots without an extra "next" click. Advancing from the "datetime" step to "info" MUST require an explicit "next" click after a slot is picked, to avoid accidental progression on a mis-tap. Services with `bookingMode ∈ {RESOURCE, RESOURCE_OPTIONAL}` MUST go through the `resource` step; `RESOURCE_OPTIONAL` additionally MUST include "不指定（由系統自動分配）" as the first option.

#### Scenario: 跳過 Resource 步驟

- **Given** 選的 Service `bookingMode ∉ {RESOURCE, RESOURCE_OPTIONAL}`
- **When** 顧客在步驟一點擊服務卡片
- **Then** 步驟器自動跳到 `datetime`（不再先進入 `date` 再進入 `slot`）

#### Scenario: RESOURCE 進入 resource 步驟需選具名資源

- **Given** Service `bookingMode=RESOURCE` 綁 A、B
- **Then** resource 步驟列出 A、B 兩個選項；無「不指定」選項；未選不可進入 datetime

#### Scenario: RESOURCE_OPTIONAL 進入 resource 步驟提供「不指定」

- **Given** Service `bookingMode=RESOURCE_OPTIONAL` 綁 A、B
- **Then** resource 步驟列出三個選項：「不指定（由系統自動分配）」、A、B；預設未選；可選任一進入 datetime

#### Scenario: 選日期立即載入時段

- **Given** 顧客處於 `datetime` 步、左側日曆顯示
- **When** 顧客點擊某個日期格
- **Then** 右側時段區（< 768px 為下方）立即觸發 `GET /public/availability` 並渲染時段；不需要按「下一步」

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
- **Then** 回到 `service` 或 `resource`（依是否需要 resource），已選 slot 清空但 `form.date` 保留以便回來時不需重選

#### Scenario: URL 帶 serviceId

- **When** 進入 `/m/{slug}/book?serviceId=xxx`
- **Then** Service 步預選並立刻推進到 `datetime`（或 `resource` 若需）；不再經過獨立的 `date` 步

#### Scenario: RWD 切換版面

- **Given** 視窗寬度 >= 768px
- **Then** `datetime` 步呈現左右分欄（日曆在左、時段在右）

- **Given** 視窗寬度 < 768px
- **Then** `datetime` 步切為上下堆疊（日曆在上、時段在下）

### Requirement: 服務卡片底部對齊

`BizServiceCard` SHALL render its action button (book / queue) anchored at the bottom of the card so that buttons across cards in the same row are visually aligned regardless of description length.

#### Scenario: 描述長度不一仍對齊

- **GIVEN** 同一商家首頁有三張服務卡片：A 有兩行描述、B 一行描述、C 無描述
- **WHEN** 顧客在桌機（≥1024px）瀏覽商家首頁
- **THEN** 三張卡片的「立即預約／號碼牌」按鈕底邊位於同一條水平線（誤差 < 2px）

#### Scenario: 手機版仍對齊

- **GIVEN** 同上情境
- **WHEN** 改以 375px 寬瀏覽
- **THEN** 卡片若同列顯示，按鈕底邊維持對齊；若逐張縱排，每張卡片高度自適應但內部按鈕仍貼齊卡片底部

### Requirement: QUEUE 服務從首頁進入領號

`BizServiceCard` SHALL emit a distinct `click-queue` event for services whose `bookingMode === 'QUEUE'`, and the parent merchant home page SHALL navigate to `/m/{slug}/queue?serviceId={serviceId}` when receiving this event. The button MUST NOT be disabled.

#### Scenario: 點擊號碼牌服務

- **GIVEN** 顧客位於 `/m/{slug}` 首頁，某服務 `bookingMode === 'QUEUE'`
- **WHEN** 顧客點擊該卡片的「號碼牌」按鈕
- **THEN** 路由跳轉至 `/m/{slug}/queue?serviceId={serviceId}`，且按鈕在點擊前**非 disabled 狀態**

#### Scenario: 點擊一般服務維持原行為

- **GIVEN** 服務 `bookingMode` 為 `TIME_SLOT` / `TIME_CAPACITY` / `RESOURCE`
- **WHEN** 顧客點擊「立即預約」
- **THEN** 仍導向 `/m/{slug}/book?serviceId={serviceId}`（既有行為不變）

### Requirement: 顧客面統一頁首與返回入口

顧客面 `/m/{slug}/*` 子頁（不含商家首頁 `/m/{slug}` 本身）SHALL 使用 `BizCustomerPageHeader` 元件渲染頁首，並透過 `backTo` props 宣告固定的父路徑作為返回目標；元件 SHALL 使用 `navigateTo(backTo)` 進行返回，**不得**使用 `router.back()` 或瀏覽器歷史。

#### Scenario: lookup 頁顯示返回入口

- **GIVEN** 顧客以任何方式（站內連結、書籤、外部 QR Code）進入 `/m/{slug}/lookup`
- **THEN** 頁面頂部以 `BizCustomerPageHeader` 渲染標題與「← 返回」入口
- **WHEN** 顧客點擊「返回」
- **THEN** 跳轉至 `/m/{slug}`，無論瀏覽器歷史是否包含該路徑

#### Scenario: my-bookings 頁顯示返回入口

- **GIVEN** 顧客進入 `/m/{slug}/my-bookings`
- **THEN** 頁面頂部以 `BizCustomerPageHeader` 渲染標題與「← 返回」入口
- **AND** 既有的「切換身份」按鈕透過 `#actions` slot 提供在頁首右側
- **WHEN** 顧客點擊「返回」
- **THEN** 跳轉至 `/m/{slug}`

#### Scenario: 商家首頁本身不顯示返回

- **GIVEN** 顧客進入 `/m/{slug}`（商家首頁）
- **THEN** 該頁不渲染 `BizCustomerPageHeader` 的返回入口（首頁為動線根節點）

### Requirement: 服務卡片整張可點擊

The system SHALL render each public service card (`BizServiceCard`) as a single clickable surface that routes the customer to the appropriate next page based on the service's `bookingMode`. The card MUST NOT rely on a separate bottom action button.

#### Scenario: 非號碼牌服務點擊卡片

- **Given** 服務 `bookingMode ∈ {TIME_SLOT, TIME_CAPACITY, RESOURCE, RESOURCE_OPTIONAL}`
- **When** 顧客在 `/m/{slug}` 或 `/m/{slug}/book` 的服務列表上點擊整張卡片任意處
- **Then** 系統 emit `click-book` 並導向 `/m/{slug}/book?serviceId={service.id}`

#### Scenario: 號碼牌服務點擊卡片

- **Given** 服務 `bookingMode = QUEUE`
- **When** 顧客點擊整張卡片任意處
- **Then** 系統 emit `click-queue` 並導向 `/m/{slug}/queue`

#### Scenario: 鍵盤可達

- **Given** 卡片有 `tabindex="0"` 與 `role="button"`
- **When** 顧客以鍵盤聚焦卡片並按下 Enter 或 Space
- **Then** 行為等同點擊（依 `bookingMode` 導流）

#### Scenario: Hover 與視覺提示

- **Given** 桌機環境
- **When** 滑鼠移到卡片上
- **Then** 卡片有可見的 hover 回饋（陰影加深 / 微幅上浮），且右下角顯示箭頭符號暗示可進入

### Requirement: RESOURCE_OPTIONAL 模式預約建立

系統 SHALL 對 `bookingMode === 'RESOURCE_OPTIONAL'` 的服務支援兩種下單路徑：

- **顧客指定 resourceId**：與 RESOURCE 模式相同（驗 ServiceResource 關聯與資源啟用、advisory lock key 用 `(merchantId, resourceId, startAt)`）。
- **顧客未帶 resourceId（auto-assign）**：advisory lock key 用 `(merchantId, serviceId, startAt)`；在 transaction 內重新查所有綁定 active 資源在該 startAt 的 CONFIRMED 占用與排班狀態，從未被佔且在班的資源中選擇「未來 30 天 CONFIRMED 預約數最少」者；若多者並列取 `id` 升序最小者；將該 `resourceId` 寫入 `Appointment.resourceId`。若無任何資源符合條件回 409 `MSG_SLOT_TAKEN`。

兩種路徑都將 `Appointment.mode` 寫為 `RESOURCE_OPTIONAL`（不論顧客是否指定）。

#### Scenario: 顧客指定資源下單成功

- **GIVEN** Service `s3`（RESOURCE_OPTIONAL，綁 A、B）；A 在目標 slot 無預約且在班
- **WHEN** 顧客 POST `/nuxt-api/public/appointment` 帶 `serviceId=s3, resourceId=A, startAt, ...`
- **THEN** 建立 Appointment：`mode=RESOURCE_OPTIONAL, resourceId=A, status=CONFIRMED`

#### Scenario: 顧客不指定資源 auto-assign 成功

- **GIVEN** Service `s3`（RESOURCE_OPTIONAL，綁 A、B）；A 與 B 在目標 slot 皆空且在班；A 未來 30d CONFIRMED 預約 3 筆、B 為 1 筆
- **WHEN** 顧客 POST `/nuxt-api/public/appointment` 帶 `serviceId=s3, startAt, ...`（不帶 resourceId）
- **THEN** 建立 Appointment：`mode=RESOURCE_OPTIONAL, resourceId=B`（B 預約數少，被分配）

#### Scenario: auto-assign tie-breaker id 升序

- **GIVEN** Service `s3` 綁 A、B；兩者未來 30d 預約數相同（皆 0）且皆可用
- **WHEN** 顧客不帶 resourceId 下單
- **THEN** 分配給 `id` 較小者（確定性，方便測試）

#### Scenario: auto-assign 跳過不在班資源

- **GIVEN** Service `s3` 綁 A、B；目標 slot 09:00，A 在班但被佔、B 該時段沒有 ScheduleRule
- **WHEN** 顧客不帶 resourceId 下單 09:00
- **THEN** 回 409 `MSG_SLOT_TAKEN`（A 被佔、B 不在班，無可分配資源）

#### Scenario: auto-assign 全部資源被佔

- **GIVEN** Service `s3` 綁 A、B；目標 slot 兩者都已被 CONFIRMED 佔
- **WHEN** 顧客不帶 resourceId 下單
- **THEN** 回 409 `MSG_SLOT_TAKEN`

#### Scenario: 並發 auto-assign 不會把同資源分給兩位顧客

- **GIVEN** Service `s3` 綁 A、B；目標 slot 兩者皆空
- **WHEN** 兩個 request 幾乎同時提交不帶 resourceId 的下單
- **THEN** Advisory lock 序列化兩筆事務；兩筆 Appointment 分別分到 A 與 B；不會兩筆都拿到同一資源

#### Scenario: 並發指定 + auto 不會把指定資源讓 auto 搶走

- **GIVEN** Service `s3` 綁 A、B；目標 slot 兩者皆空
- **WHEN** 顧客 X 指定 A、顧客 Y 不指定，幾乎同時提交
- **THEN** 最壞情況：兩 transaction 都進行 → X 佔 A → Y auto-assign 重檢時 A 已佔 → Y 改分到 B；兩筆都成功且資源不重複

#### Scenario: RESOURCE_OPTIONAL 但帶不屬於該服務的 resourceId

- **GIVEN** Resource Z 屬於商家但未綁 Service `s3`
- **WHEN** 顧客 POST `serviceId=s3, resourceId=Z`
- **THEN** 回 400 `MSG_RESOURCE_NOT_LINKED`

#### Scenario: RESOURCE_OPTIONAL 帶停用資源拒絕

- **GIVEN** Resource A 已 `isActive=false`，但仍綁定 Service `s3`
- **WHEN** 顧客 POST `serviceId=s3, resourceId=A`
- **THEN** 回 400 `MSG_RESOURCE_NOT_LINKED`（與 RESOURCE 同保護）

#### Scenario: auto-assign 過濾停用資源

- **GIVEN** Service `s3` 綁 A（active）、C（active=false）；目標 slot A 被佔
- **WHEN** 顧客不帶 resourceId 下單
- **THEN** 回 409 `MSG_SLOT_TAKEN`（C 雖然空閒但已停用，不納入分配）

#### Scenario: 商家代客預約 RESOURCE_OPTIONAL

- **GIVEN** 商家後台
- **WHEN** 商家 POST `/nuxt-api/appointment` 服務為 RESOURCE_OPTIONAL（含或不含 resourceId）
- **THEN** 與顧客路徑同邏輯；不檢查 cancelPolicy；auto-assign 仍生效

### Requirement: RESOURCE_OPTIONAL 顧客預約 UI 流程

顧客預約頁 `m/[slug]/book.vue` SHALL 在選定 `bookingMode === 'RESOURCE_OPTIONAL'` 的服務後進入 `resource` 步驟，並 SHALL 在資源選項列表第一項固定提供「不指定（由系統自動分配）」選項；顧客若選「不指定」，後續 availability 查詢與 appointment 提交 SHALL **不帶** `resourceId` 參數；顧客若選具名資源，行為與 RESOURCE 模式相同。

#### Scenario: 進入 RESOURCE_OPTIONAL 服務出現資源步驟

- **GIVEN** 顧客點擊 `bookingMode=RESOURCE_OPTIONAL` 服務
- **THEN** 步驟器進入 `resource` 步驟（不是直接到 `datetime`）

#### Scenario: 資源步驟出現「不指定」首選項

- **GIVEN** Service `s3` 綁定 `[王醫師, 李醫師]`
- **WHEN** 顧客進入 resource 步驟
- **THEN** 選項列表為三項：「不指定（由系統自動分配）」、「王醫師」、「李醫師」（順序固定，不指定永遠在第一）

#### Scenario: 選「不指定」走聚合 availability

- **GIVEN** 顧客選「不指定」並進入 datetime 步驟
- **WHEN** 選擇日期觸發 availability 查詢
- **THEN** 請求 URL 不帶 `resourceId` 參數；後端回 union 聚合結果

#### Scenario: 選具名資源走指定 availability

- **GIVEN** 顧客選「王醫師」並進入 datetime
- **WHEN** 選擇日期觸發 availability 查詢
- **THEN** 請求 URL 帶 `resourceId=<王醫師 id>`；後端只算該資源時段

#### Scenario: 「不指定」下單不送 resourceId

- **GIVEN** 顧客選擇了「不指定」與某 slot 並送出
- **WHEN** POST `/nuxt-api/public/appointment`
- **THEN** payload 不含 `resourceId` 欄位（或值為 undefined / null）

#### Scenario: 具名資源下單帶 resourceId

- **GIVEN** 顧客選擇了「王醫師」與某 slot 並送出
- **THEN** POST payload 含 `resourceId=<王醫師 id>`

#### Scenario: 三語文案

- **GIVEN** 顧客切換 locale 為 en / ja
- **THEN** 「不指定（由系統自動分配）」對應 `Any available (auto-assign)` / `指定なし（自動割り当て）`

