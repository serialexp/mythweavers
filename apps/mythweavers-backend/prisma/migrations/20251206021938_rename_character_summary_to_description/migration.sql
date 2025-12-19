/*
  Warnings:

  - You are about to drop the column `summary` on the `Character` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Character" DROP COLUMN "summary",
ADD COLUMN     "description" TEXT;
