/*
  Warnings:

  - You are about to drop the column `hyperdriveRating` on the `Pawn` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Pawn" DROP COLUMN "hyperdriveRating",
ADD COLUMN     "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
