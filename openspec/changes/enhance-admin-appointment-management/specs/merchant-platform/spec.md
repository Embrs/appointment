## MODIFIED Requirements

### Requirement: 預約管理頁採同頁 toggle、預設行事曆

`/admin/appointments` SHALL 在同一個頁面內提供「行事曆 / 列表」兩種視圖切換，初次造訪 SHALL 預設停在行事曆視圖；視圖狀態 SHALL 透過 URL query `view=calendar | list` 持久化以便重整與分享連結時保留。

兩個視圖各自維護獨立的篩選 UI：**列表視圖**提供完整 filter（日期區間／狀態下拉／服務／資源／手機／分頁），**行事曆視圖**僅提供精簡 filter（服務／資源／隱藏已取消 switch），日期範圍由行事曆的「週／日 + prev/next／今天」導覽控制，不再共用 filter 物件。切換視圖時各自的篩選狀態彼此獨立。

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

#### Scenario: 兩視圖篩選獨立

- **GIVEN** 商家在列表視圖設定 `dateFrom=2026-05-20 & status=CONFIRMED & customerPhone=0987...`
- **WHEN** 點擊 toggle 切換到行事曆
- **THEN** 行事曆視圖**不**套用列表的 dateFrom / status / customerPhone，而是套用自己的服務／資源篩選與週導覽範圍
- **AND** 切回列表後列表的 filter 仍保留

### Requirement: 列表操作欄收斂為「詳細」單一入口

`BizAppointmentTable` 的「操作」欄 SHALL 主要動作只保留一個 link button：「詳細」。點擊「詳細」 SHALL 開啟 `OpenDrawerAppointmentInfo`，由抽屜內部統一提供「取消預約／標記完成／標記未到／修改預約」等狀態操作（顯示與否由 `Decision: DrawerAppointmentInfo 為操作中樞` 規範）。

操作欄寬度 SHALL 設為 120px 且 `fixed="right"`，確保不換行且滑動表格時仍可見。原本的「更多 ▾」下拉 SHALL 移除。

#### Scenario: 任一狀態都只顯示「詳細」按鈕

- **GIVEN** 列表載入多筆預約，狀態涵蓋 `CONFIRMED / CANCELED / COMPLETED / NO_SHOW`
- **WHEN** 觀察每列的操作欄
- **THEN** 每列只顯示一顆「詳細」link button，不再有「更多 ▾」下拉

#### Scenario: 點「詳細」開啟操作抽屜

- **GIVEN** 列表有一筆 CONFIRMED 預約
- **WHEN** 點擊「詳細」
- **THEN** 開啟 `OpenDrawerAppointmentInfo`，顯示完整預約資訊並於 footer 顯示對應該狀態的操作按鈕

#### Scenario: 操作欄不換行

- **GIVEN** 列表載入完成，視窗寬度 >= 1280px
- **WHEN** 觀察任一列操作欄
- **THEN** 「詳細」於 120px 欄寬內單行呈現，不換行

### Requirement: 商家預約列表狀態流轉操作

商家後台預約管理 SHALL 對 `CONFIRMED` 狀態的預約提供「取消預約／標記完成／標記未到／修改預約」四種操作，操作 UI **統一由 `OpenDrawerAppointmentInfo` 提供**（不再透過列表「更多」下拉或行事曆 hover 選單）。抽屜 footer 須依下列規則決定按鈕可見性：

- `status = CONFIRMED` 且 `startAt > now`：顯示「取消預約」「修改預約」
- `status = CONFIRMED` 且 `startAt <= now`（含過號）：顯示「取消預約」「修改預約」「標記完成」「標記未到」
- `status ∈ {CANCELED, COMPLETED, NO_SHOW}`：四顆按鈕全部不顯示，僅可瀏覽資訊

#### Scenario: 未到時間的 CONFIRMED 顯示兩顆按鈕

- **GIVEN** 預約 startAt 為明日 14:00、status=CONFIRMED
- **WHEN** 點擊列表「詳細」或行事曆 chip 開啟抽屜
- **THEN** 抽屜 footer 顯示「取消預約」「修改預約」兩顆按鈕，「標記完成」「標記未到」不顯示

#### Scenario: 已過時間的 CONFIRMED 顯示四顆按鈕

- **GIVEN** 預約 startAt 為昨日 14:00、status=CONFIRMED（過號未處理）
- **WHEN** 開啟抽屜
- **THEN** footer 顯示「取消預約」「標記未到」「標記完成」「修改預約」四顆按鈕

#### Scenario: 已結案預約只能瀏覽

