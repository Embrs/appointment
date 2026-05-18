## ADDED Requirements

### Requirement: Prisma 設定與遷移

系統 SHALL 提供可運作的 Prisma + PostgreSQL 整合，並透過 `prisma migrate dev` 建立完整 schema。

#### Scenario: prisma 初始化
- **WHEN** 開發者在本機跑 `npx prisma migrate dev --name init`
- **THEN** Prisma SHALL 連到 `DATABASE_URL` 指定的 PostgreSQL
- **AND** SHALL 依 `prisma/schema.prisma` 建立全部 17 張表
- **AND** SHALL 產出 `prisma/migrations/<timestamp>_init/migration.sql`

#### Scenario: prisma studio 可瀏覽
- **WHEN** 開發者跑 `npx prisma studio`
- **THEN** 瀏覽器 SHALL 開啟 Prisma Studio 並列出 17 張表（全部為空表）

#### Scenario: Prisma Client 自動產生
- **WHEN** 執行 `npm install` 後 postinstall 或手動 `npx prisma generate`
- **THEN** SHALL 在 `node_modules/.prisma/client` 產出型別

### Requirement: 平台管理員模型 (AdminUser)

系統 SHALL 提供 `AdminUser` 模型，用於儲存平台管理員帳號。

#### Scenario: AdminUser 欄位
- **WHEN** 查 `AdminUser` 表結構
- **THEN** SHALL 至少包含：`id (cuid)`、`email (unique)`、`passwordHash`、`name`、`isActive (default true)`、`createdAt`、`updatedAt`、`deletedAt (nullable)`

### Requirement: 商家模型 (Merchant)

系統 SHALL 提供 `Merchant` 模型，每個 Merchant 代表一個獨立商家租戶。

#### Scenario: Merchant 欄位
- **WHEN** 查 `Merchant` 表結構
- **THEN** SHALL 至少包含：`id (cuid)`、`slug (unique)`、`name`、`description`、`logoUrl`、`coverUrl`、`timezone (default 'Asia/Taipei')`、`status (enum MerchantStatus default PENDING)`、`cancelPolicy (Json)`、`contactPhone`、`contactEmail`、`address`、`createdAt`、`updatedAt`、`deletedAt (nullable)`

#### Scenario: MerchantStatus enum
- **WHEN** 查 `MerchantStatus` enum
- **THEN** SHALL 包含 `PENDING`、`ACTIVE`、`SUSPENDED`、`REJECTED` 四個值

### Requirement: 商家成員模型 (MerchantUser)

系統 SHALL 提供 `MerchantUser` 模型，每個 MerchantUser 屬於一個 Merchant，支援多人共管。

#### Scenario: MerchantUser 欄位
- **WHEN** 查 `MerchantUser` 表結構
- **THEN** SHALL 至少包含：`id`、`merchantId (FK)`、`email`、`passwordHash`、`name`、`role (enum OWNER/STAFF)`、`isActive`、`createdAt`、`updatedAt`、`deletedAt (nullable)`
- **AND** SHALL 設 `@@unique([merchantId, email])`
- **AND** SHALL 與 `Merchant` 建立 `onDelete: Cascade` 關聯

### Requirement: 服務模型 (Service)

系統 SHALL 提供 `Service` 模型，每個 Service 屬於一個 Merchant，承載四種預約模式之一。

#### Scenario: Service 欄位
- **WHEN** 查 `Service` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`name`、`description`、`bookingMode (enum)`、`durationMinutes`、`slotIntervalMinutes`、`capacityPerSlot (default 1)`、`priceCents (nullable)`、`isActive`、`displayOrder`、`createdAt`、`updatedAt`、`deletedAt (nullable)`

#### Scenario: BookingMode enum
- **WHEN** 查 `BookingMode` enum
- **THEN** SHALL 包含 `TIME_SLOT`、`TIME_CAPACITY`、`RESOURCE`、`QUEUE` 四值

### Requirement: 資源模型 (Resource)

系統 SHALL 提供 `Resource` 模型，每個 Resource 屬於一個 Merchant，可被多個 Service 共用。

#### Scenario: Resource 欄位
- **WHEN** 查 `Resource` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`name`、`description`、`isActive`、`displayOrder`、`createdAt`、`updatedAt`、`deletedAt (nullable)`

### Requirement: 服務與資源多對多 (ServiceResource)

系統 SHALL 提供 `ServiceResource` 中介表，建立 `Service ↔ Resource` 多對多關聯。

#### Scenario: ServiceResource 結構
- **WHEN** 查 `ServiceResource` 表
- **THEN** SHALL 包含 `serviceId`、`resourceId` 兩個 FK
- **AND** SHALL 設 `@@id([serviceId, resourceId])` 為複合主鍵

### Requirement: 時段規則 (ScheduleRule)

系統 SHALL 提供 `ScheduleRule` 模型，定義商家或資源在每週某天的可預約時段範圍。

#### Scenario: ScheduleRule 欄位
- **WHEN** 查 `ScheduleRule` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`scope (enum MERCHANT/RESOURCE)`、`resourceId (nullable)`、`weekday (0-6)`、`startTime (string HH:mm)`、`endTime (string HH:mm)`、`isActive`、`createdAt`、`updatedAt`

### Requirement: 時段覆寫 (ScheduleOverride)

系統 SHALL 提供 `ScheduleOverride` 模型，針對特定日期覆寫每週規則。

