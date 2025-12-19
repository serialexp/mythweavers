-- CreateTable
CREATE TABLE "Map" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Map_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Landmark" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT,

    PRIMARY KEY ("mapId", "id"),
    CONSTRAINT "Landmark_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Map_storyId_idx" ON "Map"("storyId");

-- CreateIndex
CREATE INDEX "Landmark_mapId_idx" ON "Landmark"("mapId");

-- CreateIndex
CREATE INDEX "File_storyId_idx" ON "File"("storyId");
