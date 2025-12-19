-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "input" TEXT NOT NULL DEFAULT '',
    "storySetting" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "instruction" TEXT,
    "timestamp" DATETIME NOT NULL,
    "tokensPerSecond" REAL,
    "totalTokens" INTEGER,
    "promptTokens" INTEGER,
    "isQuery" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "paragraphSummary" TEXT,
    "isExpanded" BOOLEAN NOT NULL DEFAULT false,
    "isSummarizing" BOOLEAN NOT NULL DEFAULT false,
    "think" TEXT,
    "showThink" BOOLEAN NOT NULL DEFAULT false,
    "sceneAnalysis" JSONB,
    "isAnalyzing" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Message_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isProtagonist" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Character_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContextItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ContextItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Story_savedAt_idx" ON "Story"("savedAt");

-- CreateIndex
CREATE INDEX "Message_storyId_order_idx" ON "Message"("storyId", "order");

-- CreateIndex
CREATE INDEX "Character_storyId_idx" ON "Character"("storyId");

-- CreateIndex
CREATE INDEX "ContextItem_storyId_idx" ON "ContextItem"("storyId");
