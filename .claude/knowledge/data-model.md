---
name: 資料模型對照
description: Prisma schema 業務模型分群（商家/服務/排程/預約/號碼牌/系統表）、enum 取值、關鍵索引、軟刪除約定
type: reference
---

# 資料模型對照

`prisma/schema.prisma` 完整模型對照業務語意；schema 由 OpenSpec change `setup-foundation` 一次落地，後續 changes 不再大改。Prisma client 統一從 `@@/utils/prisma` 取（單例）。

## 模型分群

### 商家與成員

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `AdminUser` | 平台管理員 | `email` 唯一、`passwordHash`、`isActive`、`deletedAt` |
| `Merchant` | 商家 | `slug` 唯一、`status: MerchantStatus`、`timezone`（預設 `Asia/Taipei`）、`cancelPolicy: Json`（含 `mode` / `hoursBeforeCannotCancel`）、`maxActiveAppointmentsPerCustomer Int @default(5)`、`providerModeEnabled Boolean @default(false)`、`providerLabel Json @default("{}")`（三語自訂稱呼 `{ zh?, en?, ja? }`，fallback 解析見 `shared/i18n/provider-label.ts`） |
| `MerchantUser` | 商家成員 | `(merchantId, email)` 唯一、`role: MerchantUserRole`、`passwordHash` |

### 服務與資源

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `Service` | 服務 | `bookingMode: BookingMode`、`durationMinutes`、`slotIntervalMinutes`、`capacityPerSlot`、`avgServiceMinutes Int?`（QUEUE ETA 用；fallback 到 `durationMinutes`）、`requiresProvider Boolean @default(false)`（啟用時必須綁 Provider 並指定預約者）、`displayOrder`、軟刪除 |
| `Resource` | 資源（診間 / 設備 / 包廂） | `displayOrder`、軟刪除；啟用 Provider 制後語意聚焦「地點」 |
| `ServiceResource` | 服務↔資源 多對多 | 複合主鍵 `(serviceId, resourceId)` |
| `Provider` | 服務人員（醫師/技師/老師/教練/師傅…） | `name`、`title?`、`bio?`、`avatarUrl?`、`displayOrder`、軟刪除；商家 `providerModeEnabled=true` 時於後台 / 顧客流程暴露 |
| `ProviderService` | 服務↔服務人員 多對多 | 複合主鍵 `(providerId, serviceId)`；`Service.requiresProvider=true` 時必須非空 |

### 排程

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `ScheduleRule` | 每週時段規則 | `scope: ScheduleScope`（MERCHANT / RESOURCE / **PROVIDER**）、`resourceId?`、`providerId?`（PROVIDER scope 必填；其 `resourceId` 為該時段預綁診間）、`weekday`（0=日..6=六）、`startTime/endTime`（`HH:mm`）、`isActive` |
| `ScheduleOverride` | 特定日期覆寫 | `scope` 同上、`resourceId?`、`providerId?`、`date: @db.Date`、`startTime?/endTime?`、`isClosed`、`note?` |
| `MerchantHoliday` | 整店休假日 | `(merchantId, date)` 唯一 |

### 號碼牌

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `QueueWindow` | 領號時間窗（按 weekday） | `(merchantId, serviceId, weekday)` 索引、`maxTickets`（0=無限） |
| `QueueTicket` | 當日號碼牌 | `(merchantId, serviceId, ticketDate, ticketNumber)` 唯一、`status: QueueTicketStatus`、顧客三元組（`customerLastName/Title/Phone`，`customerPhone` 可 null 供 walk-in）、`createdByMerchant Boolean @default(false)`、`claimToken String? @unique`（partial unique；8 碼 nanoid，QR 入口用） |
| `QueueCounter` | 叫號游標（row lock 用） | `(merchantId, serviceId, counterDate)` 唯一、`lastTicketNumber` / `lastCalledNumber` |

詳見 [queue-realtime.md](./queue-realtime.md)。

### 預約

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `Appointment` | 預約紀錄 | `mode: AppointmentMode`、`status: AppointmentStatus`、`startAt/endAt`、`providerId?`（啟用 Provider 制商家寫入；軟刪 Provider `onDelete: SetNull`）、顧客三元組、`canceledAt/By` |
| `AppointmentArchive` | 預約歸檔（schema 同 Appointment） | `archivedAt`、無 FK 到 Resource（保留歷史） |

> Appointment 完成 90 天後由 cron 搬到 Archive，詳見 [deploy-and-env.md](./deploy-and-env.md#cron-jobs)。

### 系統表

| Model | 用途 |
|-------|------|
| `RateLimitBucket` | 速率限制計數（固定窗口）；`(bucketKey, windowStart)` 唯一 |
| `JobLock` | 排程互斥鎖；`jobName` 唯一 + `expiresAt` 過期判斷 |
| `CustomerOtp` | 顧客 OTP（schema 已落但 MVP 不接邏輯） |

## Enum 值速查

| Enum | 值 |
|------|---|
| `MerchantStatus` | `PENDING` / `ACTIVE` / `SUSPENDED` / `REJECTED` |
| `MerchantUserRole` | `OWNER` / `STAFF` |
| `BookingMode` | `TIME_SLOT` / `TIME_CAPACITY` / `RESOURCE` / `RESOURCE_OPTIONAL` / `QUEUE` |
| `ScheduleScope` | `MERCHANT` / `RESOURCE` / `PROVIDER` |
| `AppointmentMode` | `TIME_SLOT` / `TIME_CAPACITY` / `RESOURCE` / `RESOURCE_OPTIONAL`（無 `QUEUE`，號碼牌不進 Appointment） |
| `AppointmentStatus` | `CONFIRMED` / `CANCELED` / `NO_SHOW` / `COMPLETED` |
| `CanceledBy` | `CUSTOMER` / `MERCHANT` / `SYSTEM` |
| `QueueTicketStatus` | `WAITING` / `CALLED` / `DONE` / `SKIPPED` / `CANCELED` |
| `CustomerTitle` | `MR` / `MRS` / `MISS` / `MX` |

## 重要約定

### 軟刪除

`Merchant` / `MerchantUser` / `Service` / `Resource` / `Provider` / `AdminUser` 都有 `deletedAt?`。**所有查詢都必須帶 `deletedAt: null`**，否則會撈到已刪除資料。

### 顧客識別三元組

公開預約／查詢／號碼牌都用 **`lastName + title + phone`** 識別顧客身分（沒有顧客帳號）。
- `phone` 寫入前用 `booking.ts/normalizePhone` 去除 `\s` 與 `-`
- 三元組由 `StoreCustomerSession()` 在 client 端持久化（加密 localStorage）

### Cascade 刪除

`Merchant` 刪除會 cascade 所有子資源（`MerchantUser`、`Service`、`Resource`、所有 Schedule、Queue、Appointment 等）。`Appointment.resourceId` 用 `onDelete: SetNull`（資源刪除不要連帶刪除歷史預約）。

### 種子腳本

`prisma/seed-customer-booking.ts` 建立顧客預約流程的測試資料；遷移檔位於 `prisma/migrations/`。
