/*
  Warnings:

  - The `LlmProvider` table is RENAMED to `Provider` (data preserved).
    Prisma's auto-generated migration would have dropped the table; this file
    has been hand-edited to use ALTER TABLE … RENAME so existing rows survive.
  - A unique constraint covering the columns `[imageUsageLogId]` on the table `BalanceLedger` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('FLAT_PER_IMAGE', 'PER_MP_TIERED', 'PER_TILE_STEP');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'IMAGE_USAGE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LlmProtocol" ADD VALUE 'CLOUDFLARE_IMAGE';
ALTER TYPE "LlmProtocol" ADD VALUE 'OPENAI_IMAGE';

-- AlterTable
ALTER TABLE "BalanceLedger" ADD COLUMN     "imageUsageLogId" TEXT;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "summarySegments" JSONB;

-- RenameTable: LlmProvider -> Provider (data preserved). Indexes/constraints
-- on the renamed table are renamed to match Prisma's expected names so future
-- migrations diff cleanly. FKs from LlmModel/LlmProviderTransaction follow
-- the table by OID, so no DROP/RE-ADD is required.
ALTER TABLE "LlmProvider" RENAME TO "Provider";
ALTER INDEX "LlmProvider_pkey" RENAME TO "Provider_pkey";
ALTER INDEX "LlmProvider_name_key" RENAME TO "Provider_name_key";
-- The FKs from LlmModel.providerId and LlmProviderTransaction.providerId
-- reference Provider by OID after the rename, and their constraint names
-- ("LlmModel_providerId_fkey", "LlmProviderTransaction_providerId_fkey") are
-- column-derived, not referenced-table-derived — so no FK rename or recreate
-- is needed and Prisma's introspection will continue to see them unchanged.

-- CreateTable
CREATE TABLE "ImageModel" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "providerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pricingMode" "PricingMode" NOT NULL,
    "defaultSteps" INTEGER,
    "maxWidth" INTEGER,
    "maxHeight" INTEGER,
    "supportedSizes" JSONB,
    "costFlat" DOUBLE PRECISION,
    "costFirstMP" DOUBLE PRECISION,
    "costSubsequentMP" DOUBLE PRECISION,
    "costPerTile" DOUBLE PRECISION,
    "costPerTileStep" DOUBLE PRECISION,
    "priceFlat" DOUBLE PRECISION,
    "priceFirstMP" DOUBLE PRECISION,
    "priceSubsequentMP" DOUBLE PRECISION,
    "pricePerTile" DOUBLE PRECISION,
    "pricePerTileStep" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageUsageLog" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "imageModelId" TEXT,
    "fileId" TEXT,
    "prompt" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "steps" INTEGER,
    "tilesUsed" INTEGER,
    "megapixels" DOUBLE PRECISION,
    "pricingMode" "PricingMode" NOT NULL,
    "priceFlat" DOUBLE PRECISION,
    "priceFirstMP" DOUBLE PRECISION,
    "priceSubsequentMP" DOUBLE PRECISION,
    "pricePerTile" DOUBLE PRECISION,
    "pricePerTileStep" DOUBLE PRECISION,
    "cost" DECIMAL(12,6) NOT NULL,
    "durationMs" INTEGER,
    "aborted" BOOLEAN NOT NULL DEFAULT false,
    "errored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageUsageLog_pkey" PRIMARY KEY ("id")
);

-- (Provider_name_key index was preserved by the table rename above.)

-- CreateIndex
CREATE INDEX "ImageModel_enabled_idx" ON "ImageModel"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ImageModel_providerId_modelId_key" ON "ImageModel"("providerId", "modelId");

-- CreateIndex
CREATE INDEX "ImageUsageLog_userId_idx" ON "ImageUsageLog"("userId");

-- CreateIndex
CREATE INDEX "ImageUsageLog_userId_createdAt_idx" ON "ImageUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageUsageLog_createdAt_idx" ON "ImageUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "ImageUsageLog_imageModelId_idx" ON "ImageUsageLog"("imageModelId");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceLedger_imageUsageLogId_key" ON "BalanceLedger"("imageUsageLogId");

-- (FKs LlmModel.providerId and LlmProviderTransaction.providerId continue to
-- reference Provider — the table-rename above preserved them by OID.)

-- AddForeignKey
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_imageUsageLogId_fkey" FOREIGN KEY ("imageUsageLogId") REFERENCES "ImageUsageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageModel" ADD CONSTRAINT "ImageModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageUsageLog" ADD CONSTRAINT "ImageUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageUsageLog" ADD CONSTRAINT "ImageUsageLog_imageModelId_fkey" FOREIGN KEY ("imageModelId") REFERENCES "ImageModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageUsageLog" ADD CONSTRAINT "ImageUsageLog_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
