/*
  Warnings:

  - You are about to alter the column `includeInFull` on the `Chapter` table. The data in that column could be lost. The data in that column will be cast from `Boolean` to `Int`.
  - You are about to alter the column `includeInFull` on the `Node` table. The data in that column could be lost. The data in that column will be cast from `Boolean` to `Int`.

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
    "includeInFull" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Chapter" ("createdAt", "expanded", "id", "includeInFull", "status", "storyId", "summary", "title", "updatedAt") SELECT "createdAt", "expanded", "id", "includeInFull", "status", "storyId", "summary", "title", "updatedAt" FROM "Chapter";
DROP TABLE "Chapter";
ALTER TABLE "new_Chapter" RENAME TO "Chapter";
CREATE INDEX "Chapter_storyId_idx" ON "Chapter"("storyId");
CREATE TABLE "new_Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "order" INTEGER NOT NULL,
    "expanded" BOOLEAN NOT NULL DEFAULT true,
    "includeInFull" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Node_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Node" ("createdAt", "expanded", "id", "includeInFull", "order", "parentId", "status", "storyId", "summary", "title", "type", "updatedAt") SELECT "createdAt", "expanded", "id", "includeInFull", "order", "parentId", "status", "storyId", "summary", "title", "type", "updatedAt" FROM "Node";
DROP TABLE "Node";
ALTER TABLE "new_Node" RENAME TO "Node";
CREATE INDEX "Node_storyId_idx" ON "Node"("storyId");
CREATE INDEX "Node_parentId_idx" ON "Node"("parentId");
CREATE INDEX "Node_storyId_parentId_order_idx" ON "Node"("storyId", "parentId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
