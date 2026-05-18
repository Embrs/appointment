# Tasks：customer-booking-flow

## 1. 後端 — 公開 API

- [x] 1.1 `server/utils/booking.ts`：advisory lock + 取消政策 + 共用 helpers
- [x] 1.2 `public/appointment/index.post.ts`：建預約
- [x] 1.3 `public/appointment/lookup.post.ts`：三元組查詢 + rate limit
- [x] 1.4 `public/appointment/[id]/cancel.post.ts`：顧客取消
- [x] 1.5 `public/customer/lookup.post.ts`：多商家彙整

## 2. 後端 — 商家 API

- [x] 2.1 `appointment/index.get.ts`：列表 + filter
- [x] 2.2 `appointment/index.post.ts`：商家代客預約（不檢查 cancelPolicy）
- [x] 2.3 `appointment/[id]/cancel.post.ts`：商家取消（canceledBy=MERCHANT）
- [x] 2.4 `appointment/archive/index.get.ts`：歷史紀錄查詢

## 3. Protocol

- [x] 3.1 `app/protocol/fetch-api/api/appointment/{index.ts, mock.ts, type.d.ts}`
- [x] 3.2 `app/protocol/fetch-api/api/customer/{index.ts, mock.ts, type.d.ts}`
- [x] 3.3 `app/protocol/fetch-api/index.ts` 註冊

## 4. Store

- [x] 4.1 `app/stores/5.store-customer-session.ts`

## 5. 業務元件

- [x] 5.1 `app/components/biz/SlotPicker.vue`
- [x] 5.2 `app/components/biz/DatePickerStrip.vue`
- [x] 5.3 `app/components/biz/ResourcePicker.vue`
- [x] 5.4 `app/components/biz/ServiceCard.vue`
- [x] 5.5 `app/components/biz/BookingCard.vue`
- [x] 5.6 `app/components/biz/AppointmentTable.vue`
- [x] 5.7 `app/components/biz/AppointmentCalendar.vue`

## 6. 彈窗

- [x] 6.1 `OpenDialogCustomerForm`
- [x] 6.2 `OpenDrawerBookingConfirm`
- [x] 6.3 `OpenDialogBookingSuccess`
- [x] 6.4 `OpenDrawerAppointmentInfo`
- [x] 6.5 `OpenDialogAppointmentCreate`（商家代客）
- [x] 6.6 `OpenDialogCancelReason`
- [x] 6.7 註冊到 `_index.d.ts` 與 `index.ts`

## 7. 顧客頁面

- [x] 7.1 `app/pages/m/[slug]/index.vue`
- [x] 7.2 `app/pages/m/[slug]/book.vue`（步驟器）
- [x] 7.3 `app/pages/m/[slug]/lookup.vue`
- [x] 7.4 `app/pages/m/[slug]/my-bookings.vue`

## 8. 商家頁面

- [x] 8.1 `app/pages/admin/appointments/index.vue`
- [x] 8.2 `app/pages/admin/appointments/calendar.vue`
- [x] 8.3 `app/pages/admin/appointments/archive.vue`

## 9. i18n 三語補字

- [x] 9.1 `i18n/locales/zh.js`
- [x] 9.2 `i18n/locales/en.js`
- [x] 9.3 `i18n/locales/ja.js`

## 10. 驗證

- [x] 10.1 Playwright 場景 1：顧客完整預約 + 取消
- [x] 10.2 Playwright 場景 2：並發搶 slot（只有一個成功）
- [x] 10.3 Playwright 場景 3：商家代客 + cancelPolicy 卡顧客取消
- [x] 10.4 Playwright 場景 4：商家行事曆 + 商家取消填理由
- [x] 10.5 Playwright 場景 5：手機 RWD 375x667