- **GIVEN** 預約 status 為 CANCELED / COMPLETED / NO_SHOW 任一
- **WHEN** 開啟抽屜
- **THEN** footer 不顯示任何操作按鈕；抽屜仍可關閉與滾動瀏覽資訊

#### Scenario: 點擊取消預約

- **WHEN** 在抽屜內點擊「取消預約」
- **THEN** 開啟 `DialogCancelReason` 取得理由 → 呼叫 `CancelAppointment` → 成功後關閉抽屜並重新載入列表／行事曆

#### Scenario: 點擊標記完成有二次確認

- **WHEN** 在抽屜內點擊「標記完成」
- **THEN** 跳 `ElMessageBox.confirm`「確定將此預約標記為已完成？」，確認後呼叫 `CompleteAppointment`；取消則不動

#### Scenario: 點擊標記未到有二次確認

- **WHEN** 在抽屜內點擊「標記未到」
- **THEN** 跳 `ElMessageBox.confirm`「確定將此預約標記為未到？」，確認後呼叫 `NoShowAppointment`

#### Scenario: 點擊修改預約

- **WHEN** 在抽屜內點擊「修改預約」
- **THEN** 開啟 `DialogAppointmentReschedule` 並帶入當前 appointment；Dialog 完成後關閉抽屜並重新載入

#### Scenario: 操作後即時刷新

- **GIVEN** 任一狀態操作 API 成功
- **WHEN** 後端回 success response
- **THEN** 抽屜關閉、列表 / 行事曆 重新 `ApiLoad`，顯示更新後狀態

#### Scenario: 抽屜 footer 響應式佈局

- **GIVEN** 抽屜內顯示 4 顆操作按鈕（已過時間的 CONFIRMED）
- **WHEN** 視窗寬度 >= 480px
- **THEN** 4 顆按鈕水平排列於 footer 單列
- **WHEN** 視窗寬度 < 480px
- **THEN** 4 顆按鈕以 2×2 grid 排列，避免擠壓或溢出

## ADDED Requirements

### Requirement: 行事曆視圖篩選器精簡

`/admin/appointments?view=calendar` 的篩選 UI SHALL 僅提供三個有意義的控制項：

1. **服務（serviceId）**：`ElSelect` clearable，列出當前商家全部服務
2. **資源（resourceId）**：`ElSelect` clearable，列出當前商家全部資源
3. **隱藏已取消**：`ElSwitch`，預設為 ON（隱藏 CANCELED 預約）；OFF 時顯示全部狀態

SHALL **移除**以下控制項（在行事曆視圖不再顯示）：日期區間（dateFrom / dateTo）、狀態下拉（status）、手機（customerPhone）、分頁（page / pageSize）。

行事曆 view 的資料載入範圍 SHALL 由「週／日 + anchor」自動決定（週視圖：anchor 所在 ISO 週的週一至週日；日視圖：anchor 當日前後各 1 天緩衝）。

#### Scenario: 行事曆視圖只顯示三個篩選

- **GIVEN** 商家在 `/admin/appointments?view=calendar`
- **WHEN** 渲染頁面
- **THEN** 篩選列僅顯示「服務」「資源」「隱藏已取消」三個控制項，且預設「隱藏已取消」為 ON

#### Scenario: 切換隱藏已取消顯示 CANCELED

- **GIVEN** 行事曆內含 CONFIRMED、CANCELED 各一筆於同一時段格
- **WHEN** 「隱藏已取消」switch 為 ON
- **THEN** 行事曆只顯示 CONFIRMED chip
- **WHEN** switch 切為 OFF
- **THEN** CANCELED chip 也顯示（樣式維持灰色／刪除線等視覺區分）

#### Scenario: 服務／資源篩選即時生效

- **GIVEN** 行事曆顯示多筆預約
- **WHEN** 選擇「服務 = 健康檢查」
- **THEN** 行事曆只保留該服務的 chip；clear 後恢復全部

#### Scenario: 列表視圖維持完整篩選

- **GIVEN** 商家在 `/admin/appointments?view=list`
- **WHEN** 渲染
- **THEN** 篩選列仍顯示完整欄位（日期區間／狀態／服務／資源／手機／查詢／重設）

### Requirement: 行事曆視圖週起點對齊 ISO 週一

`BizAppointmentCalendar` 與 `/admin/appointments` 行事曆視圖 SHALL 將週視圖的起始日對齊到 anchor 所在的 **ISO 週一**（即 `dayjs(anchor).startOf('isoWeek')`），無論 anchor 落在週幾，週視圖永遠顯示「週一 → 週日」共 7 天。

