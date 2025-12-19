/*
  Warnings:

  - You are about to drop the `CharacterState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ContextItemState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `isActive` on the `Character` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `ContextItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CharacterState_storyId_characterId_messageId_key";

-- DropIndex
DROP INDEX "CharacterState_storyId_characterId_idx";

-- DropIndex
DROP INDEX "CharacterState_storyId_messageId_idx";

-- DropIndex
DROP INDEX "ContextItemState_storyId_contextItemId_messageId_key";

-- DropIndex
DROP INDEX "ContextItemState_storyId_contextItemId_idx";

-- DropIndex
DROP INDEX "ContextItemState_storyId_messageId_idx";

-- AlterTable
ALTER TABLE "Node" ADD COLUMN "activeCharacterIds" TEXT;
ALTER TABLE "Node" ADD COLUMN "activeContextItemIds" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterState";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ContextItemState";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "birthdate" INTEGER,
    "isProtagonist" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("storyId", "id"),
    CONSTRAINT "Character_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("birthdate", "description", "id", "isProtagonist", "name", "storyId") SELECT "birthdate", "description", "id", "isProtagonist", "name", "storyId" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_storyId_idx" ON "Character"("storyId");
CREATE TABLE "new_ContextItem" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("storyId", "id"),
    CONSTRAINT "ContextItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ContextItem" ("description", "id", "name", "storyId", "type") SELECT "description", "id", "name", "storyId", "type" FROM "ContextItem";
DROP TABLE "ContextItem";
ALTER TABLE "new_ContextItem" RENAME TO "ContextItem";
CREATE INDEX "ContextItem_storyId_idx" ON "ContextItem"("storyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
