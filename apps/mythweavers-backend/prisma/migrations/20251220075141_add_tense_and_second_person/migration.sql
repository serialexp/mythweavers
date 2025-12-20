-- CreateEnum
CREATE TYPE "Tense" AS ENUM ('PAST', 'PRESENT');

-- AlterEnum
ALTER TYPE "Perspective" ADD VALUE 'SECOND';

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "defaultTense" "Tense" DEFAULT 'PAST';
