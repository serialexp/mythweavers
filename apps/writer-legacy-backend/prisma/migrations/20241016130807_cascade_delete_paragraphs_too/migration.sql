/*
  Warnings:

  - A unique constraint covering the columns `[royalRoadId]` on the table `Story` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `Paragraph` DROP FOREIGN KEY `Paragraph_sceneId_fkey`;

-- CreateIndex
CREATE UNIQUE INDEX `Story_royalRoadId_key` ON `Story`(`royalRoadId`);

-- AddForeignKey
ALTER TABLE `Paragraph` ADD CONSTRAINT `Paragraph_sceneId_fkey` FOREIGN KEY (`sceneId`) REFERENCES `Scene`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
