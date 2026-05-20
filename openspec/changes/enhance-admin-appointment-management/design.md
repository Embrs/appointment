## Context

商家後台預約管理已有「行事曆 / 列表」雙視圖（`/admin/appointments?view=calendar|list`），共用 `BizPageHeader` 與一個完整 filter 列。實作上：

- **filter** 在行事曆視圖大多失效：`status` 強制忽略、`page` 用不到、`customerPhone` 無意義；只有 `dateFrom/dateTo` 與 `serviceId/resourceId` 真正會作用。視覺上仍呈現出所有欄位，造成使用者誤以為可用。
- **`calendarAnchor`** 預設 = `filter.dateFrom`（即「今天」）。「上一週／下一週」是 `anchor ± 7` 天，導致週起點永遠不會對齊到週一。
- **狀態操作**：`AppointmentTable` 已支援「取消／完成／未到」三個動作，全部走 `ClickCancel/ClickComplete/ClickNoShow`；`AppointmentCalendar` 的 chip 點擊只 emit `click-cell` → 開 `DrawerAppointmentInfo`，抽屜內目前只有「商家取消」一顆按鈕。
- **修改預約**：**完全沒有**對應的 API（`server/routes/nuxt-api/appointment/[id]/` 僅有 `cancel.post.ts / complete.post.ts / no-show.post.ts`）與前端 UI。
- **`server/utils/booking.ts`** 提供 `createAppointment(input)` 核心函式，內含 advisory lock、容量重檢、`BookingMode` 分流；reschedule 可大量複用，但需排除「自身 appointment」的衝突檢查。

**前台 `BizServiceCard`**：價格區塊 `priceCents == null` 才隱藏，導致 `priceCents = 0` 仍顯示 `NT$ 0`；時長只 render 純數字 `{{ service.durationMinutes }}`，沒有單位。

`Prisma schema` 中 `Appointment` 已有 `startAt / endAt / resourceId` 等所有 reschedule 需要的欄位，本次**不動 schema**。

## Goals / Non-Goals

**Goals:**
- 行事曆視圖篩選器只保留有意義的三項：服務 / 資源 / 隱藏已取消（switch）
- 行事曆週起點對齊週一（ISO 週一為週首），「今天」按鈕也對齊週一
- 行事曆與列表共用同一個 `DrawerAppointmentInfo` 作為操作中樞，含 4 個動作（取消／完成／未到／修改預約）
- 新增 `POST /nuxt-api/appointment/[id]/reschedule` 後端端點與 `DialogAppointmentReschedule` 前端共用 Dialog
- Reschedule 支援改時間（含過去時段）與改資源（僅 RESOURCE / RESOURCE_OPTIONAL）
- 前台 ServiceCard 價格 `<= 0` 不顯示；時長補上多語單位
- DrawerAppointmentInfo / DialogAppointmentReschedule 響應式適配手機（< 480px）

**Non-Goals:**
- 不變更 Prisma schema（不新增變更歷程欄位）
- 不發送顧客通知（簡訊／Email），保留未來擴充空間
- 不支援拖拉式 reschedule（drag-and-drop）
- 不支援批次操作（多選後一次標完成／未到）
- 不調整 QUEUE 流程（QUEUE 不進 Appointment 表，本次無關）
- 不調整 `customer-booking` 顧客自助取消／查詢／建立流程
- 不調整既有取消／完成／未到 API 行為

## Decisions

### Decision 1：行事曆篩選器精簡而非完全移除

**選擇：精簡保留服務 / 資源 / 隱藏已取消 switch（即 Q1=B）**

理由：
- 多醫師／多資源診所場景下「只看王醫師」「只看補牙服務」是高頻需求，完全移除會回不來
- 「隱藏已取消」用 switch 比 status 下拉直覺（行事曆視圖預設應顯示 CONFIRMED + COMPLETED + NO_SHOW，預設隱藏 CANCELED）
- 日期區間由「週 / 日 + prev/next」導覽控制，避免兩套日期語意打架

**Alternatives considered：**
- A：完全移除 → 拒絕，多醫師場景不夠用
- C：保留全部 → 拒絕，違反需求 ①

**篩選器與資料載入耦合：**
- `ApiLoad()` 仍按 `view` 分流：行事曆視圖傳 `dateFrom = anchorWeekMonday, dateTo = anchorWeekSunday`（日視圖則前後各 1 天緩衝），列表視圖維持完整 filter
- 「隱藏已取消」switch → 行事曆視圖只在前端 `items` 過濾 `status !== 'CANCELED'`，避免重打 API

### Decision 2：週起點以 ISO 週一為基準

**選擇：`anchorWeekMonday = $dayjs(anchorDate).startOf('isoWeek')`**

