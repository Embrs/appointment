## Why

商家後台 `/admin/appointments` 的主要工作流是「看今天/這週誰要來、是不是有空隙、要不要幫熟客插一筆」。目前預設停在列表頁，行事曆要點按鈕切過去才看得到，與商家直覺相反；同時代客預約（`DialogAppointmentCreate`）的時段選擇器，遇到「已滿」「已過」「該日休息」「資源停用」等情境，按鈕只是 disable 卻沒視覺差異也沒提示文字，使用者反映「點下去毫無反應」，誤以為系統壞掉。本次改動把行事曆當主場，並把代客預約的時段選擇做成清楚的「為什麼不可選」標示，順便讓行事曆變成代客預約的進入點。

## What Changes

- **`/admin/appointments` 改為同頁 toggle**：頁面內以 `ElRadioGroup` 切換「行事曆 / 列表」，預設停在行事曆；移除原本 `/admin/appointments/calendar` 獨立路由（路由仍保留但內部 redirect 回 `/admin/appointments?view=calendar`，避免外部連結斷裂）
- **Filter 區共用**：日期區間、服務、資源、狀態、手機 filter 同時影響兩種 view；切換 view 時 filter 狀態保留
- **行事曆右上角 + 列表右上角都有「代客預約」按鈕**：行為一致，呼叫 `DialogAppointmentCreate`
- **行事曆空白格直接建立**：點 `BizAppointmentCalendar` 的空時段格 → emit `click-empty-cell({ date, startAt? })` → 開啟 `DialogAppointmentCreate` 並預填 `date`（若是日視圖內點到具體 hour 同時預填 `startAt` 預覽值）
- **`DialogAppointmentCreate` 接受預填參數**：`DialogAppointmentCreateParams` 擴充為 `{ slug, prefillDate?, prefillStartAt?, prefillServiceId?, prefillResourceId? }`，預填時自動觸發 `ApiLoadSlots`
- **時段選擇改為視覺明確的「可選 / 不可選 / 已選」三態 + 不可選原因 tooltip**：
  - slot 物件新增 `reason?: 'past' | 'taken' | 'capacity' | 'closed' | 'holiday' | 'inactive'` 欄位（後端 `Slot` 型別 + `buildSlots` / `computeAvailability` 計算）
  - 前端 Dialog 與行事曆都以 reason 對應的本地化文字標示（如「已過」「已額滿」「該日休息」）
  - 不可選時段不再 `disabled` 後毫無提示，而是用淡灰底 + 對應 reason badge；hover 顯示 tooltip
- **行事曆視圖空檔 vs 不可營業時段視覺區分**：營業時段空檔顯示為「可點擊建立」（淺色 + hover 高亮），非營業時段（holiday / closed / 排班外）顯示為斜紋背景並不可點
- **保持 schema 不動**：本 change 不新增 / 不修改 Prisma model；新增的 `Slot.reason` 是 API 響應層欄位，無 DB migration，因此測試站、正式站不需要 schema 同步腳本，純前後端程式碼部署即生效

## Capabilities

### New Capabilities
<!-- 無新增 capability —— 本 change 僅擴充既有 merchant-platform 與 public-availability -->

### Modified Capabilities

- `merchant-platform`: 「商家後台配置頁面」需求中的 `/admin/appointments` 頁改為同頁 toggle、預設行事曆、行事曆右上角同樣有代客預約按鈕、點空白格可預填建立
- `public-availability`: `GET /public/availability` 與 `Slot` 型別響應結構新增 `reason?` 欄位，用於辨識不可選原因（capacity / taken / past / closed / holiday / inactive）；既有 `remaining` 語意不變

### 不影響的 capabilities

- `customer-booking`：顧客面預約建立流程不動；顧客面 slot 渲染雖然也會收到 `reason` 但顯示文字維持原樣（後續若要加 tooltip 是另一個 change）

## Impact

- **後端修改檔案**：
  - `server/utils/availability.ts`：`Slot` 型別擴充、`buildSlots` 在 `remaining=0` 時帶出 reason；新增容量已滿 vs 預約已滿區分（純函式）
  - `server/utils/availability.ts/computeAvailability`：holiday / override.isClosed / inactive 時不再回 `[]`，而是回對應 reason 的「占位 slot」？→ **不採用此方案**，整日休息仍回 `[]`，避免響應膨脹；reason 僅用於「有 slot 但不可選」的情境
- **前端修改檔案**：
  - `app/pages/admin/appointments/index.vue`：加 `view` toggle（`'calendar' | 'list'`）、預設 `'calendar'`、`query.view` 持久化、Filter 區共用
  - `app/pages/admin/appointments/calendar.vue`：**移除**頁內容（保留檔案為 redirect 殼，或直接刪 + 在 `definePageMeta` 設 alias）→ 採「刪除 + 新增 `/admin/appointments/calendar.vue` middleware 重導至 `/admin/appointments?view=calendar`」
  - `app/components/biz/AppointmentCalendar.vue`：新增 `click-empty-cell` emit；空時段格的可點與否依 reason 切換；非營業時段以斜紋背景區分
  - `app/components/open/dialog/appointment-create.vue`：接受 `prefillDate / prefillStartAt / prefillServiceId / prefillResourceId`；slot 按鈕渲染依 `reason` 顯示 badge + tooltip；保留 `disabled` 但加上「為什麼」文字
  - `app/protocol/fetch-api/api/availability/type.d.ts`：`Slot` 型別新增 `reason?: SlotUnavailableReason`
  - `app/protocol/fetch-api/api/availability/mock.ts`：mock 也帶 reason 範例
- **i18n**：`i18n/locales/{zh,en,ja}.js` 新增 `slot.reason.past / taken / capacity / closed / holiday / inactive` 字串（不可選原因翻譯）
- **不動 schema**：無 Prisma migration，因此**測試站 / 正式站僅需部署新版程式碼，不需要任何資料同步或修復腳本**
- **測試**：
  - 後端：擴充 `server/__tests__/availability.test.ts`，補 `buildSlots` 對不同 reason 的純函式測試（已過、容量、已滿、資源停用）
  - 前端：實際在 Playwright 操作 `/admin/appointments`，驗證行事曆 / 列表切換、空白格建立、Dialog 預填、不可選時段視覺，符合驗收標準
- **依賴**：無新增 dependency
