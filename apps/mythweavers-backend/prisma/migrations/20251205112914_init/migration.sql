-- CreateEnum
CREATE TYPE "SavedType" AS ENUM ('FAVORITE', 'FOLLOW', 'READ_LATER');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('COMPLETED', 'ONGOING', 'HIATUS');

-- CreateEnum
CREATE TYPE "StoryType" AS ENUM ('FANFICTION', 'ORIGINAL');

-- CreateEnum
CREATE TYPE "PublishingPlatform" AS ENUM ('ROYAL_ROAD');

-- CreateEnum
CREATE TYPE "PublishingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ParagraphCommentType" AS ENUM ('COMMENT', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "Perspective" AS ENUM ('FIRST', 'THIRD');

-- CreateEnum
CREATE TYPE "ParagraphState" AS ENUM ('AI', 'DRAFT', 'REVISE', 'FINAL', 'SDT');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookShelfStory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "ownerId" INTEGER NOT NULL,
    "storyId" TEXT NOT NULL,
    "kind" "SavedType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookShelfStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "ownerId" INTEGER NOT NULL,
    "royalRoadId" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "status" "StoryStatus" NOT NULL DEFAULT 'ONGOING',
    "type" "StoryType" NOT NULL DEFAULT 'ORIGINAL',
    "wordsPerWeek" INTEGER,
    "spellingLevel" INTEGER DEFAULT 3,
    "chapters" INTEGER,
    "firstChapterReleasedAt" TIMESTAMP(3),
    "lastChapterReleasedAt" TIMESTAMP(3),
    "coverArtFileId" TEXT,
    "coverColor" TEXT NOT NULL DEFAULT '#000000',
    "coverTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "coverFontFamily" TEXT NOT NULL DEFAULT 'Georgia',
    "defaultPerspective" "Perspective" DEFAULT 'THIRD',
    "defaultProtagonistId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pages" INTEGER,
    "timelineStartTime" INTEGER,
    "timelineEndTime" INTEGER,
    "timelineGranularity" TEXT NOT NULL DEFAULT 'hour',
    "defaultCalendarId" TEXT,
    "branchChoices" JSONB,
    "provider" TEXT NOT NULL DEFAULT 'ollama',
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryTag" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryReadStatus" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "lastChapterId" TEXT,
    "lastChapterReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryReadStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "storyId" TEXT NOT NULL,
    "coverArtFileId" TEXT,
    "spineArtFileId" TEXT,
    "pages" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "nodeType" TEXT NOT NULL DEFAULT 'story',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arc" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "bookId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "nodeType" TEXT NOT NULL DEFAULT 'story',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Arc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "arcId" TEXT NOT NULL,
    "publishedOn" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL,
    "royalRoadId" INTEGER,
    "nodeType" TEXT NOT NULL DEFAULT 'story',
    "activeCharacterIds" JSONB,
    "activeContextItemIds" JSONB,
    "viewpointCharacterId" TEXT,
    "goal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "nodeType" TEXT NOT NULL DEFAULT 'story',
    "perspective" "Perspective",
    "protagonistId" TEXT,
    "storyTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paragraph" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paragraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParagraphRevision" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentSchema" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" "ParagraphState",
    "aiCharacters" INTEGER,
    "humanCharacters" INTEGER,
    "plotPointActions" JSONB,
    "inventoryActions" JSONB,
    "role" TEXT,
    "model" TEXT,
    "tokensPerSecond" DOUBLE PRECISION,
    "totalTokens" INTEGER,
    "promptTokens" INTEGER,
    "cacheCreationTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "think" TEXT,
    "showThink" BOOLEAN NOT NULL DEFAULT false,
    "instruction" TEXT,
    "script" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParagraphRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParagraphComment" (
    "id" SERIAL NOT NULL,
    "paragraphRevisionId" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "type" "ParagraphCommentType" NOT NULL DEFAULT 'COMMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParagraphComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParagraphEmbedding" (
    "id" TEXT NOT NULL,
    "paragraphRevisionId" TEXT NOT NULL,
    "paragraphIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" BYTEA NOT NULL,
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParagraphEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterPublishing" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "platform" "PublishingPlatform" NOT NULL,
    "status" "PublishingStatus" NOT NULL DEFAULT 'DRAFT',
    "platformId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastAttempt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterPublishing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "pictureFileId" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT,
    "nickname" TEXT,
    "summary" TEXT,
    "background" TEXT,
    "personality" TEXT,
    "personalityQuirks" TEXT,
    "likes" TEXT,
    "dislikes" TEXT,
    "age" TEXT,
    "gender" TEXT,
    "sexualOrientation" TEXT,
    "height" INTEGER,
    "hairColor" TEXT,
    "eyeColor" TEXT,
    "distinguishingFeatures" TEXT,
    "writingStyle" TEXT,
    "isMainCharacter" BOOLEAN NOT NULL DEFAULT true,
    "laterVersionOfId" TEXT,
    "significantActions" JSONB,
    "birthdate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextItem" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneCharacter" (
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneCharacter_pkey" PRIMARY KEY ("sceneId","characterId")
);

