/*
  Warnings:

  - Added the required column `storyId` to the `Book` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Book` ADD COLUMN `storyId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Book` ADD CONSTRAINT `Book_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `Story`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
