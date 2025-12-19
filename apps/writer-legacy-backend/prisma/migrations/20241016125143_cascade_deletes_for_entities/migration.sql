-- DropForeignKey
ALTER TABLE `AccessKey` DROP FOREIGN KEY `AccessKey_ownerId_fkey`;

-- DropForeignKey
ALTER TABLE `Book` DROP FOREIGN KEY `Book_storyId_fkey`;

-- DropForeignKey
ALTER TABLE `BookShelfStory` DROP FOREIGN KEY `BookShelfStory_ownerId_fkey`;

-- DropForeignKey
ALTER TABLE `BookShelfStory` DROP FOREIGN KEY `BookShelfStory_storyId_fkey`;

-- DropForeignKey
ALTER TABLE `File` DROP FOREIGN KEY `File_ownerId_fkey`;

-- DropForeignKey
ALTER TABLE `File` DROP FOREIGN KEY `File_storyId_fkey`;

-- DropForeignKey
ALTER TABLE `ParagraphComment` DROP FOREIGN KEY `ParagraphComment_ownerId_fkey`;

-- DropForeignKey
ALTER TABLE `ParagraphComment` DROP FOREIGN KEY `ParagraphComment_paragraphRevisionId_fkey`;

-- DropForeignKey
ALTER TABLE `ParagraphRevision` DROP FOREIGN KEY `ParagraphRevision_paragraphId_fkey`;

-- DropForeignKey
ALTER TABLE `Scene` DROP FOREIGN KEY `Scene_chapterId_fkey`;

-- DropForeignKey
ALTER TABLE `Session` DROP FOREIGN KEY `Session_ownerId_fkey`;

-- DropForeignKey
ALTER TABLE `Story` DROP FOREIGN KEY `Story_ownerId_fkey`;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessKey` ADD CONSTRAINT `AccessKey_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookShelfStory` ADD CONSTRAINT `BookShelfStory_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookShelfStory` ADD CONSTRAINT `BookShelfStory_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Story` ADD CONSTRAINT `Story_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Book` ADD CONSTRAINT `Book_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Scene` ADD CONSTRAINT `Scene_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `Chapter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParagraphRevision` ADD CONSTRAINT `ParagraphRevision_paragraphId_fkey` FOREIGN KEY (`paragraphId`) REFERENCES `Paragraph`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParagraphComment` ADD CONSTRAINT `ParagraphComment_paragraphRevisionId_fkey` FOREIGN KEY (`paragraphRevisionId`) REFERENCES `ParagraphRevision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParagraphComment` ADD CONSTRAINT `ParagraphComment_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
