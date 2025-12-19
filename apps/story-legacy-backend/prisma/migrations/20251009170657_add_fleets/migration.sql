-- CreateTable
CREATE TABLE "Fleet" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hyperdriveRating" REAL NOT NULL DEFAULT 1.0,
    "defaultX" REAL NOT NULL,
    "defaultY" REAL NOT NULL,
    "color" TEXT,
    "size" TEXT,

    PRIMARY KEY ("mapId", "id"),
    CONSTRAINT "Fleet_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "fleetId" TEXT NOT NULL,
    "startStoryTime" INTEGER NOT NULL,
    "endStoryTime" INTEGER NOT NULL,
    "startX" REAL NOT NULL,
    "startY" REAL NOT NULL,
    "endX" REAL NOT NULL,
    "endY" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetMovement_mapId_fleetId_fkey" FOREIGN KEY ("mapId", "fleetId") REFERENCES "Fleet" ("mapId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Fleet_mapId_idx" ON "Fleet"("mapId");

-- CreateIndex
CREATE INDEX "FleetMovement_storyId_idx" ON "FleetMovement"("storyId");

-- CreateIndex
CREATE INDEX "FleetMovement_mapId_fleetId_idx" ON "FleetMovement"("mapId", "fleetId");

-- CreateIndex
CREATE INDEX "FleetMovement_startStoryTime_idx" ON "FleetMovement"("startStoryTime");

-- CreateIndex
CREATE INDEX "FleetMovement_endStoryTime_idx" ON "FleetMovement"("endStoryTime");