#### Scenario: ScheduleOverride 欄位
- **WHEN** 查 `ScheduleOverride` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`scope`、`resourceId (nullable)`、`date (DateTime, only date part)`、`startTime`、`endTime`、`isClosed (boolean)`、`note`、`createdAt`、`updatedAt`

### Requirement: 商家休假日 (MerchantHoliday)

系統 SHALL 提供 `MerchantHoliday` 模型，獨立於 ScheduleOverride，整店休假。

#### Scenario: MerchantHoliday 欄位
- **WHEN** 查 `MerchantHoliday` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`date`、`name (string)`、`createdAt`
- **AND** SHALL 設 `@@unique([merchantId, date])`

### Requirement: 號碼牌領號窗口 (QueueWindow)

系統 SHALL 提供 `QueueWindow` 模型，定義商家每日領號時間範圍。

#### Scenario: QueueWindow 欄位
- **WHEN** 查 `QueueWindow` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`serviceId`、`weekday`、`startTime`、`endTime`、`maxTickets`、`isActive`、`createdAt`、`updatedAt`

### Requirement: 號碼牌 (QueueTicket)

系統 SHALL 提供 `QueueTicket` 模型，代表一張當日號碼牌。

#### Scenario: QueueTicket 欄位
- **WHEN** 查 `QueueTicket` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`serviceId`、`ticketDate (DateTime, only date)`、`ticketNumber (int)`、`status (enum WAITING/CALLED/DONE/SKIPPED/CANCELED)`、`customerLastName`、`customerTitle (enum MR/MRS/MISS/MX)`、`customerPhone`、`takenAt`、`calledAt (nullable)`、`doneAt (nullable)`、`createdAt`、`updatedAt`
- **AND** SHALL 設 `@@unique([merchantId, serviceId, ticketDate, ticketNumber])`

### Requirement: 叫號游標 (QueueCounter)

系統 SHALL 提供 `QueueCounter` 模型，每個 (merchant, service, date) 一行，用作 `SELECT FOR UPDATE` 取號互斥。

#### Scenario: QueueCounter 欄位
- **WHEN** 查 `QueueCounter` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`serviceId`、`counterDate`、`lastTicketNumber (int default 0)`、`lastCalledNumber (int default 0)`、`createdAt`、`updatedAt`
- **AND** SHALL 設 `@@unique([merchantId, serviceId, counterDate])`

### Requirement: 預約模型 (Appointment)

系統 SHALL 提供 `Appointment` 模型，承載四種模式的預約紀錄。

#### Scenario: Appointment 欄位
- **WHEN** 查 `Appointment` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`serviceId`、`resourceId (nullable)`、`mode (enum AppointmentMode)`、`status (enum AppointmentStatus)`、`startAt (DateTime)`、`endAt (DateTime)`、`customerLastName`、`customerTitle`、`customerPhone`、`note`、`cancelReason (nullable)`、`canceledAt (nullable)`、`canceledBy (enum CUSTOMER/MERCHANT/SYSTEM nullable)`、`createdAt`、`updatedAt`
- **AND** SHALL 設 `@@index([merchantId, startAt])`
- **AND** SHALL 設 `@@index([merchantId, customerPhone])`

#### Scenario: AppointmentMode enum
- **THEN** SHALL 包含 `TIME_SLOT`、`TIME_CAPACITY`、`RESOURCE`

#### Scenario: AppointmentStatus enum
- **THEN** SHALL 包含 `CONFIRMED`、`CANCELED`、`NO_SHOW`、`COMPLETED`

### Requirement: 預約歸檔 (AppointmentArchive)

系統 SHALL 提供 `AppointmentArchive` 模型，schema 與 `Appointment` 完全一致，作為三個月以上預約的歸檔。

#### Scenario: AppointmentArchive 欄位
- **WHEN** 查 `AppointmentArchive` 表
- **THEN** SHALL 包含與 `Appointment` 相同的所有欄位（含 `id`、`merchantId`、`serviceId`、`mode`、`status`、`startAt`、`endAt`、三元組顧客資訊、`canceledAt` 等）
- **AND** SHALL 額外含 `archivedAt (DateTime default now())`

### Requirement: Rate limit bucket (RateLimitBucket)

系統 SHALL 提供 `RateLimitBucket` 模型，紀錄某個 key 在某個時間窗的呼叫次數。

#### Scenario: RateLimitBucket 欄位
- **WHEN** 查 `RateLimitBucket` 表
- **THEN** SHALL 至少包含：`id`、`bucketKey (string)`、`windowStart (DateTime)`、`count (int default 0)`、`updatedAt`
- **AND** SHALL 設 `@@unique([bucketKey, windowStart])`

### Requirement: Job 互斥鎖 (JobLock)

系統 SHALL 提供 `JobLock` 模型，給 cron job 取得互斥鎖。

#### Scenario: JobLock 欄位
- **WHEN** 查 `JobLock` 表
- **THEN** SHALL 至少包含：`id`、`jobName (unique)`、`lockedAt`、`lockedBy (string)`、`expiresAt (DateTime)`

### Requirement: 顧客 OTP (CustomerOtp)

系統 SHALL 提供 `CustomerOtp` 模型供未來啟用 OTP，本 change 僅建表，無業務邏輯。

#### Scenario: CustomerOtp 欄位
- **WHEN** 查 `CustomerOtp` 表
- **THEN** SHALL 至少包含：`id`、`merchantId`、`phone`、`otpHash`、`expiresAt`、`consumedAt (nullable)`、`attempts (int default 0)`、`createdAt`
- **AND** SHALL 設 `@@index([merchantId, phone])`
