-- AlterTable
ALTER TABLE "Arc" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Arc_deleted_idx" ON "Arc"("deleted");

-- CreateIndex
CREATE INDEX "Book_deleted_idx" ON "Book"("deleted");

-- CreateIndex
CREATE INDEX "Chapter_deleted_idx" ON "Chapter"("deleted");

-- CreateIndex
CREATE INDEX "Scene_deleted_idx" ON "Scene"("deleted");
