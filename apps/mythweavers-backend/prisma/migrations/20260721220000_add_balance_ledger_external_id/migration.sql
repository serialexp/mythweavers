-- AlterTable
ALTER TABLE "BalanceLedger" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BalanceLedger_externalId_key" ON "BalanceLedger"("externalId");
