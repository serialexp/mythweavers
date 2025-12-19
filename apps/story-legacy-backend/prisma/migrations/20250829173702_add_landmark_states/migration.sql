-- CreateTable
CREATE TABLE "LandmarkState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "landmarkId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LandmarkState_mapId_landmarkId_fkey" FOREIGN KEY ("mapId", "landmarkId") REFERENCES "Landmark" ("mapId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LandmarkState_storyId_messageId_idx" ON "LandmarkState"("storyId", "messageId");

-- CreateIndex
CREATE INDEX "LandmarkState_mapId_landmarkId_idx" ON "LandmarkState"("mapId", "landmarkId");

-- CreateIndex
CREATE UNIQUE INDEX "LandmarkState_mapId_landmarkId_messageId_field_key" ON "LandmarkState"("mapId", "landmarkId", "messageId", "field");
