-- AlterTable
ALTER TABLE "Message" ADD COLUMN "paragraphs" JSONB;

-- CreateTable
CREATE TABLE "ParagraphEmbedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "paragraphIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParagraphEmbedding_storyId_messageId_fkey" FOREIGN KEY ("storyId", "messageId") REFERENCES "Message" ("storyId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ParagraphEmbedding_storyId_messageId_idx" ON "ParagraphEmbedding"("storyId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ParagraphEmbedding_storyId_messageId_paragraphIndex_key" ON "ParagraphEmbedding"("storyId", "messageId", "paragraphIndex");