「上一週」「下一週」按鈕 SHALL 以 7 天為步進，且因 anchor 永遠對齊週一，結果永遠是相鄰週的週一。

「今天」按鈕 SHALL 將 anchor 設為「今日所在週的週一」，而非單純設為今天。

日視圖不受影響，anchor 為當日，prev/next ±1 天。

#### Scenario: 首次進入顯示本週週一到週日

- **GIVEN** 今日為 2026-05-20（週三）、行事曆模式為 week
- **WHEN** 商家進入 `/admin/appointments`
- **THEN** 行事曆 7 個欄位依序為 05/18（週一）、05/19（週二）、05/20（週三）、05/21（週四）、05/22（週五）、05/23（週六）、05/24（週日）

#### Scenario: 點「上一週」跳到上週週一

- **GIVEN** 行事曆顯示 2026-05-18 ~ 2026-05-24 的週一到週日
- **WHEN** 點擊「← 上一週」
- **THEN** 行事曆顯示 2026-05-11 ~ 2026-05-17（上週週一到週日）

#### Scenario: 點「下一週」跳到下週週一

- **GIVEN** 同上初始狀態
- **WHEN** 點擊「下一週 →」
- **THEN** 行事曆顯示 2026-05-25 ~ 2026-05-31

#### Scenario: 點「今天」對齊本週週一

- **GIVEN** 商家在 2026-05-20（週三）瀏覽行事曆於下下週（2026-06-01 ~ 06-07）
- **WHEN** 點擊「今天」
- **THEN** 行事曆跳回 2026-05-18 ~ 2026-05-24（今日所在週的週一到週日）

#### Scenario: anchor query 非週一自動 normalize

- **GIVEN** 商家透過外部連結進入 `/admin/appointments?anchor=2026-05-20`（週三，非週一）
- **WHEN** 行事曆初始化
- **THEN** anchor 自動 normalize 為 2026-05-18（該週週一）；顯示 05/18 ~ 05/24

#### Scenario: 日視圖不受影響

- **GIVEN** 行事曆模式為 day、anchor 為 2026-05-20
- **WHEN** 點擊「下一日 →」
- **THEN** anchor 變為 2026-05-21（單純 +1 天，不對齊週一）

### Requirement: 行事曆 chip 點擊統一進入操作抽屜

`BizAppointmentCalendar` 的 chip 點擊事件 SHALL 統一 emit `click-cell`，由父頁面 `/admin/appointments` 開啟 `OpenDrawerAppointmentInfo`。chip 本身 SHALL 不直接提供取消／完成／未到／修改預約的內嵌按鈕（保留視覺簡潔），所有操作均在抽屜內完成。

#### Scenario: 點擊行事曆 chip 開啟抽屜

- **GIVEN** 行事曆某格有一筆 CONFIRMED 預約 chip
- **WHEN** 點擊該 chip
- **THEN** 開啟 `OpenDrawerAppointmentInfo` 並 footer 顯示對應狀態的操作按鈕

#### Scenario: 抽屜內操作後行事曆即時更新

- **GIVEN** 商家在抽屜內成功標記某預約為「完成」
- **WHEN** 抽屜關閉
- **THEN** 行事曆重新載入；該 chip 的左側 status border 顏色改為綠色（COMPLETED 對應色），或於「隱藏已取消」OFF 時仍顯示

### Requirement: 修改預約 API 端點

系統 SHALL 提供 `POST /nuxt-api/appointment/[id]/reschedule` 端點，允許已登入商家修改 `CONFIRMED` 狀態預約的開始時間與資源指派，**不變更**狀態（仍為 CONFIRMED）也**不通知顧客**。

**Request body 結構：**
- `startAt: string`（ISO 8601 UTC，必填）
- `resourceId?: string | null`（選填；不帶時 RESOURCE 模式維持原資源、TIME_SLOT/TIME_CAPACITY 強制為 null、RESOURCE_OPTIONAL 視同 null 不指定）
- `force?: boolean`（選填，預設 false；true 時允許 startAt < now 並跳過資源排班檢查）

**業務規則：**
- 認證：`requireMerchant(event)`；只能改自家預約（跨商家回 404）
- 狀態守衛：只有 CONFIRMED 可 reschedule（其他狀態回 422 + `MSG_APPOINTMENT_NOT_CONFIRMED`）
- 模式守衛：依 `service.bookingMode` 判斷 resourceId 帶法
- 時間守衛：`force=false` 時拒絕 startAt < now（回 `MSG_PAST_SLOT`）
- 衝突檢查（事務內）：取 `acquireAdvisoryLock`、查重疊預約（**排除自身**、status=CONFIRMED）、TIME_CAPACITY 重檢容量
- 排班檢查：`force=false` 時必須通過 `isResourceOnDutyAt`；`force=true` 跳過
- 更新欄位：`startAt / endAt(=startAt + service.durationMinutes) / resourceId`
- 回傳：更新後的 appointment（同 GetAppointmentList item shape）

