---
name: 可用時段引擎與預約建立
description: availability.ts 純函式 + DB 外殼設計、BookingMode 分流、createAppointment advisory lock、取消政策
type: reference
---

# 可用時段引擎與預約建立

公開預約流程的核心：`server/utils/availability.ts`（可用時段）+ `server/utils/booking.ts`（建立／取消預約）。

## 設計原則

| 層級 | 檔案 | 性質 |
|------|------|-----|
| 純函式 | `availability.ts/buildSlots`、`booking.ts/parseCancelPolicy`、`checkCancelCutoff` | 不依賴 Prisma/H3，可在 Vitest 直接構造資料驗證 |
| 外殼 | `availability.ts/computeAvailability`、`booking.ts/createAppointment` | 負責查 DB、拼資料、呼叫純函式、回傳結果或 `ApiResponse` 錯誤 |

Vitest 測試位於 `server/__tests__/availability.test.ts`。

## BookingMode 分流規則

| BookingMode | resourceId | availability 容量 | 備註 |
|-------------|-----------|------------------|------|
| `TIME_SLOT` | 必須不帶 | 固定 1 | 同時段只能 1 人 |
| `TIME_CAPACITY` | 必須不帶 | `service.capacityPerSlot` | 同時段多人，例如團體課 |
| `RESOURCE` | **必須帶** | 1 / resource | 例如指定醫師、特定包廂 |
| `RESOURCE_OPTIONAL` | **可選** | 1 / resource | 顧客可指定或不指定；不指定走 union 聚合 + auto-assign |
| `QUEUE` | — | **不適用 availability** | `computeAvailability` 直接回 400；改走號碼牌 |

公開查詢 `GET /public/availability` 與後台預約都共用同一套規則檢查。

## computeAvailability 流程

1. 驗 `date` 格式（`YYYY-MM-DD`）→ 400 `MSG_DATE_INVALID`
2. 查 `Merchant`（`slug` + `ACTIVE` + 未刪除）→ 404
3. 查 `Service`（屬於該商家 + `isActive` + 未刪除）→ 404
4. `bookingMode` 一致性檢查（QUEUE / RESOURCE 必帶 resourceId / 其他不可帶）→ 400
5. `RESOURCE` 模式：驗 `ServiceResource` 關聯存在 + Resource 啟用 → 400
6. 查當日：`ScheduleRule`（按 weekday）/ `ScheduleOverride` / `MerchantHoliday`
7. 查當日 `CONFIRMED Appointment` 算每個 `startAt` 已佔用人數（`occupiedMap`）
8. 呼叫純函式 `buildSlots(...)` 回傳 `Slot[]`

## buildSlots 純函式行為

| 條件 | 結果 |
|------|------|
| `isHoliday` | 回 `[]` |
| `override.isClosed` | 回 `[]` |
| `override` 存在且非 closed | 用 `override.startTime/endTime` **取代**當週規則 |
| `override` 不存在 | 取所有 `isActive` 的 `rules`，按 `startTime` 排序 |
| `intervalEnd <= intervalStart` 或 HH:mm 格式錯 | 該 interval 跳過 |
| `slotIntervalMinutes <= 0` 或 `durationMinutes <= 0` | 回 `[]` |

slot 切割：在每段 interval 內，從 `intervalStart` 開始，每 `step = slotIntervalMinutes` 切一個，需滿足 `start + duration <= intervalEnd`。

`capacity = bookingMode === 'TIME_CAPACITY' ? capacityPerSlot : 1`，`remaining = max(0, capacity - occupied)`。

## 時區處理

- `merchant.timezone` 預設 `'Asia/Taipei'`
- `composeUtc(date, minutes, tz)` 把指定時區下的時刻轉成 UTC `Date`
- `getWeekdayInTz`、`getDayRangeUtc` 都基於 `dayjs.tz`

## createAppointment 防併發

`booking.ts/createAppointment` 用 **PG advisory transaction lock** 解決多人同時搶同一 slot 的競態：

```typescript
const lockKey = `appt:${merchantId}:${resourceId ?? 'null'}:${startAtIso}`;
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  // 重檢已佔用人數 → create
});
```

事務結束時 advisory lock 自動釋放。建立流程：

1. 驗 `startAt` 不為過去 → 400 `MSG_PAST_SLOT`
2. 查 `Service` + 驗 BookingMode/resource 一致性
3. 進入事務：取 advisory lock →
   - 顧客上限檢查（`byMerchant !== true` 時）：查 `Merchant.maxActiveAppointmentsPerCustomer`，再 `count` 該手機在本商家未來 CONFIRMED 預約；達上限 → 409 `MSG_BOOKING_LIMIT_EXCEEDED`
   - `count CONFIRMED appointments` 重檢 slot 容量 → 超過 capacity 回 409 `MSG_SLOT_TAKEN`
   - 否則 `create`
4. 失敗一律 `return conflictError(...)`，**不 throw**

### 顧客預約上限

- 欄位：`Merchant.maxActiveAppointmentsPerCustomer Int @default(5)`，範圍 1–99
- 純函式：`checkBookingLimit({ activeCount, maxLimit, byMerchant })` 與 `buildBookingLimitWhere(merchantId, phone, now)`（供測試與 Prisma `count` 共用 where 條件）
- 計入：同 `merchantId` + `normalizePhone(phone)` + `status='CONFIRMED'` + `startAt >= now()`
- 略過：`byMerchant: true` 商家代客預約一律放行（與 `cancelPolicy` 略過策略一致）
- 顧客面 `book.vue` 收到 409 + `MSG_BOOKING_LIMIT_EXCEEDED` 時用 `ElMessageBox.alert` 並導向 `/m/[slug]/my-bookings`

