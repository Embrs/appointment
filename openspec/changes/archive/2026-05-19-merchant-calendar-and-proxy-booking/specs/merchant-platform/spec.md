## ADDED Requirements

### Requirement: 預約管理頁採同頁 toggle、預設行事曆

`/admin/appointments` SHALL 在同一個頁面內提供「行事曆 / 列表」兩種視圖切換，初次造訪 SHALL 預設停在行事曆視圖；視圖狀態 SHALL 透過 URL query `view=calendar | list` 持久化以便重整與分享連結時保留。

#### Scenario: 初次造訪預設行事曆

- **GIVEN** 商家已登入、瀏覽器歷史中無 `/admin/appointments` 任何 query 紀錄
- **WHEN** 訪 `/admin/appointments`（無 query）
- **THEN** 頁面渲染行事曆視圖；右上角 toggle 高亮「行事曆」；URL **不**自動補 `?view=calendar`（保持簡潔）

#### Scenario: 切換到列表並保留

- **GIVEN** 商家在 `/admin/appointments` 行事曆視圖
- **WHEN** 點擊 toggle 的「列表」
- **THEN** 視圖切為列表；URL 變為 `/admin/appointments?view=list`（用 `router.replace`，不污染 history）
- **AND** 重整頁面後仍停在列表

#### Scenario: query=calendar 顯式指定

- **WHEN** 訪 `/admin/appointments?view=calendar`
- **THEN** 顯示行事曆視圖；toggle 高亮「行事曆」

#### Scenario: query=list 顯式指定

- **WHEN** 訪 `/admin/appointments?view=list`
- **THEN** 顯示列表視圖

#### Scenario: 非法 view 值降級

- **WHEN** 訪 `/admin/appointments?view=unknown`
- **THEN** 視為 `calendar`（預設值），不報錯

#### Scenario: 舊 `/admin/appointments/calendar` 路由相容

- **WHEN** 訪 `/admin/appointments/calendar`（或從外部書籤連入）
- **THEN** 自動以 `router.replace` 導向 `/admin/appointments?view=calendar`

#### Scenario: filter 在兩視圖間共用

- **GIVEN** 商家在列表視圖設定 filter `dateFrom=2026-05-20 & status=CONFIRMED & serviceId=s1`
- **WHEN** 點擊 toggle 切換到行事曆
- **THEN** 行事曆以同樣的 dateFrom / dateTo / status / serviceId 範圍載資料；切回列表後 filter 仍保留

### Requirement: 預約管理頁的代客預約三入口

`/admin/appointments` 頁 SHALL 在行事曆與列表兩種視圖都提供「代客預約」按鈕；行事曆視圖額外 SHALL 支援點擊空白時段格直接打開代客預約 Dialog 並預填日期 / 時段；列表視圖維持現狀（僅右上角按鈕）。

#### Scenario: 列表視圖右上角代客預約按鈕

- **GIVEN** 商家在 `/admin/appointments?view=list`
- **WHEN** 點擊 header 右上角「代客預約」
- **THEN** 開啟 `DialogAppointmentCreate`，未預填任何欄位（既有行為）

#### Scenario: 行事曆視圖右上角代客預約按鈕

- **GIVEN** 商家在 `/admin/appointments?view=calendar`
- **WHEN** 點擊 header 右上角「代客預約」
- **THEN** 開啟 `DialogAppointmentCreate`，未預填任何欄位

#### Scenario: 點行事曆空白格預填日期

- **GIVEN** 行事曆週視圖、2026-05-22 該欄位有未被佔用且非休假的空檔
- **WHEN** 點擊 2026-05-22 該欄位的空白區域
- **THEN** 開啟 `DialogAppointmentCreate`，`prefillDate='2026-05-22'`；Dialog 內日期欄已自動填入

#### Scenario: 日視圖點空檔預填日期 + 時段

- **GIVEN** 行事曆日視圖，2026-05-22 14:00 該 hour 格為空檔
- **WHEN** 點擊 14:00 該 hour 格
- **THEN** 開啟 Dialog 並 `prefillDate='2026-05-22', prefillStartAt='2026-05-22T06:00:00.000Z'`（對應 14:00 +08:00）；選完 service 後該時段的 slot 自動高亮為 active

#### Scenario: 點到不可營業時段不開 Dialog

- **GIVEN** 2026-05-22 為整店休假日
- **WHEN** 點擊該日任一格
- **THEN** 不開啟 Dialog；hover 時 cursor 為 default，並可顯示 tooltip「本日為休假日」

#### Scenario: 點到已被預約的格

- **GIVEN** 2026-05-22 14:00 有一筆 CONFIRMED 預約卡片
- **WHEN** 點擊該預約卡片
- **THEN** 開啟既有 `DrawerAppointmentInfo`（既有行為），**不**開代客預約 Dialog

#### Scenario: Dialog 預填 startAt 但時段不可選

- **GIVEN** Dialog 以 `prefillStartAt='2026-05-22T06:00:00.000Z'` 開啟，選完 service 後該 startAt 對應的 slot `reason='taken'`
- **WHEN** Dialog 載入 slots
- **THEN** 該 slot 顯示為不可選狀態（badge + tooltip）；Dialog 頂部顯示提示「您選的 14:00 時段目前不可用：已被預約」；使用者可選其他可用 slot

### Requirement: 行事曆視圖空白格與不可營業時段視覺區分

