/*
  Warnings:

  - A unique constraint covering the columns `[mapId,landmarkId,storyTime,field]` on the table `LandmarkState` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LandmarkState_mapId_landmarkId_storyTime_field_key" ON "LandmarkState"("mapId", "landmarkId", "storyTime", "field");
