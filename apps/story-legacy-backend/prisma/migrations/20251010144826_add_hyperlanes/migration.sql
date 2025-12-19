-- CreateTable
CREATE TABLE "Hyperlane" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "speedMultiplier" REAL NOT NULL DEFAULT 10.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hyperlane_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HyperlaneSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hyperlaneId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startX" REAL NOT NULL,
    "startY" REAL NOT NULL,
    "endX" REAL NOT NULL,
    "endY" REAL NOT NULL,
    "startLandmarkId" TEXT,
    "endLandmarkId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HyperlaneSegment_hyperlaneId_fkey" FOREIGN KEY ("hyperlaneId") REFERENCES "Hyperlane" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Hyperlane_mapId_idx" ON "Hyperlane"("mapId");

-- CreateIndex
CREATE INDEX "HyperlaneSegment_hyperlaneId_idx" ON "HyperlaneSegment"("hyperlaneId");

-- CreateIndex
CREATE INDEX "HyperlaneSegment_mapId_idx" ON "HyperlaneSegment"("mapId");

-- CreateIndex
CREATE INDEX "HyperlaneSegment_startLandmarkId_idx" ON "HyperlaneSegment"("startLandmarkId");

-- CreateIndex
CREATE INDEX "HyperlaneSegment_endLandmarkId_idx" ON "HyperlaneSegment"("endLandmarkId");
