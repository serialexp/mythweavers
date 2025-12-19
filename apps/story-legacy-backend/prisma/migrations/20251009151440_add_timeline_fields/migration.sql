-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LandmarkState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "landmarkId" TEXT NOT NULL,
    "messageId" TEXT,
    "storyTime" INTEGER,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LandmarkState_mapId_landmarkId_fkey" FOREIGN KEY ("mapId", "landmarkId") REFERENCES "Landmark" ("mapId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LandmarkState" ("createdAt", "field", "id", "landmarkId", "mapId", "messageId", "storyId", "updatedAt", "value") SELECT "createdAt", "field", "id", "landmarkId", "mapId", "messageId", "storyId", "updatedAt", "value" FROM "LandmarkState";
DROP TABLE "LandmarkState";
ALTER TABLE "new_LandmarkState" RENAME TO "LandmarkState";
CREATE INDEX "LandmarkState_storyId_messageId_idx" ON "LandmarkState"("storyId", "messageId");
CREATE INDEX "LandmarkState_storyId_storyTime_idx" ON "LandmarkState"("storyId", "storyTime");
CREATE INDEX "LandmarkState_mapId_landmarkId_idx" ON "LandmarkState"("mapId", "landmarkId");
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
    "timelineStartTime" INTEGER,
    "timelineEndTime" INTEGER,
    "timelineGranularity" TEXT NOT NULL DEFAULT 'hour',
    CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Story" ("branchChoices", "deleted", "globalScript", "id", "input", "name", "person", "savedAt", "selectedChapterId", "selectedNodeId", "storySetting", "tense", "updatedAt", "userId") SELECT "branchChoices", "deleted", "globalScript", "id", "input", "name", "person", "savedAt", "selectedChapterId", "selectedNodeId", "storySetting", "tense", "updatedAt", "userId" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_savedAt_idx" ON "Story"("savedAt");
CREATE INDEX "Story_deleted_idx" ON "Story"("deleted");
CREATE INDEX "Story_userId_idx" ON "Story"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
