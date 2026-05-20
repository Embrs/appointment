## Why

商家後台「預約管理」實務操作上有四個體感問題：行事曆視圖的篩選器多半失效或無用、行事曆週起點不符直覺（以「今天」為第一格）、行事曆缺少列表才有的狀態操作（取消／完成／未到）、且**兩個視圖都無法修改預約**（過號補登、客戶改時間、改醫師等情境完全沒有對應 UI 與 API）。前台服務卡片則因「`NT$ 0`」與「孤零零的 30／60 數字沒帶單位」兩個小瑕疵，讓顧客誤解服務的計價與時長。本次一併處理這些影響第一線服務人員與顧客理解度的 UX 缺口。

## What Changes

### 後台：行事曆視圖
- **精簡篩選**：移除上方完整 filter 列；行事曆只保留「服務 / 資源 / 隱藏已取消」三個有意義的篩選，移除日期區間（由週/日導覽控制）、狀態（用 switch 取代）、手機、分頁
- **週起點改為週一**：`calendarAnchor` 進入頁面與「今天」按鈕都對齊到「該週的週一」；上一週／下一週以週一為步進單位（永遠停在週一），不再以 anchor ± 7 天計算
- **行事曆 chip 點擊**仍開啟 `DrawerAppointmentInfo`，但抽屜內**新增 4 個操作**：取消預約、標記完成、標記未到、修改預約

### 後台：列表視圖
- 「更多 ▾」下拉**新增「修改預約」項目**；點擊後開啟與行事曆版本同一個 `DialogAppointmentReschedule`
- 「取消／完成／未到」維持現有行為，但統一改由 `DrawerAppointmentInfo` 內按鈕觸發（單一真實來源；列表詳細按鈕一樣開抽屜）

### 共用：DialogAppointmentReschedule（新元件）
- 支援改時間（日期 + 時段）、改資源（僅 `RESOURCE / RESOURCE_OPTIONAL` 模式）
- 允許選擇**過去時段**（含當天已過的時段），用於「過號補登」；UI 須明示「已過時段」風險
- 後端強制重跑 availability 引擎（避免雙開），但選過去時段時改走較寬鬆的 `force` 路徑（仍檢查資源衝突，不檢查未來時段限制）

### 後台：新增 API
- `POST /nuxt-api/appointment/[id]/reschedule`：更新 `startAt / endAt / resourceId`，重跑衝突檢查，不通知顧客

### 前台：BizServiceCard
- 價格為 `null` **或 `<= 0`** 時不顯示價格區塊（目前只判斷 null）
- 時長加上 i18n 單位（`zh-tw: {n} 分鐘 / en: {n} min / ja: {n} 分`）

### 響應式 / 手機版
- `DrawerAppointmentInfo` 在手機（< 480px）寬度自適應為全寬，footer 4 個按鈕改為 2×2 grid 排列避免擠壓
- `DialogAppointmentReschedule` 手機寬度自適應，避免水平捲動

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `merchant-platform`：行事曆視圖的篩選範圍與週起點規則、行事曆狀態操作（含 reschedule）、`DrawerAppointmentInfo` 改造、reschedule API 規範
- `customer-booking`：`BizServiceCard` 價格與時長顯示規範

## Impact

### 受影響檔案（程式碼）
- `app/pages/admin/appointments/index.vue` — 行事曆篩選結構、anchor 邏輯、prev/next
- `app/components/biz/AppointmentCalendar.vue` — 週起點對齊到週一
- `app/components/biz/AppointmentTable.vue` — 更多下拉新增「修改預約」
- `app/components/open/drawer/appointment-info.vue` — 抽屜 footer 新增 4 個操作按鈕、響應式排版
- `app/components/open/dialog/appointment-reschedule.vue` — **新增** 共用修改預約 Dialog
- `app/components/open/_index.d.ts` / `index.ts` — 註冊新 dialog
- `app/components/biz/ServiceCard.vue` — 價格 `<= 0` 隱藏、時長加單位
- `app/protocol/fetch-api/api/appointment/index.ts` + `type.d.ts` + `mock.ts` — 新增 `RescheduleAppointment` binding
- `server/routes/nuxt-api/appointment/[id]/reschedule.post.ts` — **新增** API 端點
- `server/utils/booking.ts` — 視 reschedule 需求新增 `rescheduleAppointment` helper（或共用 createAppointment 內部邏輯）
- `i18n/locales/zh.js | en.js | ja.js` — 新增「修改預約 / 分鐘 / 確認修改 / 過號補登」等 key

### 不受影響
- Prisma schema（**不變更**；reschedule 只更新既有欄位 `startAt / endAt / resourceId`）
- 部署流程（既有 `prisma migrate deploy` 已涵蓋未來 schema 變化，本次無需動）
- 顧客通知（本次不發任何通知；保留未來擴充空間）
- QUEUE 模式（不進 Appointment 表，本次不涉及）
- 取消／完成／未到 三支既有 API 行為不變
