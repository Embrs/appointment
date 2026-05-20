## Why

目前顧客（依手機）對同一商家可無限制累積預約，可能被惡意或誤操作刷出大量預約占用 slot，也讓商家難以平均服務客戶。需要在系統層加上「同一手機在同一商家未來 CONFIRMED 預約筆數上限」的硬性限制，並由商家自由設定。

## What Changes

- **新增 `Merchant.maxActiveAppointmentsPerCustomer Int @default(5)`**：合法區間 1–99，DB 層 default 5，與既有商家相容（migration 自動補 default）
- **`createAppointment` 增加上限檢查**：事務內 advisory lock 後，count `merchantId+customerPhone+status=CONFIRMED+startAt>=now()` 與 `Merchant.maxActiveAppointmentsPerCustomer` 比對；超過回 409
- **新增三語訊息 `MSG_BOOKING_LIMIT_EXCEEDED`**（zh_tw: '您在本商家的預約已達上限，請取消舊預約後再試'）
- **`Merchant` PUT API 接受 `maxActiveAppointmentsPerCustomer`**：1–99 整數，Zod 驗證
- **商家設定頁 `/admin/settings` 加 UI**：`ElInputNumber` min=1 max=99 預設 5
- **顧客建立預約失敗訊息友善化**：顧客面 `book.vue` 收到 409 時顯示「已達上限（X 筆）」並提供「我的預約」連結引導取消

## Capabilities

### New Capabilities
<!-- 無新增 capability -->

### Modified Capabilities
- `customer-booking`: 顧客建立預約 requirement 新增上限檢查 scenario
- `merchant-platform`: 商家自身資訊讀寫 requirement 新增 `maxActiveAppointmentsPerCustomer` 欄位 scenario

## Impact

- **Schema 變動**：`prisma/schema.prisma` 新增 `Merchant.maxActiveAppointmentsPerCustomer Int @default(5)`
  - 需新增 migration（`npx prisma migrate dev --name add_merchant_booking_limit`）
  - 部署：Dockerfile `prisma migrate deploy` 自動套用，向後相容（既有 row 取 default 5）
- **後端修改**：
  - `prisma/schema.prisma`
  - `server/utils/booking.ts`（新訊息 + `createAppointment` 加 count）
  - `server/routes/nuxt-api/merchant/[id].put.ts`（補 Zod 欄位）
  - `server/routes/nuxt-api/merchant/index.get.ts`（回傳新欄位）
- **前端修改**：
  - `app/pages/admin/settings.vue`（新欄位 UI）
  - `app/pages/m/[slug]/book.vue`（友善錯誤提示）
  - `app/protocol/`（merchant types 補欄位、新訊息常數）
- **i18n**：補三語訊息 key
- **測試**：`server/__tests__/booking-limit.test.ts` 純函式測「count 超過拒絕」「未來 CONFIRMED 才算」「同手機規範化前後等價」
