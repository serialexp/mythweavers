/*
  Warnings:

  - You are about to drop the column `bookId` on the `Chapter` table. All the data in the column will be lost.
  - Added the required column `arcId` to the `Chapter` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Chapter` DROP FOREIGN KEY `Chapter_bookId_fkey`;

-- AlterTable
ALTER TABLE `Book` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `Chapter` DROP COLUMN `bookId`,
    ADD COLUMN `arcId` VARCHAR(191) NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `Arc` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `bookId` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `nodeType` VARCHAR(191) NOT NULL DEFAULT 'story',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Arc` ADD CONSTRAINT `Arc_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chapter` ADD CONSTRAINT `Chapter_arcId_fkey` FOREIGN KEY (`arcId`) REFERENCES `Arc`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
