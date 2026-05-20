## MODIFIED Requirements

### Requirement: 步驟式預約流程

The booking page SHALL guide customers through Service → Resource? → DateTime → Triplet → Confirm steps with back navigation. Date selection and slot selection MUST be presented on the same step ("datetime") so that picking a date immediately reveals the available time slots without an extra "next" click. Advancing from the "datetime" step to "info" MUST require an explicit "next" click after a slot is picked, to avoid accidental progression on a mis-tap.

#### Scenario: 跳過 Resource 步驟

- **Given** 選的 Service `bookingMode != RESOURCE`
- **When** 顧客在步驟一點擊服務卡片
- **Then** 步驟器自動跳到 `datetime`（不再先進入 `date` 再進入 `slot`）

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

## ADDED Requirements

### Requirement: 服務卡片整張可點擊

The system SHALL render each public service card (`BizServiceCard`) as a single clickable surface that routes the customer to the appropriate next page based on the service's `bookingMode`. The card MUST NOT rely on a separate bottom action button.

#### Scenario: 非號碼牌服務點擊卡片

- **Given** 服務 `bookingMode ∈ {TIME_SLOT, TIME_CAPACITY, RESOURCE}`
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
