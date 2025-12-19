/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `User` MODIFY `name` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_name_key` ON `User`(`name`);
