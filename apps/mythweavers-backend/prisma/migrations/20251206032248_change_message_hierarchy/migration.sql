/*
  Warnings:

  - You are about to drop the column `activeCharacterIds` on the `Chapter` table. All the data in the column will be lost.
  - You are about to drop the column `activeContextItemIds` on the `Chapter` table. All the data in the column will be lost.
  - You are about to drop the column `goal` on the `Chapter` table. All the data in the column will be lost.
  - You are about to drop the column `viewpointCharacterId` on the `Chapter` table. All the data in the column will be lost.
  - You are about to drop the column `sceneId` on the `Paragraph` table. All the data in the column will be lost.
  - You are about to drop the column `aiCharacters` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `cacheCreationTokens` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `cacheReadTokens` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `humanCharacters` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `instruction` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `promptTokens` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `script` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `showThink` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `think` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `tokensPerSecond` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `totalTokens` on the `ParagraphRevision` table. All the data in the column will be lost.
  - You are about to drop the column `body` on the `Scene` table. All the data in the column will be lost.
  - You are about to drop the column `nodeType` on the `Scene` table. All the data in the column will be lost.
  - You are about to drop the column `protagonistId` on the `Scene` table. All the data in the column will be lost.
  - You are about to drop the `SceneCharacter` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SceneReferredCharacter` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[paragraphId,version]` on the table `ParagraphRevision` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `messageRevisionId` to the `Paragraph` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Paragraph" DROP CONSTRAINT "Paragraph_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "Scene" DROP CONSTRAINT "Scene_protagonistId_fkey";

-- DropForeignKey
ALTER TABLE "SceneCharacter" DROP CONSTRAINT "SceneCharacter_characterId_fkey";

-- DropForeignKey
ALTER TABLE "SceneCharacter" DROP CONSTRAINT "SceneCharacter_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "SceneReferredCharacter" DROP CONSTRAINT "SceneReferredCharacter_characterId_fkey";

-- DropForeignKey
ALTER TABLE "SceneReferredCharacter" DROP CONSTRAINT "SceneReferredCharacter_sceneId_fkey";

-- DropIndex
DROP INDEX "Paragraph_sceneId_idx";

-- AlterTable
ALTER TABLE "Chapter" DROP COLUMN "activeCharacterIds",
DROP COLUMN "activeContextItemIds",
DROP COLUMN "goal",
DROP COLUMN "viewpointCharacterId";

-- AlterTable
ALTER TABLE "Paragraph" DROP COLUMN "sceneId",
ADD COLUMN     "currentParagraphRevisionId" TEXT,
ADD COLUMN     "messageRevisionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ParagraphRevision" DROP COLUMN "aiCharacters",
DROP COLUMN "cacheCreationTokens",
DROP COLUMN "cacheReadTokens",
DROP COLUMN "humanCharacters",
DROP COLUMN "instruction",
DROP COLUMN "model",
DROP COLUMN "promptTokens",
DROP COLUMN "role",
DROP COLUMN "script",
DROP COLUMN "showThink",
DROP COLUMN "think",
DROP COLUMN "tokensPerSecond",
DROP COLUMN "totalTokens";

-- AlterTable
ALTER TABLE "Scene" DROP COLUMN "body",
DROP COLUMN "nodeType",
DROP COLUMN "protagonistId",
ADD COLUMN     "activeCharacterIds" JSONB,
ADD COLUMN     "activeContextItemIds" JSONB,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "viewpointCharacterId" TEXT;

-- DropTable
DROP TABLE "SceneCharacter";

-- DropTable
DROP TABLE "SceneReferredCharacter";

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "instruction" TEXT,
    "script" TEXT,
    "currentMessageRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRevision" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "model" TEXT,
    "tokensPerSecond" DOUBLE PRECISION,
    "totalTokens" INTEGER,
    "promptTokens" INTEGER,
    "cacheCreationTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "think" TEXT,
    "showThink" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_sceneId_idx" ON "Message"("sceneId");

-- CreateIndex
CREATE INDEX "MessageRevision_messageId_idx" ON "MessageRevision"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRevision_messageId_version_key" ON "MessageRevision"("messageId", "version");

-- CreateIndex
CREATE INDEX "Paragraph_messageRevisionId_idx" ON "Paragraph"("messageRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ParagraphRevision_paragraphId_version_key" ON "ParagraphRevision"("paragraphId", "version");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_currentMessageRevisionId_fkey" FOREIGN KEY ("currentMessageRevisionId") REFERENCES "MessageRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRevision" ADD CONSTRAINT "MessageRevision_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paragraph" ADD CONSTRAINT "Paragraph_messageRevisionId_fkey" FOREIGN KEY ("messageRevisionId") REFERENCES "MessageRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paragraph" ADD CONSTRAINT "Paragraph_currentParagraphRevisionId_fkey" FOREIGN KEY ("currentParagraphRevisionId") REFERENCES "ParagraphRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
