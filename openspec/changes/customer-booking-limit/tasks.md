## 1. Schema 與 migration

- [x] 1.1 修改 `prisma/schema.prisma`：`Merchant` model 新增 `maxActiveAppointmentsPerCustomer Int @default(5)`
- [x] 1.2 執行 `npx prisma migrate dev --name add_merchant_booking_limit` 產生 migration 檔
- [x] 1.3 檢查產出的 SQL：應為 `ALTER TABLE "Merchant" ADD COLUMN "maxActiveAppointmentsPerCustomer" INTEGER NOT NULL DEFAULT 5;`
- [x] 1.4 `npx prisma generate` 更新 client 型別
- [x] 1.5 確認 Dockerfile CMD 已包含 `npx prisma migrate deploy`（既有，無需改）

## 2. 後端共用 helper

- [x] 2.1 在 `server/utils/booking.ts` 新增 `MSG_BOOKING_LIMIT_EXCEEDED`（zh_tw: '您在本商家的預約已達上限，請取消舊預約後再試', en, ja）
- [x] 2.2 在 `CreateAppointmentInput` 介面新增 `byMerchant?: boolean`（與既有設計一致）

## 3. createAppointment 上限檢查

- [x] 3.1 修改 `server/utils/booking.ts/createAppointment`：
  - 進事務、advisory lock 取得後，先 `tx.merchant.findUnique({ where: { id: merchantId }, select: { maxActiveAppointmentsPerCustomer: true } })`
  - `byMerchant` 為 true 時略過上限檢查
  - 否則 `tx.appointment.count({ where: { merchantId, customerPhone: normalizedPhone, status: 'CONFIRMED', startAt: { gte: new Date() } } })`
  - 若 count ≥ limit，回 `{ limitExceeded: true }`
  - 外層判斷後回 `conflictError(event, MSG_BOOKING_LIMIT_EXCEEDED)`
- [x] 3.2 確認 `slot 容量` 與 `上限` 兩個檢查順序：先檢查上限（顧客錯多次只看到「您預約太多」更友善），再檢查容量

## 4. Merchant API 補欄位

- [x] 4.1 修改 `server/routes/nuxt-api/merchant/[id].put.ts`：
  - Zod schema 加 `maxActiveAppointmentsPerCustomer: z.number().int().min(1).max(99).optional()`
  - update 時若有此欄位則寫入
- [x] 4.2 修改 `server/routes/nuxt-api/merchant/index.get.ts`（與 [auth/me.get.ts] 若有讀商家欄位處）：select 補上 `maxActiveAppointmentsPerCustomer`、回傳

## 5. 商家代客預約

- [x] 5.1 修改 `server/routes/nuxt-api/appointment/index.post.ts`：呼叫 `createAppointment` 時帶 `byMerchant: true`，確保商家代客不被上限阻擋

## 6. 後端測試

- [x] 6.1 新建 `server/__tests__/booking-limit.test.ts`：
  - [x] 6.1.1 count(未來 CONFIRMED) < limit → 通過
  - [x] 6.1.2 count(未來 CONFIRMED) ≥ limit → 拒絕
  - [x] 6.1.3 過去 CONFIRMED 不計入（由 `buildBookingLimitWhere.startAt.gte = now` 保證；Prisma DB 層測由整合測試覆蓋）
  - [x] 6.1.4 CANCELED / COMPLETED / NO_SHOW 不計入（由 `buildBookingLimitWhere.status = 'CONFIRMED'` 保證）
  - [x] 6.1.5 跨商家獨立（where 含 `merchantId`）
  - [x] 6.1.6 byMerchant 略過

## 7. Protocol bindings

- [x] 7.1 修改 `app/protocol/` merchant types：補 `maxActiveAppointmentsPerCustomer: number`
- [x] 7.2 `UpdateSelfMerchant` ApiCall body 接受 `maxActiveAppointmentsPerCustomer?: number`
- [x] 7.3 新增 i18n key `booking.messages.limitExceeded`（三語）

## 8. 前端商家設定頁

- [x] 8.1 修改 `app/pages/admin/settings.vue`：
  - 加 `ElDivider` 分區「預約上限」
  - `ElInputNumber` `v-model="form.maxActiveAppointmentsPerCustomer"` `:min="1"` `:max="99"` `:step="1"`
  - Helper text：「同一手機在本店未來預約的最大筆數（1–99，預設 5）」
  - 表單提交時帶上此欄位

## 9. 前端顧客面友善錯誤

- [x] 9.1 修改 `app/pages/m/[slug]/book.vue`（最後 Confirm 步驟）：
  - 收到 `MSG_BOOKING_LIMIT_EXCEEDED` 時用 `ElMessageBox.alert`（不只 toast），標題「已達預約上限」
  - 內容：訊息文字 + 「您可至『我的預約』取消不需要的預約」+ `ElButton` 連結 `/m/[slug]/my-bookings`

## 10. UI 實機驗證（Playwright MCP）

- [ ] 10.1 商家後台 → settings → 改上限為 2 → 儲存 → 重新整理確認保存（截圖：`screenshots/customer-booking-limit/01-settings.png`）
- [ ] 10.2 顧客面 → 用同手機建第 1、2 筆 → 成功（截圖：`02-second-booking.png`）
- [ ] 10.3 顧客面 → 用同手機建第 3 筆 → 看到上限錯誤彈窗（截圖：`03-limit-alert.png`）
- [ ] 10.4 點彈窗「我的預約」→ 跳到 my-bookings → 取消一筆 → 回 book 頁可再建（截圖：`04-cancel-and-retry.png`）
- [ ] 10.5 用不同手機建預約 → 不受影響
- [ ] 10.6 商家後台代客預約（即便已達上限）→ 成功
- [ ] 10.7 驗證 normalize：`0912-345-678` 與 `0912345678` 計入同一上限

## 11. 部署同步驗證

- [ ] 11.1 PR 合併 main → Railway 拉新 image → 觀察日誌中 `prisma migrate deploy` 套用 migration 成功
- [ ] 11.2 測試站既有商家欄位自動帶 default 5（API GET /merchant 確認）
- [ ] 11.3 正式站部署完成後同樣確認

## 12. 文件

- [x] 12.1 更新 `.claude/knowledge/data-model.md` 在 Merchant 欄位列出新欄位
- [x] 12.2 更新 `.claude/knowledge/availability-and-booking.md` 在 createAppointment 流程加上限檢查步驟

## 13. 驗收

- [ ] 13.1 `npm run lint` 通過（baseline 既有錯誤 `.vscode/demo.vue` 與本 change 無關；本 change 未新增 lint 錯誤）
- [x] 13.2 `npm test` 通過（66/66 含本 change 12 新測試）
- [x] 13.3 `npm run build` 通過
- [x] 13.4 `openspec validate customer-booking-limit --strict` 通過
