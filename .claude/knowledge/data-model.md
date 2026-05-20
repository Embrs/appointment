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
| `Merchant` | 商家 | `slug` 唯一、`status: MerchantStatus`、`timezone`（預設 `Asia/Taipei`）、`cancelPolicy: Json`（含 `mode` / `hoursBeforeCannotCancel`）、`maxActiveAppointmentsPerCustomer Int @default(5)`（顧客同手機在本店未來 CONFIRMED 預約上限，1–99） |
| `MerchantUser` | 商家成員 | `(merchantId, email)` 唯一、`role: MerchantUserRole`、`passwordHash` |

### 服務與資源

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `Service` | 服務 | `bookingMode: BookingMode`、`durationMinutes`、`slotIntervalMinutes`、`capacityPerSlot`、`displayOrder`、軟刪除 |
| `Resource` | 資源（醫師/設備/包廂） | `displayOrder`、軟刪除 |
| `ServiceResource` | 服務↔資源 多對多 | 複合主鍵 `(serviceId, resourceId)` |

### 排程

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `ScheduleRule` | 每週時段規則 | `scope: ScheduleScope`、`resourceId?`、`weekday`（0=日..6=六）、`startTime/endTime`（`HH:mm`）、`isActive` |
| `ScheduleOverride` | 特定日期覆寫 | `date: @db.Date`、`startTime?/endTime?`、`isClosed`、`note?` |
| `MerchantHoliday` | 整店休假日 | `(merchantId, date)` 唯一 |

### 號碼牌

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `QueueWindow` | 領號時間窗（按 weekday） | `(merchantId, serviceId, weekday)` 索引、`maxTickets`（0=無限） |
| `QueueTicket` | 當日號碼牌 | `(merchantId, serviceId, ticketDate, ticketNumber)` 唯一、`status: QueueTicketStatus`、顧客三元組（`customerLastName/Title/Phone`） |
| `QueueCounter` | 叫號游標（row lock 用） | `(merchantId, serviceId, counterDate)` 唯一、`lastTicketNumber` / `lastCalledNumber` |

詳見 [queue-realtime.md](./queue-realtime.md)。

### 預約

| Model | 用途 | 關鍵欄位 |
|-------|------|---------|
| `Appointment` | 預約紀錄 | `mode: AppointmentMode`、`status: AppointmentStatus`、`startAt/endAt`、顧客三元組、`canceledAt/By` |
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
| `BookingMode` | `TIME_SLOT` / `TIME_CAPACITY` / `RESOURCE` / `QUEUE` |
| `ScheduleScope` | `MERCHANT` / `RESOURCE` |
| `AppointmentMode` | `TIME_SLOT` / `TIME_CAPACITY` / `RESOURCE`（無 `QUEUE`，號碼牌不進 Appointment） |
| `AppointmentStatus` | `CONFIRMED` / `CANCELED` / `NO_SHOW` / `COMPLETED` |
| `CanceledBy` | `CUSTOMER` / `MERCHANT` / `SYSTEM` |
| `QueueTicketStatus` | `WAITING` / `CALLED` / `DONE` / `SKIPPED` / `CANCELED` |
| `CustomerTitle` | `MR` / `MRS` / `MISS` / `MX` |

## 重要約定

### 軟刪除

`Merchant` / `MerchantUser` / `Service` / `Resource` / `AdminUser` 都有 `deletedAt?`。**所有查詢都必須帶 `deletedAt: null`**，否則會撈到已刪除資料。

### 顧客識別三元組

公開預約／查詢／號碼牌都用 **`lastName + title + phone`** 識別顧客身分（沒有顧客帳號）。
- `phone` 寫入前用 `booking.ts/normalizePhone` 去除 `\s` 與 `-`
- 三元組由 `StoreCustomerSession()` 在 client 端持久化（加密 localStorage）

### Cascade 刪除

`Merchant` 刪除會 cascade 所有子資源（`MerchantUser`、`Service`、`Resource`、所有 Schedule、Queue、Appointment 等）。`Appointment.resourceId` 用 `onDelete: SetNull`（資源刪除不要連帶刪除歷史預約）。

### 種子腳本

`prisma/seed-customer-booking.ts` 建立顧客預約流程的測試資料；遷移檔位於 `prisma/migrations/`。
