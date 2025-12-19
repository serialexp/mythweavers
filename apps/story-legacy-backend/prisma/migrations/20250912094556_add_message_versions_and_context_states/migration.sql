-- CreateTable
CREATE TABLE "CharacterState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterState_storyId_characterId_fkey" FOREIGN KEY ("storyId", "characterId") REFERENCES "Character" ("storyId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterState_storyId_messageId_fkey" FOREIGN KEY ("storyId", "messageId") REFERENCES "Message" ("storyId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContextItemState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "contextItemId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContextItemState_storyId_contextItemId_fkey" FOREIGN KEY ("storyId", "contextItemId") REFERENCES "ContextItem" ("storyId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContextItemState_storyId_messageId_fkey" FOREIGN KEY ("storyId", "messageId") REFERENCES "Message" ("storyId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "versionType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "instruction" TEXT,
    "model" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageVersion_storyId_messageId_fkey" FOREIGN KEY ("storyId", "messageId") REFERENCES "Message" ("storyId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CharacterState_storyId_messageId_idx" ON "CharacterState"("storyId", "messageId");

-- CreateIndex
CREATE INDEX "CharacterState_storyId_characterId_idx" ON "CharacterState"("storyId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterState_storyId_characterId_messageId_key" ON "CharacterState"("storyId", "characterId", "messageId");

-- CreateIndex
CREATE INDEX "ContextItemState_storyId_messageId_idx" ON "ContextItemState"("storyId", "messageId");

-- CreateIndex
CREATE INDEX "ContextItemState_storyId_contextItemId_idx" ON "ContextItemState"("storyId", "contextItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextItemState_storyId_contextItemId_messageId_key" ON "ContextItemState"("storyId", "contextItemId", "messageId");

-- CreateIndex
CREATE INDEX "MessageVersion_storyId_messageId_idx" ON "MessageVersion"("storyId", "messageId");

-- CreateIndex
CREATE INDEX "MessageVersion_createdAt_idx" ON "MessageVersion"("createdAt");
