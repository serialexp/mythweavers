-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PublishingStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "PublishingStatus" ADD VALUE 'PUBLISHING';

-- AlterTable
ALTER TABLE "ChapterPublishing" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "royalRoadPublishingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RoyalRoadAccount" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "storageStateJson" JSONB,
    "lastLoginAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoyalRoadAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoyalRoadAccount_userId_key" ON "RoyalRoadAccount"("userId");

-- CreateIndex
CREATE INDEX "ChapterPublishing_status_nextAttemptAt_idx" ON "ChapterPublishing"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "RoyalRoadAccount" ADD CONSTRAINT "RoyalRoadAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
