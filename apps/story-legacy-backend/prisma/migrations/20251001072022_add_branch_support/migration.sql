-- AlterTable
ALTER TABLE "Message" ADD COLUMN "options" JSONB;

-- AlterTable
ALTER TABLE "Story" ADD COLUMN "branchChoices" JSONB;
