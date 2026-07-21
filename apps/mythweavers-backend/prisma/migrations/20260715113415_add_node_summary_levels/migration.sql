-- AlterTable
ALTER TABLE "Arc" ADD COLUMN     "paragraphSummary" TEXT,
ADD COLUMN     "sentenceSummary" TEXT;

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "paragraphSummary" TEXT,
ADD COLUMN     "sentenceSummary" TEXT;

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "paragraphSummary" TEXT,
ADD COLUMN     "sentenceSummary" TEXT;

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "paragraphSummary" TEXT,
ADD COLUMN     "sentenceSummary" TEXT;