#### Scenario: 改時間成功

- **GIVEN** 商家已登入、預約 status=CONFIRMED、bookingMode=TIME_SLOT
- **WHEN** POST `/reschedule` body `{ startAt: '2026-05-22T01:00:00Z' }`（force 未帶，新時段在未來且無衝突）
- **THEN** 後端事務內取 lock、檢查無衝突 → 更新 startAt/endAt → 回 `successResponse(updatedAppointment)`

#### Scenario: 改資源成功（RESOURCE 模式）

- **GIVEN** 預約 service.bookingMode=RESOURCE、目前 resourceId=R1
- **WHEN** POST `/reschedule` body `{ startAt, resourceId: 'R2' }`（R2 綁定該服務且該時段未被佔用）
- **THEN** 更新成功，resourceId 改為 R2

#### Scenario: 過去時段不帶 force 拒絕

- **GIVEN** 商家送出 startAt 為昨日 14:00、未帶 force
- **WHEN** 後端驗證
- **THEN** 回 400 `MSG_PAST_SLOT`

#### Scenario: 過去時段帶 force 允許

- **GIVEN** 商家送 startAt 為昨日 14:00、force=true、該時段資源未被其他預約佔用
- **WHEN** 後端處理
- **THEN** 跳過 `MSG_PAST_SLOT` 與排班檢查 → 更新成功

#### Scenario: force 仍阻擋雙開

- **GIVEN** 商家送 startAt 與其他 CONFIRMED 預約完全重疊、即使 force=true
- **WHEN** 後端衝突檢查
- **THEN** 回 409 `MSG_SLOT_TAKEN`，不更新

#### Scenario: 衝突檢查排除自身

- **GIVEN** 預約 A 原 startAt=10:00 endAt=11:00
- **WHEN** POST `/reschedule` body `{ startAt: '10:30' }`（與自身 A 部分重疊但無其他預約衝突）
- **THEN** 後端 SQL `where: { id: { not: A.id }, ...overlap }` 不會把 A 算進去 → 視為無衝突 → 更新成功

#### Scenario: 非 CONFIRMED 拒絕

- **GIVEN** 預約 status=CANCELED / COMPLETED / NO_SHOW
- **WHEN** POST `/reschedule`
- **THEN** 回 422 `MSG_APPOINTMENT_NOT_CONFIRMED`

#### Scenario: 跨商家越權拒絕

- **GIVEN** 商家 A 已登入、預約屬於商家 B
- **WHEN** POST `/reschedule`
- **THEN** 回 404 `MSG_APPOINTMENT_NOT_FOUND`

#### Scenario: 未登入拒絕

- **WHEN** 無 token 呼叫 `/reschedule`
- **THEN** `requireMerchant` 回 401

#### Scenario: TIME_SLOT 模式拒絕帶 resourceId

- **GIVEN** service.bookingMode=TIME_SLOT
- **WHEN** body 帶 `resourceId: 'R1'`
- **THEN** 回 400 `MSG_RESOURCE_NOT_ALLOWED`

#### Scenario: RESOURCE 模式 resourceId 必須綁定該服務

- **GIVEN** service.bookingMode=RESOURCE、R2 未綁定該 service
- **WHEN** body `{ resourceId: 'R2' }`
- **THEN** 回 400 `MSG_RESOURCE_NOT_LINKED`

#### Scenario: 並發競態保護

- **GIVEN** 商家在兩個瀏覽器分頁同時點「修改預約」，送出衝突的目標時段
- **WHEN** 兩 request 同時抵達
- **THEN** advisory lock 串行化處理；先到者成功，後到者依衝突檢查回 409 或被 lock 等待後依新狀態判定

### Requirement: 修改預約 Dialog（DialogAppointmentReschedule）

`app/components/open/dialog/appointment-reschedule.vue` SHALL 提供商家修改既有預約時間與資源的對話框，由 `OpenDrawerAppointmentInfo` 的「修改預約」按鈕開啟。

