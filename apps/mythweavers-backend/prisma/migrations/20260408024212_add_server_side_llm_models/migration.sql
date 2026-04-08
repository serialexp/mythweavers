-- CreateEnum
CREATE TYPE "LlmProtocol" AS ENUM ('ANTHROPIC', 'OPENAI_COMPATIBLE');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('CREDIT', 'LLM_USAGE', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "balance" DECIMAL(12,6) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LlmProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "protocol" "LlmProtocol" NOT NULL,
    "envKeyName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmModel" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT,
    "providerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "contextLength" INTEGER,
    "costInput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costOutput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costCacheRead" DOUBLE PRECISION,
    "costCacheWrite" DOUBLE PRECISION,
    "priceInput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceOutput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceCacheRead" DOUBLE PRECISION,
    "priceCacheWrite" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceLedger" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(12,6) NOT NULL,
    "balanceAfter" DECIMAL(12,6) NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "description" TEXT NOT NULL,
    "llmUsageLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmUsageLog" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheCreationTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "priceInput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceOutput" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceCacheRead" DOUBLE PRECISION,
    "priceCacheWrite" DOUBLE PRECISION,
    "cost" DECIMAL(12,6) NOT NULL,
    "durationMs" INTEGER,
    "aborted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LlmProvider_name_key" ON "LlmProvider"("name");

-- CreateIndex
CREATE INDEX "LlmModel_enabled_idx" ON "LlmModel"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "LlmModel_providerId_modelId_key" ON "LlmModel"("providerId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceLedger_llmUsageLogId_key" ON "BalanceLedger"("llmUsageLogId");

-- CreateIndex
CREATE INDEX "BalanceLedger_userId_idx" ON "BalanceLedger"("userId");

-- CreateIndex
CREATE INDEX "BalanceLedger_userId_createdAt_idx" ON "BalanceLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BalanceLedger_createdAt_idx" ON "BalanceLedger"("createdAt");

-- CreateIndex
CREATE INDEX "LlmUsageLog_userId_idx" ON "LlmUsageLog"("userId");

-- CreateIndex
CREATE INDEX "LlmUsageLog_userId_createdAt_idx" ON "LlmUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmUsageLog_createdAt_idx" ON "LlmUsageLog"("createdAt");

-- AddForeignKey
ALTER TABLE "LlmModel" ADD CONSTRAINT "LlmModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LlmProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_llmUsageLogId_fkey" FOREIGN KEY ("llmUsageLogId") REFERENCES "LlmUsageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmUsageLog" ADD CONSTRAINT "LlmUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
