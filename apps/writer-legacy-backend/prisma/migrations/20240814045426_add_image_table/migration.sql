/*
  Warnings:

  - Added the required column `coverArtAsset` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `spineArtAsset` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coverArtAsset` to the `Story` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Book` ADD COLUMN `coverArtAsset` VARCHAR(191) NOT NULL,
    ADD COLUMN `spineArtAsset` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Story` ADD COLUMN `coverArtAsset` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `File` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` INTEGER NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
