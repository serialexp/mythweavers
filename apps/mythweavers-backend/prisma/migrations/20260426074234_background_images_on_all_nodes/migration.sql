-- AlterTable
ALTER TABLE "Arc" ADD COLUMN     "defaultBackgroundFileId" TEXT;

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "defaultBackgroundFileId" TEXT;

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "defaultBackgroundFileId" TEXT;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "defaultBackgroundFileId" TEXT;

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "defaultBackgroundFileId" TEXT;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_defaultBackgroundFileId_fkey" FOREIGN KEY ("defaultBackgroundFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_defaultBackgroundFileId_fkey" FOREIGN KEY ("defaultBackgroundFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arc" ADD CONSTRAINT "Arc_defaultBackgroundFileId_fkey" FOREIGN KEY ("defaultBackgroundFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_defaultBackgroundFileId_fkey" FOREIGN KEY ("defaultBackgroundFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_defaultBackgroundFileId_fkey" FOREIGN KEY ("defaultBackgroundFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
