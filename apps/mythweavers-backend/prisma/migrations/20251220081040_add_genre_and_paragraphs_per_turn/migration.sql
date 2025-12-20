-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "genre" TEXT,
ADD COLUMN     "paragraphsPerTurn" INTEGER NOT NULL DEFAULT 3;