**Dialog 內容：**
- 顯示原預約摘要（服務名、原時間 startAt ~ endAt、原資源）作為對照
- 「新日期」`ElDatePicker`，可選任何日期（含過去日）
- 「新時段」：force=false 時用 `BizSlotPicker` 載入該日可用時段；force=true 時顯示 `ElTimePicker`（自由輸入）
- 「新資源」依 `service.bookingMode` 顯示：
  - TIME_SLOT / TIME_CAPACITY：隱藏資源欄位
  - RESOURCE：`ElSelect`，必選；只列出綁定此服務的資源
  - RESOURCE_OPTIONAL：`ElSelect`，可選「不指定」或綁定資源
- 「過號補登」`ElCheckbox`，預設關閉；勾選後變更時段選擇器為自由 `ElTimePicker`，並提示「允許選已過時段、跳過班表檢查；仍會檢查衝突」
- 確認按鈕：呼叫 `RescheduleAppointment`；失敗回顯三語錯誤訊息

**手機響應式：**
- < 480px 寬度時 Dialog 改用全寬展開、欄位垂直堆疊，按鈕鋪滿底部

#### Scenario: 開啟 Dialog 顯示原預約資訊

- **GIVEN** 抽屜中 CONFIRMED 預約 A（健康檢查、王醫師、2026-05-22 14:00）
- **WHEN** 點擊「修改預約」
- **THEN** Dialog 開啟，顯示「原時間：2026-05-22 14:00 ~ 14:30 ｜健康檢查｜王醫師」作為對照，且日期/時段/資源欄位預填原值

#### Scenario: 改新日期重新載入時段

- **GIVEN** Dialog 開啟、原日期 2026-05-22
- **WHEN** 將日期改為 2026-05-23
- **THEN** `BizSlotPicker` 重新拉 `/public/availability` 載入 05-23 的可用 slot

#### Scenario: TIME_SLOT 模式隱藏資源欄位

- **GIVEN** service.bookingMode=TIME_SLOT
- **WHEN** Dialog 渲染
- **THEN** 不顯示「新資源」欄位

#### Scenario: RESOURCE_OPTIONAL 模式可選不指定

- **GIVEN** service.bookingMode=RESOURCE_OPTIONAL、目前 resourceId=R1
- **WHEN** Dialog 渲染資源下拉
- **THEN** 選項包含「不指定」與綁定該服務的所有資源；目前選中為 R1

#### Scenario: 啟用過號補登切換時段選擇器

- **GIVEN** Dialog 開啟、force checkbox 為 OFF、新時段顯示 `BizSlotPicker`
- **WHEN** 勾選「過號補登」
- **THEN** 時段選擇器改為 `ElTimePicker`，並顯示提示「允許選已過時段、跳過班表檢查」
- **AND** 確認送出時 body 帶 `force: true`

#### Scenario: 過去時段未啟用 force 顯示明確錯誤

- **GIVEN** Dialog force=OFF、使用者強行送出昨日時段
- **WHEN** 後端回 400 `MSG_PAST_SLOT`
- **THEN** Dialog 顯示錯誤「時段已過，請啟用『過號補登』」並一鍵勾選 force 重送（或保留使用者重試）

#### Scenario: 確認成功關閉 Dialog 並刷新

- **GIVEN** 使用者填入合法新時間
- **WHEN** 點擊「確認修改」、API 回 success
- **THEN** Dialog 關閉、上層抽屜也關閉、頁面 ApiLoad 重新載入

#### Scenario: 手機版響應式

- **GIVEN** 視窗寬度為 375px
- **WHEN** Dialog 開啟
- **THEN** Dialog 改為全寬、欄位垂直堆疊、確認/取消鈕鋪滿底部，不出現水平捲動

### Requirement: Reschedule Protocol bindings

`app/protocol/fetch-api/api/appointment/` SHALL 提供 `RescheduleAppointment({ id, startAt, resourceId?, force? })` 的 ApiCall，回傳標準 `ApiResponse<{ appointment: AppointmentItem }>`。type 定義須同步補入 `type.d.ts`、mock 須補入 `mock.ts`。

#### Scenario: TypeScript 型別正確

- **WHEN** Vue 組件呼叫 `$api.RescheduleAppointment({ id, startAt, resourceId: null, force: true })`
- **THEN** 編譯時 `res.data.appointment.status` 推斷為 `AppointmentStatus`、`res.data.appointment.id` 推斷為 `string`

#### Scenario: 測試模式走 mock

- **GIVEN** `useRuntimeConfig().public.testMode === 'T'`
- **WHEN** 呼叫 `RescheduleAppointment`
- **THEN** 回 `mock.RescheduleAppointment()` 假資料，不打真實後端