理由：
- 台灣／日本／英文圈普遍使用「週一到週日」作為一週起點（dayjs 的 `isoWeek` 插件即此語意）
- `startOf('week')` 在 dayjs 預設 locale 是週日，需切換到 `isoWeek` 取得週一
- 「今天」按鈕語意：跳到「今天所在的那一週」（週一），而非 anchor = today
- prev/next 步進固定 ±7 天，但因 anchor 永遠是某個週一，所以結果仍是相鄰週的週一

**Alternatives considered：**
- `dayjs.locale('zh-tw')` + `startOf('week')` → 不可靠，locale 在不同地方可能被覆寫；用 `isoWeek` 明確
- 自己手算 `anchor.day() === 0 ? -6 : 1 - anchor.day()` → 可行但易讀性差

**Day 模式不受影響**：日視圖 anchor 仍是單日，prev/next ±1 天。

### Decision 3：以 DrawerAppointmentInfo 作為操作中樞（Q2=A）

**選擇：列表與行事曆都點開同一個抽屜，所有狀態操作集中在抽屜 footer**

理由：
- 單一真實來源：取消／完成／未到／修改預約四個動作只需在抽屜內維護一次
- 列表「更多 ▾」下拉刪除（保留「詳細」即可，因為詳細就是入口）→ 大幅簡化 `AppointmentTable` 的操作邏輯
- 抽屜本身就是「看詳情」+「採取行動」的天然位置

**抽屜 footer 響應式佈局：**
```
桌機 (>= 480px)：水平 4 顆按鈕
┌──────────────────────────────────────────────┐
│ [取消預約] [標記未到] [標記完成] [修改預約] │
└──────────────────────────────────────────────┘

手機 (< 480px)：2×2 grid
┌────────────────────────┐
│ [取消預約] [標記未到]  │
│ [標記完成] [修改預約]  │
└────────────────────────┘
```

**按鈕顯示邏輯（與既有列表「更多」相同）：**
- `CONFIRMED` 且未到開始時間：只顯示「取消預約」「修改預約」
- `CONFIRMED` 且已到開始時間：四顆全顯示
- `CANCELED / COMPLETED / NO_SHOW`：只顯示「修改預約」（允許救回過號）—— 注意：CANCELED 不可 reschedule（語意上已死），故僅 `COMPLETED / NO_SHOW` 顯示
  - **修正**：所有非 CONFIRMED 狀態下，「取消／完成／未到」按鈕皆不顯示。「修改預約」只在 `CONFIRMED` 顯示（含過號的 CONFIRMED）

**Alternatives considered：**
- B：chip hover 快捷選單 → 拒絕，手機無 hover，且選單會擋到鄰格
- C：chip 右鍵選單 → 拒絕，行動端無右鍵

### Decision 4：Reschedule API 設計

**端點：** `POST /nuxt-api/appointment/[id]/reschedule`

**Request body：**
```ts
{
  startAt: string;        // ISO 8601 UTC
  resourceId?: string | null;  // 改資源時帶；不帶 = 維持原資源
  force?: boolean;        // true = 允許過去時段（過號補登）
}
```

**Response (success)：** 回傳更新後的 appointment（同 GetAppointmentList item shape）

**核心邏輯：**
1. 認證：`requireMerchant(event)` → 取得 merchantId
2. 載入 appointment：`prisma.appointment.findUnique({ where: { id, merchantId } })`；404 / 403 處理
3. 狀態守衛：只有 `CONFIRMED` 可 reschedule（其他狀態 return 422）
4. 計算 `endAt = startAt + service.durationMinutes`
5. 模式守衛：
   - `TIME_SLOT / TIME_CAPACITY`：拒絕帶 `resourceId`
   - `RESOURCE`：必須帶 `resourceId`（不帶就用原 resourceId）
   - `RESOURCE_OPTIONAL`：可帶可不帶（null = 不指定資源）
6. 過去時段：`force === true` 才允許 `startAt < now`；否則 return `MSG_PAST_SLOT`
7. **事務內：**
   - `acquireAdvisoryLock`（同 `createAppointment` 使用的 key）
   - 衝突檢查：`prisma.appointment.findMany({ where: { ...overlap, id: { not: appointmentId }, status: 'CONFIRMED' } })` —— **排除自己**
   - 容量重檢（TIME_CAPACITY 模式）
   - 資源排班檢查：`isResourceOnDutyAt(resourceId, startAt)` —— `force === true` 時**跳過**
   - 更新：`prisma.appointment.update({ where: { id }, data: { startAt, endAt, resourceId } })`
8. 回傳更新後資料

**為何不新增 booking.ts 大型 helper：** 邏輯與 `createAppointment` 約 70% 重疊，但「排除自己」與「force 跳過排班檢查」兩個差異足以讓硬抽象變難看。新增獨立的 `rescheduleAppointment(input)` helper，內部複用既有的 `acquireAdvisoryLock / buildLockKey / isResourceOnDutyAt`，但衝突 SQL 與守衛獨立寫。

### Decision 5：force 旗標的語意與安全邊界

