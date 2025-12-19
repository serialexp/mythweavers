/*
  Warnings:

  - You are about to drop the column `coverArtAsset` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `spineArtAsset` on the `Book` table. All the data in the column will be lost.
  - You are about to drop the column `coverArtAsset` on the `Story` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Arc` ADD COLUMN `summary` TEXT NULL;

-- AlterTable
ALTER TABLE `Book` DROP COLUMN `coverArtAsset`,
    DROP COLUMN `spineArtAsset`,
    ADD COLUMN `coverArtFileId` VARCHAR(191) NULL,
    ADD COLUMN `spineArtFileId` VARCHAR(191) NULL,
    ADD COLUMN `summary` TEXT NULL;

-- AlterTable
ALTER TABLE `Chapter` ADD COLUMN `summary` TEXT NULL;

-- AlterTable
ALTER TABLE `ParagraphRevision` ADD COLUMN `aiCharacters` INTEGER NULL,
    ADD COLUMN `humanCharacters` INTEGER NULL,
    ADD COLUMN `inventoryActions` JSON NULL,
    ADD COLUMN `plotPointActions` JSON NULL,
    ADD COLUMN `state` ENUM('AI', 'DRAFT', 'REVISE', 'FINAL', 'SDT') NULL;

-- AlterTable
ALTER TABLE `Scene` ADD COLUMN `locationId` VARCHAR(191) NULL,
    ADD COLUMN `perspective` ENUM('FIRST', 'THIRD') NULL,
    ADD COLUMN `protagonistId` VARCHAR(191) NULL,
    ADD COLUMN `summary` TEXT NULL;

-- AlterTable
ALTER TABLE `Story` DROP COLUMN `coverArtAsset`,
    ADD COLUMN `coverArtFileId` VARCHAR(191) NULL,
    ADD COLUMN `defaultPerspective` ENUM('FIRST', 'THIRD') NULL DEFAULT 'THIRD',
    ADD COLUMN `defaultProtagonistId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Character` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `pictureFileId` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `middleName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `nickname` VARCHAR(191) NULL,
    `summary` TEXT NULL,
    `background` TEXT NULL,
    `personality` TEXT NULL,
    `personalityQuirks` TEXT NULL,
    `likes` TEXT NULL,
    `dislikes` TEXT NULL,
    `age` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `sexualOrientation` VARCHAR(191) NULL,
    `height` INTEGER NULL,
    `hairColor` VARCHAR(191) NULL,
    `eyeColor` VARCHAR(191) NULL,
    `distinguishingFeatures` TEXT NULL,
    `writingStyle` TEXT NULL,
    `isMainCharacter` BOOLEAN NOT NULL DEFAULT true,
    `laterVersionOfId` VARCHAR(191) NULL,
    `significantActions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Character_storyId_idx`(`storyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Location` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `pictureFileId` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Location_storyId_idx`(`storyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlotPoint` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `state` ENUM('INTRODUCED', 'UNRESOLVED', 'RESOLVED') NOT NULL DEFAULT 'UNRESOLVED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlotPoint_storyId_idx`(`storyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Item` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Item_storyId_idx`(`storyId`),
    UNIQUE INDEX `Item_storyId_name_key`(`storyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SceneCharacter` (
    `sceneId` VARCHAR(191) NOT NULL,
    `characterId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SceneCharacter_characterId_idx`(`characterId`),
    PRIMARY KEY (`sceneId`, `characterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SceneReferredCharacter` (
    `sceneId` VARCHAR(191) NOT NULL,
    `characterId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SceneReferredCharacter_characterId_idx`(`characterId`),
    PRIMARY KEY (`sceneId`, `characterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Story` ADD CONSTRAINT `Story_coverArtFileId_fkey` FOREIGN KEY (`coverArtFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Story` ADD CONSTRAINT `Story_defaultProtagonistId_fkey` FOREIGN KEY (`defaultProtagonistId`) REFERENCES `Character`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Book` ADD CONSTRAINT `Book_coverArtFileId_fkey` FOREIGN KEY (`coverArtFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Book` ADD CONSTRAINT `Book_spineArtFileId_fkey` FOREIGN KEY (`spineArtFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Scene` ADD CONSTRAINT `Scene_protagonistId_fkey` FOREIGN KEY (`protagonistId`) REFERENCES `Character`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Scene` ADD CONSTRAINT `Scene_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Character` ADD CONSTRAINT `Character_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Character` ADD CONSTRAINT `Character_pictureFileId_fkey` FOREIGN KEY (`pictureFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Character` ADD CONSTRAINT `Character_laterVersionOfId_fkey` FOREIGN KEY (`laterVersionOfId`) REFERENCES `Character`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Location` ADD CONSTRAINT `Location_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Location` ADD CONSTRAINT `Location_pictureFileId_fkey` FOREIGN KEY (`pictureFileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlotPoint` ADD CONSTRAINT `PlotPoint_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SceneCharacter` ADD CONSTRAINT `SceneCharacter_sceneId_fkey` FOREIGN KEY (`sceneId`) REFERENCES `Scene`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SceneCharacter` ADD CONSTRAINT `SceneCharacter_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SceneReferredCharacter` ADD CONSTRAINT `SceneReferredCharacter_sceneId_fkey` FOREIGN KEY (`sceneId`) REFERENCES `Scene`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SceneReferredCharacter` ADD CONSTRAINT `SceneReferredCharacter_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
