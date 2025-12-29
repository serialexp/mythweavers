-- AlterTable
ALTER TABLE "File" ADD COLUMN     "r2Key" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'private';

-- CreateIndex
CREATE INDEX "File_r2Key_idx" ON "File"("r2Key");
