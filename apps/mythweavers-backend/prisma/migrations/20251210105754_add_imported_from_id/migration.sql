/*
  Warnings:

  - A unique constraint covering the columns `[importedFromId]` on the table `Story` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "importedFromId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Story_importedFromId_key" ON "Story"("importedFromId");
