# Change：customer-booking-flow

## Why

預約平台 MVP 的核心交易動線：顧客挑服務 → 挑時段 → 填三元組 → 確認 → 取消／查詢；
商家從後台檢視、代客預約、行事曆與歷史紀錄。

前置：`setup-foundation`（schema、auth、prisma）、`merchant-config`（服務／資源／時段／休假）、
`availability-engine`（slot 計算）已完成。本 change 將上述配置與算法兜成完整的顧客／商家動線。

不包含：QUEUE 號碼牌（Change 7）、Email/SMS 通知、線上付款。

## What Changes

### 公開 API（無 token）

- `POST /nuxt-api/public/appointment` — 顧客建預約
  - `pg_advisory_xact_lock(hashtext(merchantId+resourceId+startAt))` 並發控制
  - 重檢 slot 剩餘容量（防 stale state）
- `POST /nuxt-api/public/appointment/lookup` — 三元組查詢
  - RateLimit：每 IP 每分鐘 10 次
  - 軟過濾：`startAt > now() - 7 days OR status = 'CONFIRMED'`
- `POST /nuxt-api/public/appointment/[id]/cancel` — 顧客取消
  - 驗證三元組
  - 檢查 `service.cancelPolicy.mode === 'cutoff'` 與 `hoursBeforeCannotCancel`
- `POST /nuxt-api/public/customer/lookup` — 多商家彙整查詢
  - 同三元組，但跨所有商家

### 商家 API

- `GET /nuxt-api/appointment` — 列表（filter: dateFrom/dateTo、status、resourceId、serviceId）
- `POST /nuxt-api/appointment` — 商家代客預約（同樣套 advisory lock，但不檢查 cancelPolicy）
- `POST /nuxt-api/appointment/[id]/cancel` — 商家取消（reason 可選，標 `canceledBy=MERCHANT`）
- `GET /nuxt-api/appointment/archive` — 歷史紀錄（讀 `AppointmentArchive`）

### Protocol

- `app/protocol/fetch-api/api/appointment/`
- `app/protocol/fetch-api/api/customer/`

### Store

- `app/stores/5.store-customer-session.ts`
  - 顧客三元組（lastName/title/phone）+ 商家 slug
  - 用 `UseEncryptStorage('cs_t')` 持久化

### 顧客頁面（front-desk layout）

- `app/pages/m/[slug]/index.vue` — 商家首頁，列服務卡片
- `app/pages/m/[slug]/book.vue` — 步驟器：選服務 → 選資源 → 選日期 → 選時段 → 填三元組 → 確認
- `app/pages/m/[slug]/lookup.vue` — 三元組查詢
- `app/pages/m/[slug]/my-bookings.vue` — 當前 session 的預約列表（過期 1 週軟過濾）

### 商家頁面（back-desk layout）

- `app/pages/admin/appointments/index.vue` — 表格 + filter
- `app/pages/admin/appointments/calendar.vue` — 週／日檢視
- `app/pages/admin/appointments/archive.vue` — 歷史紀錄

### 業務元件

- `app/components/biz/SlotPicker.vue`
- `app/components/biz/DatePickerStrip.vue`（橫向滾動 7-14 天）
- `app/components/biz/ResourcePicker.vue`
- `app/components/biz/ServiceCard.vue`
- `app/components/biz/BookingCard.vue`
- `app/components/biz/AppointmentTable.vue`
- `app/components/biz/AppointmentCalendar.vue`

### 彈窗

- `OpenDialogCustomerForm`
- `OpenDrawerBookingConfirm`
- `OpenDialogBookingSuccess`
- `OpenDrawerAppointmentInfo`
- `OpenDialogAppointmentCreate`
- `OpenDialogCancelReason`

## Impact

- 新建 capability：`customer-booking`
- 對前置 capability 純擴充，無 schema 變動（資料模型已在 Change 1 落地）
- i18n：三語同步補 booking 相關 key
