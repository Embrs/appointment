-- AlterTable
ALTER TABLE "QueueTicket" ADD COLUMN     "createdByMerchant" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "customerPhone" DROP NOT NULL;
