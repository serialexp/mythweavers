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
    "deleted" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Story" ("globalScript", "id", "input", "name", "person", "savedAt", "storySetting", "tense", "updatedAt") SELECT "globalScript", "id", "input", "name", "person", "savedAt", "storySetting", "tense", "updatedAt" FROM "Story";
DROP TABLE "Story";
ALTER TABLE "new_Story" RENAME TO "Story";
CREATE INDEX "Story_savedAt_idx" ON "Story"("savedAt");
CREATE INDEX "Story_deleted_idx" ON "Story"("deleted");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