-- CreateTable
CREATE TABLE "SceneReferredCharacter" (
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneReferredCharacter_pkey" PRIMARY KEY ("sceneId","characterId")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "storyId" TEXT,
    "localPath" TEXT,
    "path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL DEFAULT '',
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Map" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileId" TEXT,
    "borderColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landmark" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "population" TEXT,
    "industry" TEXT,
    "color" TEXT,
    "size" TEXT,
    "region" TEXT,
    "sector" TEXT,
    "planetaryBodies" TEXT,

    CONSTRAINT "Landmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandmarkState" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "landmarkId" TEXT NOT NULL,
    "storyTime" INTEGER,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandmarkState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pawn" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "designation" TEXT,
    "hyperdriveRating" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "defaultX" DOUBLE PRECISION NOT NULL,
    "defaultY" DOUBLE PRECISION NOT NULL,
    "color" TEXT,
    "size" TEXT,

    CONSTRAINT "Pawn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PawnMovement" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "pawnId" TEXT NOT NULL,
    "startStoryTime" INTEGER NOT NULL,
    "endStoryTime" INTEGER NOT NULL,
    "startX" DOUBLE PRECISION NOT NULL,
    "startY" DOUBLE PRECISION NOT NULL,
    "endX" DOUBLE PRECISION NOT NULL,
    "endY" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PawnMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Path" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "speedMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Path_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathSegment" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startX" DOUBLE PRECISION NOT NULL,
    "startY" DOUBLE PRECISION NOT NULL,
    "endX" DOUBLE PRECISION NOT NULL,
    "endY" DOUBLE PRECISION NOT NULL,
    "startLandmarkId" TEXT,
    "endLandmarkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PathSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAttachment" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mediaType" TEXT NOT NULL,
    "duration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaFrame" (
    "id" TEXT NOT NULL,
    "mediaAttachmentId" TEXT NOT NULL,
    "frameNumber" INTEGER NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaSegment" (
    "id" TEXT NOT NULL,
    "mediaAttachmentId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "speaker" TEXT,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaSceneLink" (
    "id" TEXT NOT NULL,
    "mediaAttachmentId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaSceneLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Story_royalRoadId_key" ON "Story"("royalRoadId");

-- CreateIndex
CREATE INDEX "Story_ownerId_idx" ON "Story"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StoryTag_storyId_tagId_key" ON "StoryTag"("storyId", "tagId");

-- CreateIndex
CREATE INDEX "Book_storyId_idx" ON "Book"("storyId");

-- CreateIndex
CREATE INDEX "Arc_bookId_idx" ON "Arc"("bookId");

-- CreateIndex
CREATE INDEX "Chapter_arcId_idx" ON "Chapter"("arcId");

-- CreateIndex
CREATE INDEX "Scene_chapterId_idx" ON "Scene"("chapterId");

-- CreateIndex
CREATE INDEX "Paragraph_sceneId_idx" ON "Paragraph"("sceneId");

-- CreateIndex
CREATE INDEX "ParagraphRevision_paragraphId_idx" ON "ParagraphRevision"("paragraphId");

-- CreateIndex
CREATE INDEX "ParagraphEmbedding_paragraphRevisionId_idx" ON "ParagraphEmbedding"("paragraphRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ParagraphEmbedding_paragraphRevisionId_paragraphIndex_key" ON "ParagraphEmbedding"("paragraphRevisionId", "paragraphIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterPublishing_chapterId_platform_key" ON "ChapterPublishing"("chapterId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterPublishing_platform_platformId_key" ON "ChapterPublishing"("platform", "platformId");

-- CreateIndex
CREATE INDEX "Character_storyId_idx" ON "Character"("storyId");

-- CreateIndex
CREATE INDEX "ContextItem_storyId_idx" ON "ContextItem"("storyId");

-- CreateIndex
CREATE INDEX "ContextItem_storyId_type_idx" ON "ContextItem"("storyId", "type");

-- CreateIndex
CREATE INDEX "Item_storyId_idx" ON "Item"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_storyId_name_key" ON "Item"("storyId", "name");

-- CreateIndex
CREATE INDEX "SceneCharacter_characterId_idx" ON "SceneCharacter"("characterId");

-- CreateIndex
CREATE INDEX "SceneReferredCharacter_characterId_idx" ON "SceneReferredCharacter"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "File_path_key" ON "File"("path");

-- CreateIndex
CREATE INDEX "Calendar_storyId_idx" ON "Calendar"("storyId");

-- CreateIndex
CREATE INDEX "Map_storyId_idx" ON "Map"("storyId");

-- CreateIndex
CREATE INDEX "Landmark_mapId_idx" ON "Landmark"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "Landmark_mapId_id_key" ON "Landmark"("mapId", "id");

-- CreateIndex
CREATE INDEX "LandmarkState_storyId_storyTime_idx" ON "LandmarkState"("storyId", "storyTime");

-- CreateIndex
CREATE INDEX "LandmarkState_mapId_landmarkId_idx" ON "LandmarkState"("mapId", "landmarkId");

-- CreateIndex
CREATE UNIQUE INDEX "LandmarkState_mapId_landmarkId_storyTime_field_key" ON "LandmarkState"("mapId", "landmarkId", "storyTime", "field");

-- CreateIndex
CREATE INDEX "Pawn_mapId_idx" ON "Pawn"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "Pawn_mapId_id_key" ON "Pawn"("mapId", "id");

-- CreateIndex
CREATE INDEX "PawnMovement_storyId_idx" ON "PawnMovement"("storyId");

-- CreateIndex
CREATE INDEX "PawnMovement_mapId_pawnId_idx" ON "PawnMovement"("mapId", "pawnId");

-- CreateIndex
CREATE INDEX "PawnMovement_startStoryTime_idx" ON "PawnMovement"("startStoryTime");

-- CreateIndex
CREATE INDEX "PawnMovement_endStoryTime_idx" ON "PawnMovement"("endStoryTime");

-- CreateIndex
CREATE INDEX "Path_mapId_idx" ON "Path"("mapId");

-- CreateIndex
CREATE INDEX "PathSegment_pathId_idx" ON "PathSegment"("pathId");

-- CreateIndex
CREATE INDEX "PathSegment_mapId_idx" ON "PathSegment"("mapId");

-- CreateIndex
CREATE INDEX "PathSegment_startLandmarkId_idx" ON "PathSegment"("startLandmarkId");

-- CreateIndex
CREATE INDEX "PathSegment_endLandmarkId_idx" ON "PathSegment"("endLandmarkId");

-- CreateIndex
CREATE INDEX "MediaAttachment_storyId_idx" ON "MediaAttachment"("storyId");

-- CreateIndex
CREATE INDEX "MediaFrame_mediaAttachmentId_idx" ON "MediaFrame"("mediaAttachmentId");

-- CreateIndex
CREATE INDEX "MediaFrame_timestamp_idx" ON "MediaFrame"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "MediaFrame_mediaAttachmentId_frameNumber_key" ON "MediaFrame"("mediaAttachmentId", "frameNumber");

-- CreateIndex
CREATE INDEX "MediaSegment_mediaAttachmentId_idx" ON "MediaSegment"("mediaAttachmentId");

-- CreateIndex
CREATE INDEX "MediaSegment_startTime_idx" ON "MediaSegment"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "MediaSegment_mediaAttachmentId_segmentIndex_key" ON "MediaSegment"("mediaAttachmentId", "segmentIndex");

-- CreateIndex
CREATE INDEX "MediaSceneLink_mediaAttachmentId_idx" ON "MediaSceneLink"("mediaAttachmentId");

-- CreateIndex
CREATE INDEX "MediaSceneLink_sceneId_idx" ON "MediaSceneLink"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaSceneLink_mediaAttachmentId_sceneId_key" ON "MediaSceneLink"("mediaAttachmentId", "sceneId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookShelfStory" ADD CONSTRAINT "BookShelfStory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookShelfStory" ADD CONSTRAINT "BookShelfStory_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_coverArtFileId_fkey" FOREIGN KEY ("coverArtFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_defaultProtagonistId_fkey" FOREIGN KEY ("defaultProtagonistId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_defaultCalendarId_fkey" FOREIGN KEY ("defaultCalendarId") REFERENCES "Calendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTag" ADD CONSTRAINT "StoryTag_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTag" ADD CONSTRAINT "StoryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryReadStatus" ADD CONSTRAINT "StoryReadStatus_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryReadStatus" ADD CONSTRAINT "StoryReadStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryReadStatus" ADD CONSTRAINT "StoryReadStatus_lastChapterId_fkey" FOREIGN KEY ("lastChapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_coverArtFileId_fkey" FOREIGN KEY ("coverArtFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_spineArtFileId_fkey" FOREIGN KEY ("spineArtFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arc" ADD CONSTRAINT "Arc_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_arcId_fkey" FOREIGN KEY ("arcId") REFERENCES "Arc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_protagonistId_fkey" FOREIGN KEY ("protagonistId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paragraph" ADD CONSTRAINT "Paragraph_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphRevision" ADD CONSTRAINT "ParagraphRevision_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "Paragraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphComment" ADD CONSTRAINT "ParagraphComment_paragraphRevisionId_fkey" FOREIGN KEY ("paragraphRevisionId") REFERENCES "ParagraphRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphComment" ADD CONSTRAINT "ParagraphComment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParagraphEmbedding" ADD CONSTRAINT "ParagraphEmbedding_paragraphRevisionId_fkey" FOREIGN KEY ("paragraphRevisionId") REFERENCES "ParagraphRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterPublishing" ADD CONSTRAINT "ChapterPublishing_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_pictureFileId_fkey" FOREIGN KEY ("pictureFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_laterVersionOfId_fkey" FOREIGN KEY ("laterVersionOfId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem" ADD CONSTRAINT "ContextItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneCharacter" ADD CONSTRAINT "SceneCharacter_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneCharacter" ADD CONSTRAINT "SceneCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneReferredCharacter" ADD CONSTRAINT "SceneReferredCharacter_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneReferredCharacter" ADD CONSTRAINT "SceneReferredCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Map" ADD CONSTRAINT "Map_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landmark" ADD CONSTRAINT "Landmark_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandmarkState" ADD CONSTRAINT "LandmarkState_mapId_landmarkId_fkey" FOREIGN KEY ("mapId", "landmarkId") REFERENCES "Landmark"("mapId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pawn" ADD CONSTRAINT "Pawn_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PawnMovement" ADD CONSTRAINT "PawnMovement_mapId_pawnId_fkey" FOREIGN KEY ("mapId", "pawnId") REFERENCES "Pawn"("mapId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Path" ADD CONSTRAINT "Path_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathSegment" ADD CONSTRAINT "PathSegment_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAttachment" ADD CONSTRAINT "MediaAttachment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaFrame" ADD CONSTRAINT "MediaFrame_mediaAttachmentId_fkey" FOREIGN KEY ("mediaAttachmentId") REFERENCES "MediaAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaSegment" ADD CONSTRAINT "MediaSegment_mediaAttachmentId_fkey" FOREIGN KEY ("mediaAttachmentId") REFERENCES "MediaAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaSceneLink" ADD CONSTRAINT "MediaSceneLink_mediaAttachmentId_fkey" FOREIGN KEY ("mediaAttachmentId") REFERENCES "MediaAttachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaSceneLink" ADD CONSTRAINT "MediaSceneLink_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
