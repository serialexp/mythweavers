-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Landmark" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "color" TEXT,
    "size" TEXT,

    PRIMARY KEY ("mapId", "id"),
    CONSTRAINT "Landmark_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Landmark" ("color", "description", "id", "mapId", "name", "size", "x", "y") SELECT "color", "description", "id", "mapId", "name", "size", "x", "y" FROM "Landmark";
DROP TABLE "Landmark";
ALTER TABLE "new_Landmark" RENAME TO "Landmark";
CREATE INDEX "Landmark_mapId_idx" ON "Landmark"("mapId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
