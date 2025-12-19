/*
  Warnings:

  - You are about to drop the column `order` on the `Chapter` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "expanded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Chapter" ("createdAt", "expanded", "id", "storyId", "summary", "title", "updatedAt") SELECT "createdAt", "expanded", "id", "storyId", "summary", "title", "updatedAt" FROM "Chapter";
DROP TABLE "Chapter";
ALTER TABLE "new_Chapter" RENAME TO "Chapter";
CREATE INDEX "Chapter_storyId_idx" ON "Chapter"("storyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