## 取消政策

`Merchant.cancelPolicy: Json` 結構：
```typescript
{ mode: 'free' | 'cutoff', hoursBeforeCannotCancel?: number }
```

- `mode: 'free'` 永遠可取消
- `mode: 'cutoff'`：開始時間前 `hoursBeforeCannotCancel` 小時內禁止顧客取消，回 400 `MSG_CANCEL_TOO_LATE`
- 商家代客取消（`/appointment/[id]/cancel`）傳 `byMerchant: true` 略過政策

`booking.ts/parseCancelPolicy` 容錯：JSON 結構錯誤一律降級為 `{ mode: 'free' }`。

## 顧客識別

顧客沒有帳號，用 **`lastName + title + phone`** 三元組識別（見 [data-model.md](./data-model.md#顧客識別三元組)）。`normalizePhone` 寫入前去 `\s` 與 `-`。

## RESOURCE_OPTIONAL 模式（可選資源）

支援「顧客可指定醫師、也可不指定由系統自動分配」的場景（如牙科診所拔牙）。實作分兩條路徑：

### Availability 路徑

外殼 `computeAvailability` 內以單一 helper `computeSlotsForResource(resourceId | null)` 對某資源算 `Slot[]`；依模式 + 是否帶 `resourceId` 分流：

- **RESOURCE_OPTIONAL + 帶 resourceId**：等同 RESOURCE，驗綁定 → `computeSlotsForResource(rid)`
- **RESOURCE_OPTIONAL + 未帶 resourceId**：查所有 active 綁定資源 → 各自呼叫 helper → 純函式 `mergeResourceSlots(perResourceSlots[])` 做 union 聚合

### `mergeResourceSlots` 純函式契約

- 以 `startAt` 為 key 對齊；任一資源 `remaining>0` → 輸出 `remaining=1`
- 全部 `remaining=0`：所有候選 `reason='past'` → `past`；否則 `taken`
- 某 startAt 在所有資源 slots 都不存在（皆不在班）→ 不出現
- `capacity` 恆為 1（RESOURCE_OPTIONAL 每筆預約僅佔一資源 slot）

### Booking auto-assign

`createAppointment` 對 `RESOURCE_OPTIONAL && !resourceId` 在 advisory lock 內呼叫 `pickAutoAssignResource(tx, params)`：

1. 對每個候選資源呼叫 `isResourceOnDutyAt(tx, ...)` 檢查在班狀態（查 MerchantHoliday → ScheduleOverride → ScheduleRule scope=RESOURCE）
2. 過濾掉在班但已被佔的資源
3. 對剩餘候選查未來 30d CONFIRMED 預約數
4. 純函式 `pickByLoadBalance(candidates)` 依「count 升序、id 升序」取第一個
5. 將該 `resourceId` 寫入 `Appointment.resourceId`，`mode='RESOURCE_OPTIONAL'`
6. 無候選 → 回 `MSG_SLOT_TAKEN`

### Advisory lock key 設計

- 顧客指定 resourceId：`buildLockKey(merchantId, resourceId, startAt)` = `appt:m:r:t`
- auto-assign（無 resourceId）：`buildAutoAssignLockKey(merchantId, serviceId, startAt)` = `appt-auto:m:s:t`

兩種鎖 key 前綴不同避免衝突；同 service 同時段 + 不同 auto-assign 請求會被序列化，避免分到同資源。「指定 vs auto」並發時鎖 key 不同，但 auto-assign 在 lock 內重檢 occupancy 會自然跳過已被搶走的資源。

## Provider 制（introduce-provider-model）

商家層級開關 `Merchant.providerModeEnabled` + 服務層級 `Service.requiresProvider` 雙層控制。兩者皆 `default false`，**既有商家行為 100% 不變**。

### Availability 引擎 Provider 分支

`computeAvailability` 在主分支之前加判定：

```
if (!merchant.providerModeEnabled) → 既有邏輯（providerId 一律忽略）
else if (service.requiresProvider && providerId) →
    新分支 computeSlotsForProvider(providerId)：
    - rules: ScheduleRule.where({ scope: 'PROVIDER', providerId, weekday })
    - override: ScheduleOverride.where({ scope: 'PROVIDER', providerId, date })
    - holiday: MerchantHoliday（共用）
    - occupied: Appointment.where({ providerId, status: 'CONFIRMED', startAt range })
    - 驗證 Provider 屬商家、isActive、ProviderService 已綁該服務
else if (service.requiresProvider && !providerId) → 400 MSG_PROVIDER_REQUIRED
else → 退回既有 (TIME_SLOT / TIME_CAPACITY / RESOURCE / RESOURCE_OPTIONAL) 分支
```

### Booking 衝堂檢查

`createAppointment` 在 advisory lock 內額外檢查：當 `effectiveProviderId` 非空，查 `Appointment.where({ providerId, startAt, status: 'CONFIRMED' })` count > 0 → 回 `MSG_PROVIDER_TAKEN`（409）。寫入時把 `providerId` 持久化至 `Appointment.providerId`（`onDelete: SetNull`）。商家 `providerModeEnabled=false` 時忽略傳入的 providerId（不寫）。

### Provider 稱呼解析

`shared/i18n/provider-label.ts/resolveProviderLabel(merchant, locale)` 純函式，三層 fallback：
1. `merchant.providerLabel[locale]` 非空 → 直接回
2. 否則用 `inferMerchantLocale(timezone)` 推斷商家偏好語，回該語自訂 label
3. 否則回 i18n 預設（zh:「服務人員」/ en:「Provider」/ ja:「スタッフ」）

前後端共用，13 個 vitest 覆蓋（`server/__tests__/provider-label.test.ts`）。
