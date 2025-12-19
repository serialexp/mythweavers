/*
  Warnings:

  - Added the required column `bytes` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `File` ADD COLUMN `bytes` INTEGER NOT NULL,
    ADD COLUMN `height` INTEGER NOT NULL,
    ADD COLUMN `width` INTEGER NOT NULL;
