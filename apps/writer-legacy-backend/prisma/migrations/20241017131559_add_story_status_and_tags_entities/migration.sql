-- AlterTable
ALTER TABLE `Story` ADD COLUMN `status` ENUM('COMPLETED', 'ONGOING', 'HIATUS') NOT NULL DEFAULT 'ONGOING',
    ADD COLUMN `type` ENUM('FANFICTION', 'ORIGINAL') NOT NULL DEFAULT 'ORIGINAL';

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryTag` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StoryTag_storyId_tagId_key`(`storyId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StoryTag` ADD CONSTRAINT `StoryTag_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryTag` ADD CONSTRAINT `StoryTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
