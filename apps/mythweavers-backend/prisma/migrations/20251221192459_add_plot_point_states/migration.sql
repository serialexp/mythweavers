-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "plotPointDefaults" JSONB;

-- CreateTable
CREATE TABLE "PlotPointState" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlotPointState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlotPointState_storyId_idx" ON "PlotPointState"("storyId");

-- CreateIndex
CREATE INDEX "PlotPointState_messageId_idx" ON "PlotPointState"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "PlotPointState_messageId_key_key" ON "PlotPointState"("messageId", "key");

-- AddForeignKey
ALTER TABLE "PlotPointState" ADD CONSTRAINT "PlotPointState_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotPointState" ADD CONSTRAINT "PlotPointState_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
