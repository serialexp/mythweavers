-- CreateTable
CREATE TABLE `StoryReadStatus` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `lastChapterId` VARCHAR(191) NULL,
    `lastChapterReadAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StoryReadStatus` ADD CONSTRAINT `StoryReadStatus_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryReadStatus` ADD CONSTRAINT `StoryReadStatus_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryReadStatus` ADD CONSTRAINT `StoryReadStatus_lastChapterId_fkey` FOREIGN KEY (`lastChapterId`) REFERENCES `Chapter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
