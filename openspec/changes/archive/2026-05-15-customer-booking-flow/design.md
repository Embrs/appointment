# Design：customer-booking-flow

## 並發控制（最關鍵風險）

### 為什麼用 advisory lock 而非 row lock

兩個顧客同時預約同一 slot 時，若各自先查可用性、再插 Appointment，會 race condition 雙寫。
方案比較：
1. `SELECT ... FOR UPDATE` 鎖 slot — Appointment 表沒有 slot row，鎖什麼？只能鎖 Service / Resource，會阻塞太多無關預約。
2. Unique constraint `(merchantId, resourceId, startAt, status=CONFIRMED)` — Prisma 不支援部分唯一索引（partial unique with WHERE），且 status 變動會踩 unique。
3. **`pg_advisory_xact_lock(hashtext(key))`** — 事務級鎖、key 自由設計、無 schema 影響、競爭範圍小。✅

### Lock key 設計

```
key = `appt:${merchantId}:${resourceId ?? 'null'}:${startAt.toISOString()}`
SELECT pg_advisory_xact_lock(hashtext($1));
```

事務內：
1. 取 advisory lock（同 key 排隊）
2. 重查當日該 slot 已佔用人數（CONFIRMED only）
3. 與 `capacityPerSlot` 比對；不足 return conflict
4. 創 Appointment

退出事務即釋鎖。`hashtext` 衝突機率 ~2^-32，可接受。

## 取消政策

`Merchant.cancelPolicy` JSON 形狀：
```ts
{ mode: 'free' | 'cutoff', hoursBeforeCannotCancel?: number }
```

顧客取消檢查：
```ts
if (policy.mode === 'cutoff') {
  const cutoffMs = policy.hoursBeforeCannotCancel * 3600 * 1000;
  if (appointment.startAt.getTime() - Date.now() < cutoffMs) {
    return badRequestError(event, MSG_CANCEL_TOO_LATE);
  }
}
```

商家取消不檢查 cutoff（後台想取就取），帶 `canceledBy=MERCHANT`，可選填 `cancelReason`。

## 三元組查詢與軟過濾

三元組：`{ lastName, title (enum), phone }`，**phone 正規化**（去除空白與 `-`）後當索引欄位。

軟過濾過期 1 週：
```sql
WHERE (startAt > NOW() - INTERVAL '7 days') OR status = 'CONFIRMED'
```

即：已過期且非取消的（COMPLETED/NO_SHOW）一週後消失，但顧客當前 session 內仍能看到 CONFIRMED 中的（已預約未到）。

跨商家彙整 `customer/lookup`：同三元組 + 限定當前 session 的 slug 列表（可選），純讀，回傳順序依商家分組。

## RateLimit 策略

- `appointment/lookup`：`lookup-ip:${ip}` 10/min（防爆破）
- `appointment` create：`book-ip:${ip}` 20/min + `book-phone:${phone}` 5/min
- 共用 `RateLimitBucket` 表

## Step 流程設計

`book.vue` 用 `ElSteps`，5 步：
1. **service**：URL `?serviceId=` 略過此步直接到下一步
2. **resource**：服務 `bookingMode === 'RESOURCE'` 才顯示
3. **date**：`DatePickerStrip` 横滑 7-14 天，預設今日 +1
4. **slot**：`SlotPicker` 16-column grid，剩餘容量徽章
5. **info**：三元組表單 + 確認 drawer

每步可回退，state 用 reactive 物件持久；切 service 重置 resource。

## Customer Session

`StoreCustomerSession` 用 `UseEncryptStorage('cs_t', ...)`：
```ts
{
  triplet?: { lastName, title, phone },
  lastSlug?: string,
  recentSlugs: string[]  // 用過的商家，my-bookings 用來查
}
```

不用 cookie 是因 cookie 會被 CSRF + 後端不需感知 session（顧客 API 用 body 傳三元組）。

## 行事曆檢視

`AppointmentCalendar` 純前端組件：
- 日檢視：HH:mm 為列、resource 為欄；resource 數 ≤ 4 才有意義
- 週檢視：日期為欄、HH:mm 為列；point pin 顯示「9:00 王先生」
- 點格子開 `OpenDrawerAppointmentInfo`

## 三語訊息

每個業務錯誤都列三語：
- `MSG_SLOT_TAKEN`（slot 被搶）
- `MSG_CANCEL_TOO_LATE`（cancelPolicy 卡）
- `MSG_TRIPLET_MISMATCH`（三元組不符）
- `MSG_APPOINTMENT_NOT_FOUND`
- `MSG_CANCEL_POLICY_FORBIDDEN`
- `MSG_PAST_SLOT`（已過期 slot 不能訂）
