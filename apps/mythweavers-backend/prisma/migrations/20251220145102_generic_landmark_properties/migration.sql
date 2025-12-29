/*
  Warnings:

  - You are about to drop the column `industry` on the `Landmark` table. All the data in the column will be lost.
  - You are about to drop the column `planetaryBodies` on the `Landmark` table. All the data in the column will be lost.
  - You are about to drop the column `population` on the `Landmark` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `Landmark` table. All the data in the column will be lost.
  - You are about to drop the column `sector` on the `Landmark` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Landmark" DROP COLUMN "industry",
DROP COLUMN "planetaryBodies",
DROP COLUMN "population",
DROP COLUMN "region",
DROP COLUMN "sector",
ADD COLUMN     "properties" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "type" SET DEFAULT 'point';

-- AlterTable
ALTER TABLE "Map" ADD COLUMN     "propertySchema" JSONB;
