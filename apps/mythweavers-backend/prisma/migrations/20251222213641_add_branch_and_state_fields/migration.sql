-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "includeInFull" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" TEXT;
