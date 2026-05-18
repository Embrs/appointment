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
3. 進入事務：取 advisory lock → `count CONFIRMED appointments` 重檢 → 超過 capacity 回 409 `MSG_SLOT_TAKEN`，否則 `create`
4. 失敗一律 `return conflictError(...)`，**不 throw**

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
