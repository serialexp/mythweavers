-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "order" INTEGER NOT NULL,
    "expanded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Chapter" ("createdAt", "id", "order", "storyId", "summary", "title", "updatedAt") SELECT "createdAt", "id", "order", "storyId", "summary", "title", "updatedAt" FROM "Chapter";
DROP TABLE "Chapter";
ALTER TABLE "new_Chapter" RENAME TO "Chapter";
CREATE INDEX "Chapter_storyId_idx" ON "Chapter"("storyId");
CREATE INDEX "Chapter_storyId_order_idx" ON "Chapter"("storyId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
