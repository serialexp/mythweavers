-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Chapter_publishedAt_idx" ON "Chapter"("publishedAt");
