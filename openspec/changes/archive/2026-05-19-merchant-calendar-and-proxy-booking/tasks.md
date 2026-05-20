## 1. 後端 availability `Slot.reason` 與純函式擴充

- [x] 1.1 在 `server/utils/availability.ts` 定義 `SlotUnavailableReason` 型別（`'past' | 'taken' | 'capacity' | 'closed' | 'holiday' | 'inactive'`），匯出供前後端共用
- [x] 1.2 `Slot` 型別新增 `reason?: SlotUnavailableReason`；確認既有呼叫端（顧客面）不會 break
- [x] 1.3 修改 `buildSlots` 純函式：加入 `now: Date` 參數；計算每個 slot 時若 `startAt < now` 設 `reason='past'`、`remaining=0`；若 `occupied >= capacity` 依 bookingMode 設 `reason='taken'`（TIME_SLOT/RESOURCE）或 `reason='capacity'`（TIME_CAPACITY）
- [x] 1.4 `computeAvailability` 外殼：傳 `new Date()` 給 `buildSlots`；整日 holiday / override.isClosed 仍回 `[]`（不改）
- [x] 1.5 同步更新 `server/utils/availability.ts` 內部型別匯出，確保 TypeScript build 過

## 2. 後端單元測試擴充

- [x] 2.1 `server/__tests__/availability.test.ts` 新增 case：注入固定 `now`，驗證已過 slot 設 `reason='past'`、remaining=0
- [x] 2.2 新增 case：TIME_SLOT 被佔，slot `reason='taken'`
- [x] 2.3 新增 case：TIME_CAPACITY 滿額，slot `reason='capacity'`
- [x] 2.4 新增 case：未過 + 無預約 slot `reason=undefined`
- [x] 2.5 執行 `npm test` 確認全綠

## 3. 前端 protocol 型別與 mock

- [x] 3.1 `app/protocol/fetch-api/api/availability/type.d.ts`：`Slot` 型別新增 `reason?: SlotUnavailableReason`；同步 export reason union
- [x] 3.2 `app/protocol/fetch-api/api/availability/mock.ts`：mock slot 加上 reason 範例（含 past / taken / capacity 各一）

## 4. i18n 字串

- [x] 4.1 `i18n/locales/zh.js` 新增 `slot.reason.{past, taken, capacity, closed, holiday, inactive}` 與對應 tooltip 長文
- [x] 4.2 `i18n/locales/en.js` 對齊
- [x] 4.3 `i18n/locales/ja.js` 對齊

## 5. 前端 composable

- [x] 5.1 `app/composables/useSlotReason.ts` 提供 `getReasonLabel(reason)` 與 `getReasonTooltip(reason)`，封裝 `useI18n()` 對 `slot.reason.*` 的取值

## 6. 預約管理頁同頁 toggle

- [x] 6.1 `app/pages/admin/appointments/index.vue`：
  - 加 `view = ref<'calendar' | 'list'>('calendar')`，從 `route.query.view` 初始化（非法值降級為 `calendar`）
  - 加 toggle UI（ElRadioGroup）放在 header 右側、緊鄰「代客預約」
  - watch `view` 變化用 `router.replace` 寫入 query（calendar 不寫 query 以保持 URL 簡潔）
  - filter 區改為「兩 view 共用」，把日期/狀態/服務/資源/手機 filter 抽出
  - 行事曆 view 內掛 `BizAppointmentCalendar`；列表 view 內掛 `BizAppointmentTable`
- [x] 6.2 確認 ApiLoad 流程：兩 view 共用同一 `items` ref；切 view 不重發請求（只切渲染）
- [x] 6.3 「代客預約」按鈕在兩 view 都顯示，行為一致

## 7. 舊路由相容

- [x] 7.1 改寫 `app/pages/admin/appointments/calendar.vue`：移除原行事曆內容，改為 `<script setup>` 中 `useRouter().replace('/admin/appointments?view=calendar')` 並回傳空 template；不在 layout 中閃爍

