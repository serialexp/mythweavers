/*
  Warnings:

  - You are about to drop the column `storyId` on the `Item` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[characterId,name]` on the table `Item` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `characterId` to the `Item` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_storyId_fkey";

-- DropIndex
DROP INDEX "Item_storyId_idx";

-- DropIndex
DROP INDEX "Item_storyId_name_key";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "storyId",
ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "characterId" TEXT NOT NULL,
ADD COLUMN     "description" TEXT;

-- CreateIndex
CREATE INDEX "Item_characterId_idx" ON "Item"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_characterId_name_key" ON "Item"("characterId", "name");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
