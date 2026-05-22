-- 引進 Provider（服務人員）模型；純新增、不破壞既有資料
-- 商家層級開關 Merchant.providerModeEnabled 預設 false → 既有商家行為 100% 不變

-- AlterEnum
ALTER TYPE "ScheduleScope" ADD VALUE 'PROVIDER';

-- AlterTable: Merchant 加 Provider 制兩欄位
ALTER TABLE "Merchant"
  ADD COLUMN "providerModeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "providerLabel" JSONB NOT NULL DEFAULT '{}';

-- AlterTable: Service 加需指定 Provider 旗標
ALTER TABLE "Service" ADD COLUMN "requiresProvider" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: ScheduleRule / ScheduleOverride / Appointment 加 providerId（nullable）
ALTER TABLE "ScheduleRule" ADD COLUMN "providerId" TEXT;
ALTER TABLE "ScheduleOverride" ADD COLUMN "providerId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "providerId" TEXT;

-- CreateTable: Provider
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProviderService（多對多）
CREATE TABLE "ProviderService" (
    "providerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "ProviderService_pkey" PRIMARY KEY ("providerId","serviceId")
);

-- CreateIndex
CREATE INDEX "Provider_merchantId_idx" ON "Provider"("merchantId");
CREATE INDEX "ProviderService_serviceId_idx" ON "ProviderService"("serviceId");
CREATE INDEX "ScheduleRule_providerId_weekday_idx" ON "ScheduleRule"("providerId", "weekday");
CREATE INDEX "ScheduleOverride_providerId_date_idx" ON "ScheduleOverride"("providerId", "date");
CREATE INDEX "Appointment_providerId_startAt_idx" ON "Appointment"("providerId", "startAt");

-- AddForeignKey
ALTER TABLE "Provider"
  ADD CONSTRAINT "Provider_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderService"
  ADD CONSTRAINT "ProviderService_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderService"
  ADD CONSTRAINT "ProviderService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleRule"
  ADD CONSTRAINT "ScheduleRule_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScheduleOverride"
  ADD CONSTRAINT "ScheduleOverride_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
