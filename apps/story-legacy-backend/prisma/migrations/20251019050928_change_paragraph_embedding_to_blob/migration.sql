/*
  Warnings:

  - You are about to alter the column `embedding` on the `ParagraphEmbedding` table. The data in that column could be lost. The data in that column will be cast from `Json` to `Binary`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ParagraphEmbedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "paragraphIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" BLOB NOT NULL,
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParagraphEmbedding_storyId_messageId_fkey" FOREIGN KEY ("storyId", "messageId") REFERENCES "Message" ("storyId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ParagraphEmbedding" ("content", "createdAt", "dimension", "embedding", "id", "messageId", "model", "paragraphIndex", "storyId", "updatedAt") SELECT "content", "createdAt", "dimension", "embedding", "id", "messageId", "model", "paragraphIndex", "storyId", "updatedAt" FROM "ParagraphEmbedding";
DROP TABLE "ParagraphEmbedding";
ALTER TABLE "new_ParagraphEmbedding" RENAME TO "ParagraphEmbedding";
CREATE INDEX "ParagraphEmbedding_storyId_messageId_idx" ON "ParagraphEmbedding"("storyId", "messageId");
CREATE UNIQUE INDEX "ParagraphEmbedding_storyId_messageId_paragraphIndex_key" ON "ParagraphEmbedding"("storyId", "messageId", "paragraphIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