`BizAppointmentCalendar` 元件 SHALL 對「可建立的空檔」「已被預約」「不可營業時段（holiday / closed / 排班外）」三種狀態給出視覺上明確區分。

#### Scenario: 可建立空檔

- **GIVEN** 某時段格無預約、屬營業時間
- **WHEN** 元件渲染
- **THEN** 該格底色為淺白色；hover 時顯示高亮邊框與「+ 代客預約」icon；cursor 為 pointer

#### Scenario: 不可營業時段顯示斜紋

- **GIVEN** 該日為 MerchantHoliday 或 ScheduleOverride.isClosed
- **WHEN** 元件渲染
- **THEN** 該日整欄（週視圖）或整欄該 hour（日視圖）顯示為斜紋背景（`repeating-linear-gradient`）；cursor 為 default；無 hover 高亮

#### Scenario: 排班外時段（無 ScheduleRule 覆蓋）

- **GIVEN** 某 hour 不在任何 ScheduleRule 範圍內
- **WHEN** 元件渲染
- **THEN** 同「不可營業時段」斜紋背景處理

#### Scenario: 已被預約卡片

- **GIVEN** 某 slot 有 CONFIRMED 預約
- **WHEN** 元件渲染
- **THEN** 顯示預約卡片（含顧客 lastName、服務、開始時間）；點擊開啟 `DrawerAppointmentInfo`（既有行為）

### Requirement: 代客預約 Dialog 接受 prefill 參數

`OpenDialogAppointmentCreate` SHALL 接受 optional `prefillDate / prefillStartAt / prefillServiceId / prefillResourceId` 參數，於 Dialog 開啟時自動填入對應欄位；若 prefill 涉及 slot（`prefillStartAt`），SHALL 在 slot 載入後自動 active 並在頂部顯示「您點選的時段」提示。

#### Scenario: 僅 prefillDate

- **WHEN** 以 `{ slug, prefillDate: '2026-05-22' }` 開啟
- **THEN** 日期欄填入 2026-05-22；service / resource / startAt 仍待使用者選

#### Scenario: prefillDate + prefillStartAt + 該 slot 可選

- **WHEN** 以 `{ slug, prefillDate: '2026-05-22', prefillStartAt: '2026-05-22T06:00:00.000Z' }` 開啟、使用者後續選了 service 致 slot 載入、該 startAt 的 slot `reason=undefined`
- **THEN** 該 slot 自動 active（form.startAt 設為此值）；Dialog 頂部顯示「您點選的 14:00 已選中，請繼續填寫顧客資訊」

#### Scenario: prefillDate + prefillStartAt + 該 slot 不可選

- **GIVEN** 同上但 slot 載入後 `reason='taken'`
- **WHEN** Dialog 載完 slots
- **THEN** 該 slot 顯示為不可選狀態；form.startAt 維持空；Dialog 頂部顯示警示「您點選的 14:00 已被預約，請選其他時段」（黃色 alert）

#### Scenario: prefillServiceId 對應 RESOURCE 模式

- **WHEN** 以 `{ slug, prefillServiceId: 's-resource', prefillResourceId: 'r1' }` 開啟
- **THEN** service 與 resource 都自動填入；slot 自動載入

#### Scenario: prefillServiceId 為 QUEUE 模式（不合法）

- **WHEN** prefillServiceId 對應的 service `bookingMode='QUEUE'`
- **THEN** Dialog 載入後該 service 不出現在下拉（既有過濾邏輯）；form.serviceId 不設值；顯示提示「此服務不支援預約，請選擇其他服務」

### Requirement: 不可選時段顯示明確 reason 標示

`OpenDialogAppointmentCreate` 與 `BizAppointmentCalendar` 兩處 SHALL 在不可選 slot / 不可點格上顯示對應 reason 的本地化文字（badge + tooltip），並 SHALL 用視覺上與正常 slot 明顯不同的樣式區分。

#### Scenario: Dialog slot 顯示 reason badge

- **GIVEN** slot `reason='taken'`
- **WHEN** Dialog 渲染該 slot
- **THEN** button 顯示為淡灰底 + 中文字「14:00 · 已被預約」；hover 顯示完整 tooltip「此時段已被其他顧客預約」；`disabled=true`

#### Scenario: Dialog slot 顯示已過

- **GIVEN** slot `reason='past'`（startAt 在 now 之前）
- **WHEN** Dialog 渲染該 slot
- **THEN** button 為灰底 + 「09:00 · 已過」；hover tooltip「此時段已過，無法預約」

#### Scenario: Dialog slot 顯示已額滿（TIME_CAPACITY）

- **GIVEN** slot `reason='capacity'`
- **WHEN** Dialog 渲染
- **THEN** button 為「10:00 · 已額滿（10/10）」；hover tooltip「此時段名額已滿」

#### Scenario: Dialog 提供 i18n 切換

- **GIVEN** 使用者 locale 切換至 `en`
- **WHEN** Dialog 重新渲染同個 reason='taken' slot
- **THEN** 文字改為「14:00 · Booked」；tooltip 為英文版

#### Scenario: 行事曆斜紋格 tooltip

- **GIVEN** 2026-05-22 為 MerchantHoliday
- **WHEN** hover 該日欄位
- **THEN** tooltip 顯示「本日休假」（取自 MerchantHoliday.name 或 i18n 預設）