**force = true 時跳過的檢查：**
- 過去時段檢查（`startAt < now` 不報錯）
- 資源排班檢查（`isResourceOnDutyAt`）—— 過號補登常見場景是「該醫師班表早已結束但人還在診所」

**force = true 時仍會做的檢查：**
- **衝突檢查**（防雙開）：不可與其他 CONFIRMED 預約重疊
- **資源綁定服務**檢查：仍要求 resource ↔ service 綁定關係
- **商家權限**：仍只能改自家預約

**為何不完全 bypass：** 雙開會直接造成業務事故，這條紅線即使強制覆寫也不能踩。

### Decision 6：DialogAppointmentReschedule 改時間 UX

**輸入欄位：**
1. **日期**：`ElDatePicker`，可選任何日期（含過去）
2. **時段**：複用 `SlotPicker` 載入該日可用時段 + 自由輸入時間（`force` 模式下時段選擇器隱藏，改顯示 `ElTimePicker`）
3. **資源**：依 `service.bookingMode` 顯示
4. **過號補登 toggle**：明顯標示「啟用後可選已過時段，跳過班表檢查」

**驗證流程：**
- 即時：日期 + 時間有值即可送出
- 送出時：後端強制驗證；若 force=false 但 startAt < now，回傳明確錯誤訊息「時段已過，請啟用過號補登」並可一鍵勾選 force 重送

**改資源限制：**
- `TIME_SLOT / TIME_CAPACITY`：資源欄位完全隱藏
- `RESOURCE`：下拉只列「綁定此服務」的資源，必選
- `RESOURCE_OPTIONAL`：下拉同上 + 「不指定」選項

### Decision 7：BizServiceCard 改動範圍

**價格：** 條件改為 `priceCents == null || priceCents <= 0` 都不顯示。

**時長：** i18n key `service.durationMinutes` 帶複數參數，三語：
- `zh-tw`: `'{n} 分鐘'`
- `en`: `'{n} min'`
- `ja`: `'{n} 分'`

不採用「< 60 顯示分鐘、>= 60 顯示時 + 分」的格式化（會與 admin 後台 `durationLabel: '服務時長（分鐘）'` 衝突，且預約服務多為短時，無此需求）。

## Risks / Trade-offs

- **[衝突檢查排除自身難寫對]** → Mitigation：在 SQL where 條件加 `id: { not: appointmentId }`，並在事務內取 advisory lock；單元測試覆蓋「reschedule 到自己原時段 ±5 分（仍重疊自己）」case 確保不誤判
- **[force 模式被濫用導致雙開]** → Mitigation：force 只跳過「時間是否合法」與「排班限制」，**不**跳過「與其他預約是否重疊」的雙開檢查
- **[行事曆篩選改動可能讓使用者重新學習]** → Mitigation：精簡前的篩選欄位本來大半就無效，移除反而符合使用者已有的心智模型；保留「服務／資源／隱藏已取消」三個有效控制
- **[週起點改變可能影響使用者書籤連結]** → Mitigation：`calendarAnchor` 仍可從 URL query 帶入（若有），但若帶入的日期不是週一，自動 normalize 到該週週一；不影響舊連結邏輯
- **[DrawerAppointmentInfo 改造後抽屜過寬擠出主畫面]** → Mitigation：抽屜寬度 `min(420px, 100vw)` 已自適應；新增 footer 高度約 56px（單列）或 112px（手機 2×2），整體仍小於可視範圍
- **[列表「更多」下拉刪除可能讓老使用者找不到操作]** → Mitigation：「詳細」按鈕本身就是抽屜入口，且抽屜內操作更直覺；可在抽屜首次開啟時用 ElTooltip 提示「狀態操作已集中此處」

## Migration Plan

本次**不變更 schema**，不需要資料遷移。

**部署順序：**
1. 後端 reschedule 端點與測試（單元測試覆蓋 advisory lock、衝突排除自己、force 行為）
2. 前端 Protocol binding 與 mock
3. `DialogAppointmentReschedule` 新元件
4. `DrawerAppointmentInfo` 加入 4 顆按鈕（取消複用既有 dialog；reschedule 開新 dialog）
5. `AppointmentTable` 移除「更多」下拉（保留「詳細」入口）
6. `AppointmentCalendar` 週起點改 ISO 週一；admin 頁面 anchor 初始化、prev/next、「今天」按鈕對齊週一
7. `Admin appointments index` 行事曆視圖篩選器精簡（移除日期/狀態/手機/分頁；新增「隱藏已取消」switch）
8. `BizServiceCard` 價格條件 + 時長 i18n 單位
9. i18n 三語 key 補齊
10. Playwright UI 驗證（依驗收條件）

**Rollback：** 各步驟皆為純前端改動或新增端點，可逐項 revert；新端點未被呼叫前不影響既有流程。

## Open Questions

無待解問題；Q1-Q6 已於 explore 階段確認決策。
