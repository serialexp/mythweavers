-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "isSummarizing" BOOLEAN NOT NULL DEFAULT false,
    "think" TEXT,
    "showThink" BOOLEAN NOT NULL DEFAULT false,
    "sceneAnalysis" JSONB,
    "isAnalyzing" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "isCompacted" BOOLEAN NOT NULL DEFAULT false,
    "compactedMessageIds" JSONB,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Message_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("content", "id", "instruction", "isAnalyzing", "isExpanded", "isQuery", "isSummarizing", "order", "paragraphSummary", "promptTokens", "role", "sceneAnalysis", "showThink", "storyId", "summary", "think", "timestamp", "tokensPerSecond", "totalTokens") SELECT "content", "id", "instruction", "isAnalyzing", "isExpanded", "isQuery", "isSummarizing", "order", "paragraphSummary", "promptTokens", "role", "sceneAnalysis", "showThink", "storyId", "summary", "think", "timestamp", "tokensPerSecond", "totalTokens" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_storyId_order_idx" ON "Message"("storyId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
