-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "audioFileId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
