-- AlterTable
ALTER TABLE `Book` ADD COLUMN `nodeType` VARCHAR(191) NOT NULL DEFAULT 'story';

-- AlterTable
ALTER TABLE `Chapter` ADD COLUMN `nodeType` VARCHAR(191) NOT NULL DEFAULT 'story';
