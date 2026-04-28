-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "backgroundFileId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_backgroundFileId_fkey" FOREIGN KEY ("backgroundFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
