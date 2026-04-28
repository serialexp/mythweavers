/*
  Warnings:

  - A unique constraint covering the columns `[ownerId,storyId,kind]` on the table `BookShelfStory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,storyId]` on the table `StoryReadStatus` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "BookShelfStory_ownerId_kind_idx" ON "BookShelfStory"("ownerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BookShelfStory_ownerId_storyId_kind_key" ON "BookShelfStory"("ownerId", "storyId", "kind");

-- CreateIndex
CREATE INDEX "StoryReadStatus_userId_updatedAt_idx" ON "StoryReadStatus"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoryReadStatus_userId_storyId_key" ON "StoryReadStatus"("userId", "storyId");
