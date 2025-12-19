/*
  Warnings:

  - A unique constraint covering the columns `[royalRoadId]` on the table `Chapter` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Chapter` ADD COLUMN `royalRoadId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Chapter_royalRoadId_key` ON `Chapter`(`royalRoadId`);