## 8. BizAppointmentCalendar 視覺與點擊強化

- [x] 8.1 新增 emit `click-empty-cell({ date: string, startAt?: string })`
- [x] 8.2 點擊規則：空檔格 emit；已預約格維持既有 `click-cell`；不可營業格不 emit
- [x] 8.3 不可營業時段套用斜紋背景樣式（`repeating-linear-gradient`、`cursor: default`）
- [x] 8.4 可建立空檔 hover 高亮 + 顯示「+ 代客預約」icon
- [x] 8.5 斜紋格 tooltip 顯示原因（holiday / closed / 排班外）
- [x] 8.6 props 確保接受 `holidays / overrides / scheduleRules` 或從 items 推導需要的「不可營業」遮罩（依現況選擇較簡單的方式）

## 9. 預約管理頁點空白格串接

- [x] 9.1 `app/pages/admin/appointments/index.vue` 接 `BizAppointmentCalendar` 的 `@click-empty-cell` → 呼叫 `$open.DialogAppointmentCreate({ slug, prefillDate, prefillStartAt })`
- [x] 9.2 完成後若 `result.done` 重新 ApiLoad

## 10. DialogAppointmentCreate 接受 prefill 與 reason 顯示

- [x] 10.1 `DialogAppointmentCreateParams` 型別擴充 `prefillDate?: string; prefillStartAt?: string; prefillServiceId?: string; prefillResourceId?: string`
- [x] 10.2 `app/components/open/dialog/appointment-create.vue` 在 onMounted 把 params 預填入 `form`
- [x] 10.3 slot 載入後若有 `prefillStartAt` 對應 slot：
  - 該 slot `reason=undefined` → 自動 `form.startAt = prefillStartAt`，頂部顯示成功提示
  - 該 slot 不可選 → 不自動選；頂部顯示黃色 alert 「您點選的 HH:mm 已被預約，請選其他時段」
- [x] 10.4 slot button 樣式更新：
  - 一般：白底
  - active：藍底（既有）
  - 不可選：淡灰底 + reason badge（如「已被預約」「已過」「已額滿」）
  - 加 ElTooltip 包 button，顯示 `getReasonTooltip(reason)`
- [x] 10.5 button 顯示文字改為「HH:mm · {reasonLabel}」（若可選則只顯示時間）

## 11. Playwright 實機驗收

- [x] 11.1 跑 `npm run dev` 啟動本地伺服器（用 `.env.dev`）
- [x] 11.2 用 Playwright MCP 登入商家後台、訪 `/admin/appointments`，截圖確認預設停在行事曆
- [x] 11.3 切換到「列表」、重整頁面，確認 `?view=list` 持久化
- [x] 11.4 切回行事曆，點空白時段格，確認 Dialog 開啟且日期預填正確
- [x] 11.5 手動建立 / 利用既有預約讓某 slot `remaining=0`；再開 Dialog 對同 slot，確認 button 顯示「已被預約」badge + tooltip 且不可點
- [x] 11.6 點任一過去時間的 slot，確認顯示「已過」並不可點
- [x] 11.7 切到一個已設休假的日期，確認行事曆該日整欄為斜紋背景且 hover 顯示「本日休假」
- [x] 11.8 訪舊路由 `/admin/appointments/calendar`，確認自動 redirect 到 `?view=calendar`
- [x] 11.9 切換 locale 至 `en`，重複 11.5–11.7 主要 case，確認文字翻譯生效
- [x] 11.10 把驗收截圖存到 `screenshots/merchant-calendar-and-proxy-booking/`

## 12. 開發後檢查

- [x] 12.1 `npm run lint` 通過（無新 warning）
- [x] 12.2 `npm test` 通過
- [x] 12.3 `npm run build` 通過（型別檢查 + 產出無錯）
- [x] 12.4 `openspec validate merchant-calendar-and-proxy-booking` 通過
- [x] 12.5 與使用者確認驗收，再進入 archive
