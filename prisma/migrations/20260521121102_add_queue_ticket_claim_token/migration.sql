-- AlterTable
ALTER TABLE "QueueTicket" ADD COLUMN     "claimToken" TEXT;

-- CreateIndex (partial unique: 既有 row 為 NULL 允許共存，新發放 token 必須唯一)
CREATE UNIQUE INDEX "QueueTicket_claimToken_key" ON "QueueTicket"("claimToken") WHERE "claimToken" IS NOT NULL;
