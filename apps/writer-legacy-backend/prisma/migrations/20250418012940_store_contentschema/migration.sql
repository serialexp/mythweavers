-- AlterTable
ALTER TABLE `Chapter` ADD COLUMN `royalRoadId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ParagraphRevision` ADD COLUMN `contentSchema` LONGTEXT NULL;
