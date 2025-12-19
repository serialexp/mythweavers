/*
  Warnings:

  - You are about to drop the column `royalRoadId` on the `Chapter` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Chapter_royalRoadId_key` ON `Chapter`;

-- CreateTable
CREATE TABLE `ChapterPublishing` (
    `id` VARCHAR(191) NOT NULL,
    `chapterId` VARCHAR(191) NOT NULL,
    `platform` ENUM('ROYAL_ROAD') NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `platformId` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `lastAttempt` DATETIME(3) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChapterPublishing_chapterId_platform_key`(`chapterId`, `platform`),
    UNIQUE INDEX `ChapterPublishing_platform_platformId_key`(`platform`, `platformId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChapterPublishing` ADD CONSTRAINT `ChapterPublishing_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `Chapter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing royalRoadId data
INSERT INTO `ChapterPublishing` (`id`, `chapterId`, `platform`, `status`, `platformId`, `publishedAt`, `createdAt`, `updatedAt`)
SELECT 
    UUID(), -- Generate a new UUID for each row
    `id`, -- chapterId
    'ROYAL_ROAD', -- platform
    CASE 
        WHEN `publishedOn` IS NOT NULL THEN 'PUBLISHED'
        ELSE 'DRAFT'
    END, -- status
    CAST(`royalRoadId` AS CHAR), -- platformId
    `publishedOn`, -- publishedAt
    CURRENT_TIMESTAMP(3), -- createdAt
    CURRENT_TIMESTAMP(3) -- updatedAt
FROM `Chapter`
WHERE `royalRoadId` IS NOT NULL;

-- AlterTable
ALTER TABLE `Chapter` DROP COLUMN `royalRoadId`;
