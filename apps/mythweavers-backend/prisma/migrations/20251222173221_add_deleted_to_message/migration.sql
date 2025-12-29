-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Message_sceneId_deleted_idx" ON "Message"("sceneId", "deleted");
