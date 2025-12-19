-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isProtagonist" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("storyId", "id"),
    CONSTRAINT "Character_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("description", "id", "isProtagonist", "name", "storyId") SELECT "description", "id", "isProtagonist", "name", "storyId" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_storyId_idx" ON "Character"("storyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
