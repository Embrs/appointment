-- 多診間／多櫃台號碼牌：QueueTicket / QueueCounter 加 resourceId（nullable），改 unique key
-- 既有 row 的 resourceId 自動為 NULL；PostgreSQL 多 NULL 不衝突 ⇒ 單號池路徑零迴歸
-- 不 backfill；不動 QueueTicket_claimToken_key 既有 partial unique index

-- AlterTable: QueueTicket 加 resourceId
ALTER TABLE "QueueTicket" ADD COLUMN "resourceId" TEXT;

-- AlterTable: QueueCounter 加 resourceId
ALTER TABLE "QueueCounter" ADD COLUMN "resourceId" TEXT;

-- DropIndex: 舊 unique（不含 resourceId）
DROP INDEX "QueueTicket_merchantId_serviceId_ticketDate_ticketNumber_key";
DROP INDEX "QueueCounter_merchantId_serviceId_counterDate_key";

-- CreateIndex: 新 unique（含 resourceId）
CREATE UNIQUE INDEX "QueueTicket_merchantId_serviceId_resourceId_ticketDate_tick_key" ON "QueueTicket"("merchantId", "serviceId", "resourceId", "ticketDate", "ticketNumber");
CREATE UNIQUE INDEX "QueueCounter_merchantId_serviceId_resourceId_counterDate_key" ON "QueueCounter"("merchantId", "serviceId", "resourceId", "counterDate");

-- CreateIndex: 新複合 index（按 resource 查當日 WAITING 票）
CREATE INDEX "QueueTicket_merchantId_resourceId_ticketDate_status_idx" ON "QueueTicket"("merchantId", "resourceId", "ticketDate", "status");

-- AddForeignKey: QueueTicket.resourceId → Resource.id（onDelete: Restrict）
ALTER TABLE "QueueTicket" ADD CONSTRAINT "QueueTicket_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: QueueCounter.resourceId → Resource.id（onDelete: Restrict）
ALTER TABLE "QueueCounter" ADD CONSTRAINT "QueueCounter_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
