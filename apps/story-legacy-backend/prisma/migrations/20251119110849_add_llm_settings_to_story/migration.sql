-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "input" TEXT NOT NULL DEFAULT '',
    "storySetting" TEXT NOT NULL DEFAULT '',
    "person" TEXT NOT NULL DEFAULT 'third',
    "tense" TEXT NOT NULL DEFAULT 'past',
    "globalScript" TEXT,
    "selectedChapterId" TEXT,
    "selectedNodeId" TEXT,
    "branchChoices" JSONB,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'ollama',
    "model" TEXT,
    "timelineStartTime" INTEGER,
    "timelineEndTime" INTEGER,
    "timelineGranularity" TEXT NOT NULL DEFAULT 'hour',
    CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Story" ("branchChoices", "deleted", "globalScript", "id", "input", "name", "person", "savedAt", "selectedChapterId", "selectedNodeId", "storySetting", "tense", "timelineEndTime", "timelineGranularity", "timelineStartTime", "updatedAt", "userId") SELECT "branchChoices", "deleted", "globalScript", "id", "input", "name", "person", "savedAt", "selectedChapterId", "selectedNodeId", "storySetting", "tense", "timelineEndTime", "timelineGranularity", "timelineStartTime", "updatedAt", "userId" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_savedAt_idx" ON "Story"("savedAt");
CREATE INDEX "Story_deleted_idx" ON "Story"("deleted");
CREATE INDEX "Story_userId_idx" ON "Story"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
