-- CreateEnum
CREATE TYPE "LlmProviderTransactionType" AS ENUM ('TOP_UP', 'COST_SYNC');

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "aiOverrides" JSONB;

-- CreateTable
CREATE TABLE "LlmProviderTransaction" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" "LlmProviderTransactionType" NOT NULL,
    "amount" DECIMAL(12,6) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "syncKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmProviderTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LlmProviderTransaction_syncKey_key" ON "LlmProviderTransaction"("syncKey");

-- CreateIndex
CREATE INDEX "LlmProviderTransaction_providerId_idx" ON "LlmProviderTransaction"("providerId");

-- CreateIndex
CREATE INDEX "LlmProviderTransaction_providerId_date_idx" ON "LlmProviderTransaction"("providerId", "date");

-- AddForeignKey
ALTER TABLE "LlmProviderTransaction" ADD CONSTRAINT "LlmProviderTransaction_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
