# customer-booking — Delta for improve-customer-page-nav

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 步驟式預約流程

The booking page SHALL guide customers through Service → Resource? → Date → Slot → Triplet → Confirm steps with back navigation. 預約頁 SHALL 在頁首使用 `BizCustomerPageHeader` 提供「離開預約流程」的返回入口（指向商家首頁 `/m/{slug}`），並在頁面內保留「上一步」按鈕作為 step 退階控制；兩者職責不重疊。

#### Scenario: 跳過 Resource 步驟

- **Given** 選的 Service `bookingMode != RESOURCE`
- **Then** 步驟器自動跳到 Date

#### Scenario: 回退重選

- **When** 在 Slot 步退回 Date
- **Then** 已選 slot 清空、Date 仍保留

#### Scenario: URL 帶 serviceId

- **When** 進入 `/m/{slug}/book?serviceId=xxx`
- **Then** Service 步預選且立即推進

#### Scenario: Header 返回 = 離開預約流程

- **GIVEN** 顧客處於預約流程任一步驟（service / resource / date / slot / info / confirm）
- **WHEN** 點擊頁首左上的「← 返回」
- **THEN** 直接 `navigateTo('/m/{slug}')`，離開預約頁
- **AND** 不彈出確認對話框（本變更未涵蓋表單離脫提示）

#### Scenario: 頁內「上一步」維持 step 退階

- **GIVEN** 顧客處於 step≥2
- **WHEN** 點擊頁面內容區的「上一步」按鈕
- **THEN** stepIndex 減 1，**不**跳出預約頁
- **AND** 此行為與 header 返回鈕互不影響
