-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "instruction" TEXT,
    "timestamp" DATETIME NOT NULL,
    "tokensPerSecond" REAL,
    "totalTokens" INTEGER,
    "promptTokens" INTEGER,
    "cacheCreationTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "isQuery" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "paragraphSummary" TEXT,
    "isExpanded" BOOLEAN NOT NULL DEFAULT false,
    "isInstructionExpanded" BOOLEAN NOT NULL DEFAULT false,
    "isSummarizing" BOOLEAN NOT NULL DEFAULT false,
    "think" TEXT,
    "showThink" BOOLEAN NOT NULL DEFAULT false,
    "sceneAnalysis" JSONB,
    "isAnalyzing" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "isCompacted" BOOLEAN NOT NULL DEFAULT false,
    "compactedMessageIds" JSONB,
    "script" TEXT,
    "order" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "chapterId" TEXT,

    PRIMARY KEY ("storyId", "id"),
    CONSTRAINT "Message_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("cacheCreationTokens", "cacheReadTokens", "chapterId", "compactedMessageIds", "content", "deleted", "id", "instruction", "isAnalyzing", "isCompacted", "isExpanded", "isQuery", "isSummarizing", "model", "order", "paragraphSummary", "promptTokens", "role", "sceneAnalysis", "script", "showThink", "storyId", "summary", "think", "timestamp", "tokensPerSecond", "totalTokens", "type") SELECT "cacheCreationTokens", "cacheReadTokens", "chapterId", "compactedMessageIds", "content", "deleted", "id", "instruction", "isAnalyzing", "isCompacted", "isExpanded", "isQuery", "isSummarizing", "model", "order", "paragraphSummary", "promptTokens", "role", "sceneAnalysis", "script", "showThink", "storyId", "summary", "think", "timestamp", "tokensPerSecond", "totalTokens", "type" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_storyId_order_idx" ON "Message"("storyId", "order");
CREATE INDEX "Message_storyId_deleted_idx" ON "Message"("storyId", "deleted");
CREATE INDEX "Message_storyId_chapterId_idx" ON "Message"("storyId", "chapterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
