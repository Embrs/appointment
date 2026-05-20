# Capability：customer-booking — delta for fix-customer-booking-ux

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 步驟式預約流程

The booking page SHALL guide customers through Service → Resource? → Date → Slot → Triplet → Confirm steps with back navigation. The step indicator SHALL remain visually informative on mobile viewports (≤ 640px): the active step's label MUST stay visible and every step's numeric badge MUST remain readable (contrast ≥ AA). The Date step SHALL present a **month-grid calendar** that supports month navigation, today marking, and disabled-date marking.

#### Scenario: 跳過 Resource 步驟

- **GIVEN** 選的 Service `bookingMode != RESOURCE`
- **THEN** 步驟器自動跳到 Date

#### Scenario: 回退重選

- **WHEN** 在 Slot 步退回 Date
- **THEN** 已選 slot 清空、Date 仍保留

#### Scenario: URL 帶 serviceId

- **WHEN** 進入 `/m/{slug}/book?serviceId=xxx`
- **THEN** Service 步預選且立即推進

#### Scenario: 手機版步驟條可讀

- **GIVEN** 顧客在 375px 寬度進入預約流程
- **WHEN** 流程進入第 2 步（Date）
- **THEN** 圓圈內的數字「2」清楚可見（白色字、深色底），且「日期」label 出現在 active 步驟旁；其他步驟僅顯示圓圈即可

#### Scenario: 日期 step 顯示月曆

- **GIVEN** 顧客進入 Date 步驟
- **WHEN** 畫面初次呈現
- **THEN** 顯示一個 7 欄月曆 grid，包含當月所有日期、週標題、左右切換月份按鈕；today 有「今」角標；過去日期不可點

#### Scenario: 月曆切換月份

- **GIVEN** 顧客在 Date 步驟
- **WHEN** 點擊右箭頭切到下個月
- **THEN** 月曆顯示下個月所有日期；若該月有可選日期，顧客可直接點選並進入下一步

#### Scenario: 月曆 disabledDates

- **GIVEN** 月曆 props 傳入 `disabledDates: ['2026-05-25']`
- **WHEN** 顧客嘗試點擊 5/25
- **THEN** 該格呈灰色不可點，`modelValue` 不變
