/*
  Warnings:

  - The primary key for the `Character` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ContextItem` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isProtagonist" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("storyId", "id"),
    CONSTRAINT "Character_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("description", "id", "isProtagonist", "name", "storyId") SELECT "description", "id", "isProtagonist", "name", "storyId" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_storyId_idx" ON "Character"("storyId");
CREATE TABLE "new_ContextItem" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("storyId", "id"),
    CONSTRAINT "ContextItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ContextItem" ("description", "id", "isActive", "name", "storyId", "type") SELECT "description", "id", "isActive", "name", "storyId", "type" FROM "ContextItem";
DROP TABLE "ContextItem";
ALTER TABLE "new_ContextItem" RENAME TO "ContextItem";
CREATE INDEX "ContextItem_storyId_idx" ON "ContextItem"("storyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
