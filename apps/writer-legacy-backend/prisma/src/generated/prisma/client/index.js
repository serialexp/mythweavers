Object.defineProperty(exports, '__esModule', { value: true })

const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  getPrismaClient,
  sqltag,
  empty,
  join,
  raw,
  skip,
  Decimal,
  Debug,
  objectEnumValues,
  makeStrictEnum,
  Extensions,
  warnOnce,
  defineDmmfProperty,
  Public,
  getRuntime,
  createParam,
} = require('./runtime/library.js')

const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.6.0
 * Query Engine version: f676762280b54cd07c770017ed3711ddde35f37a
 */
Prisma.prismaVersion = {
  client: '6.6.0',
  engine: 'f676762280b54cd07c770017ed3711ddde35f37a',
}

Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError
Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError
Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError
Prisma.PrismaClientInitializationError = PrismaClientInitializationError
Prisma.PrismaClientValidationError = PrismaClientValidationError
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = sqltag
Prisma.empty = empty
Prisma.join = join
Prisma.raw = raw
Prisma.validator = Public.validator

/**
 * Extensions
 */
Prisma.getExtensionContext = Extensions.getExtensionContext
Prisma.defineExtension = Extensions.defineExtension

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull,
}

const path = require('node:path')

/**
 * Enums
 */
exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable',
})

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  password: 'password',
  role: 'role',
  avatarUrl: 'avatarUrl',
  createdAt: 'createdAt',
}

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  ownerId: 'ownerId',
  validUntil: 'validUntil',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.AccessKeyScalarFieldEnum = {
  id: 'id',
  key: 'key',
  description: 'description',
  ownerId: 'ownerId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  lastUsedAt: 'lastUsedAt',
}

exports.Prisma.BookShelfStoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  ownerId: 'ownerId',
  storyId: 'storyId',
  kind: 'kind',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.StoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  summary: 'summary',
  ownerId: 'ownerId',
  royalRoadId: 'royalRoadId',
  published: 'published',
  status: 'status',
  type: 'type',
  wordsPerWeek: 'wordsPerWeek',
  spellingLevel: 'spellingLevel',
  chapters: 'chapters',
  firstChapterReleasedAt: 'firstChapterReleasedAt',
  lastChapterReleasedAt: 'lastChapterReleasedAt',
  coverArtAsset: 'coverArtAsset',
  coverColor: 'coverColor',
  coverTextColor: 'coverTextColor',
  coverFontFamily: 'coverFontFamily',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  sortOrder: 'sortOrder',
  pages: 'pages',
}

exports.Prisma.TagScalarFieldEnum = {
  id: 'id',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.StoryTagScalarFieldEnum = {
  id: 'id',
  storyId: 'storyId',
  tagId: 'tagId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.StoryReadStatusScalarFieldEnum = {
  id: 'id',
  storyId: 'storyId',
  userId: 'userId',
  lastChapterId: 'lastChapterId',
  lastChapterReadAt: 'lastChapterReadAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.BookScalarFieldEnum = {
  id: 'id',
  name: 'name',
  storyId: 'storyId',
  coverArtAsset: 'coverArtAsset',
  spineArtAsset: 'spineArtAsset',
  pages: 'pages',
  sortOrder: 'sortOrder',
  nodeType: 'nodeType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.ArcScalarFieldEnum = {
  id: 'id',
  name: 'name',
  bookId: 'bookId',
  sortOrder: 'sortOrder',
  nodeType: 'nodeType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.ChapterScalarFieldEnum = {
  id: 'id',
  name: 'name',
  arcId: 'arcId',
  publishedOn: 'publishedOn',
  sortOrder: 'sortOrder',
  royalRoadId: 'royalRoadId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  nodeType: 'nodeType',
}

exports.Prisma.SceneScalarFieldEnum = {
  id: 'id',
  name: 'name',
  body: 'body',
  chapterId: 'chapterId',
  sortOrder: 'sortOrder',
  nodeType: 'nodeType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.ParagraphScalarFieldEnum = {
  id: 'id',
  sceneId: 'sceneId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  sortOrder: 'sortOrder',
}

exports.Prisma.ParagraphRevisionScalarFieldEnum = {
  id: 'id',
  paragraphId: 'paragraphId',
  body: 'body',
  contentSchema: 'contentSchema',
  version: 'version',
  createdAt: 'createdAt',
}

exports.Prisma.ParagraphCommentScalarFieldEnum = {
  id: 'id',
  paragraphRevisionId: 'paragraphRevisionId',
  ownerId: 'ownerId',
  body: 'body',
  type: 'type',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.FileScalarFieldEnum = {
  id: 'id',
  ownerId: 'ownerId',
  storyId: 'storyId',
  localPath: 'localPath',
  path: 'path',
  sha256: 'sha256',
  width: 'width',
  height: 'height',
  bytes: 'bytes',
  mimeType: 'mimeType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.ChapterPublishingScalarFieldEnum = {
  id: 'id',
  chapterId: 'chapterId',
  platform: 'platform',
  status: 'status',
  platformId: 'platformId',
  publishedAt: 'publishedAt',
  lastAttempt: 'lastAttempt',
  errorMessage: 'errorMessage',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc',
}

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last',
}

exports.Prisma.UserOrderByRelevanceFieldEnum = {
  email: 'email',
  name: 'name',
  password: 'password',
  role: 'role',
  avatarUrl: 'avatarUrl',
}

exports.Prisma.SessionOrderByRelevanceFieldEnum = {
  id: 'id',
}

exports.Prisma.AccessKeyOrderByRelevanceFieldEnum = {
  key: 'key',
  description: 'description',
}

exports.Prisma.BookShelfStoryOrderByRelevanceFieldEnum = {
  name: 'name',
  storyId: 'storyId',
}

exports.Prisma.StoryOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  summary: 'summary',
  coverArtAsset: 'coverArtAsset',
  coverColor: 'coverColor',
  coverTextColor: 'coverTextColor',
  coverFontFamily: 'coverFontFamily',
}

exports.Prisma.TagOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
}

exports.Prisma.StoryTagOrderByRelevanceFieldEnum = {
  id: 'id',
  storyId: 'storyId',
  tagId: 'tagId',
}

exports.Prisma.StoryReadStatusOrderByRelevanceFieldEnum = {
  id: 'id',
  storyId: 'storyId',
  lastChapterId: 'lastChapterId',
}

exports.Prisma.BookOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  storyId: 'storyId',
  coverArtAsset: 'coverArtAsset',
  spineArtAsset: 'spineArtAsset',
  nodeType: 'nodeType',
}

exports.Prisma.ArcOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  bookId: 'bookId',
  nodeType: 'nodeType',
}

exports.Prisma.ChapterOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  arcId: 'arcId',
  nodeType: 'nodeType',
}

exports.Prisma.SceneOrderByRelevanceFieldEnum = {
  id: 'id',
  name: 'name',
  body: 'body',
  chapterId: 'chapterId',
  nodeType: 'nodeType',
}

exports.Prisma.ParagraphOrderByRelevanceFieldEnum = {
  id: 'id',
  sceneId: 'sceneId',
}

exports.Prisma.ParagraphRevisionOrderByRelevanceFieldEnum = {
  id: 'id',
  paragraphId: 'paragraphId',
  body: 'body',
  contentSchema: 'contentSchema',
}

exports.Prisma.ParagraphCommentOrderByRelevanceFieldEnum = {
  paragraphRevisionId: 'paragraphRevisionId',
  body: 'body',
}

exports.Prisma.FileOrderByRelevanceFieldEnum = {
  id: 'id',
  storyId: 'storyId',
  localPath: 'localPath',
  path: 'path',
  sha256: 'sha256',
  mimeType: 'mimeType',
}

exports.Prisma.ChapterPublishingOrderByRelevanceFieldEnum = {
  id: 'id',
  chapterId: 'chapterId',
  platformId: 'platformId',
  errorMessage: 'errorMessage',
}
exports.SavedType = exports.$Enums.SavedType = {
  FAVORITE: 'FAVORITE',
  FOLLOW: 'FOLLOW',
  READ_LATER: 'READ_LATER',
}

exports.StoryStatus = exports.$Enums.StoryStatus = {
  COMPLETED: 'COMPLETED',
  ONGOING: 'ONGOING',
  HIATUS: 'HIATUS',
}

exports.StoryType = exports.$Enums.StoryType = {
  FANFICTION: 'FANFICTION',
  ORIGINAL: 'ORIGINAL',
}

exports.ParagraphCommentType = exports.$Enums.ParagraphCommentType = {
  COMMENT: 'COMMENT',
  SUGGESTION: 'SUGGESTION',
}

exports.PublishingPlatform = exports.$Enums.PublishingPlatform = {
  ROYAL_ROAD: 'ROYAL_ROAD',
}

exports.PublishingStatus = exports.$Enums.PublishingStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
}

exports.Prisma.ModelName = {
  User: 'User',
  Session: 'Session',
  AccessKey: 'AccessKey',
  BookShelfStory: 'BookShelfStory',
  Story: 'Story',
  Tag: 'Tag',
  StoryTag: 'StoryTag',
  StoryReadStatus: 'StoryReadStatus',
  Book: 'Book',
  Arc: 'Arc',
  Chapter: 'Chapter',
  Scene: 'Scene',
  Paragraph: 'Paragraph',
  ParagraphRevision: 'ParagraphRevision',
  ParagraphComment: 'ParagraphComment',
  File: 'File',
  ChapterPublishing: 'ChapterPublishing',
}
/**
 * Create the Client
 */
const config = {
  generator: {
    name: 'client',
    provider: {
      fromEnvVar: null,
      value: 'prisma-client-js',
    },
    output: {
      value: '/home/bart/Projects/writer2/apps/server/prisma/src/generated/prisma/client',
      fromEnvVar: null,
    },
    config: {
      engineType: 'library',
    },
    binaryTargets: [
      {
        fromEnvVar: null,
        value: 'debian-openssl-3.0.x',
        native: true,
      },
    ],
    previewFeatures: [],
    sourceFilePath: '/home/bart/Projects/writer2/apps/server/prisma/schema.prisma',
    isCustomOutput: true,
  },
  relativeEnvPaths: {
    rootEnvPath: '../../../../../.env',
    schemaEnvPath: '../../../../../.env',
  },
  relativePath: '../../../..',
  clientVersion: '6.6.0',
  engineVersion: 'f676762280b54cd07c770017ed3711ddde35f37a',
  datasourceNames: ['db'],
  activeProvider: 'mysql',
  postinstall: false,
  inlineDatasources: {
    db: {
      url: {
        fromEnvVar: 'DATABASE_URL',
        value: null,
      },
    },
  },
  inlineSchema:
    'datasource db {\n  provider = "mysql"\n  url      = env("DATABASE_URL")\n}\n\ngenerator client {\n  provider = "prisma-client-js"\n  output   = "src/generated/prisma/client"\n}\n\nmodel User {\n  id                Int                @id @default(autoincrement())\n  email             String             @unique\n  name              String             @unique\n  password          String\n  role              String             @default("user")\n  avatarUrl         String? // Custom avatar URL\n  ownedStories      Story[]\n  bookShelfStories  BookShelfStory[]\n  createdAt         DateTime           @default(now())\n  accessKeys        AccessKey[]\n  paragraphComments ParagraphComment[]\n  files             File[]\n  sessions          Session[]\n  storyReadStatuses StoryReadStatus[]\n}\n\nmodel Session {\n  id         String   @id @default(uuid(7))\n  ownerId    Int\n  owner      User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)\n  validUntil DateTime\n  createdAt  DateTime @default(now())\n  updatedAt  DateTime @updatedAt\n}\n\nmodel AccessKey {\n  id          Int       @id @default(autoincrement())\n  key         String    @unique\n  description String?\n  ownerId     Int\n  owner       User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)\n  createdAt   DateTime  @default(now())\n  updatedAt   DateTime  @updatedAt\n  lastUsedAt  DateTime?\n}\n\nenum SavedType {\n  FAVORITE\n  FOLLOW\n  READ_LATER\n}\n\nmodel BookShelfStory {\n  id        Int       @id @default(autoincrement())\n  name      String    @default("")\n  ownerId   Int\n  owner     User      @relation(fields: [ownerId], references: [id], onDelete: Cascade)\n  storyId   String\n  story     Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)\n  kind      SavedType\n  createdAt DateTime  @default(now())\n  updatedAt DateTime  @updatedAt\n}\n\nenum StoryStatus {\n  COMPLETED\n  ONGOING\n  HIATUS\n}\n\nenum StoryType {\n  FANFICTION\n  ORIGINAL\n}\n\nmodel Story {\n  id                     String            @id @default(uuid(7))\n  name                   String            @default("")\n  summary                String?           @db.Text()\n  ownerId                Int\n  owner                  User              @relation(fields: [ownerId], references: [id], onDelete: Cascade)\n  royalRoadId            Int?              @unique\n  bookShelfStories       BookShelfStory[]\n  published              Boolean           @default(false)\n  status                 StoryStatus       @default(ONGOING)\n  type                   StoryType         @default(ORIGINAL)\n  wordsPerWeek           Int?\n  spellingLevel          Int?              @default(3)\n  chapters               Int?\n  firstChapterReleasedAt DateTime?\n  lastChapterReleasedAt  DateTime?\n  coverArtAsset          String\n  coverColor             String            @default("#000000")\n  coverTextColor         String            @default("#FFFFFF")\n  coverFontFamily        String            @default("Georgia")\n  createdAt              DateTime          @default(now())\n  updatedAt              DateTime          @updatedAt\n  sortOrder              Int               @default(0)\n  pages                  Int?\n  books                  Book[]\n  files                  File[]\n  storyReadStatuses      StoryReadStatus[]\n  storyTags              StoryTag[]\n}\n\nmodel Tag {\n  id        String     @id @default(uuid(7))\n  name      String     @unique\n  createdAt DateTime   @default(now())\n  updatedAt DateTime   @updatedAt\n  storyTags StoryTag[]\n}\n\nmodel StoryTag {\n  id        String   @id @default(uuid(7))\n  storyId   String\n  story     Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)\n  tagId     String\n  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([storyId, tagId])\n}\n\nmodel StoryReadStatus {\n  id                String    @id @default(uuid(7))\n  storyId           String\n  story             Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)\n  userId            Int\n  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)\n  lastChapterId     String?\n  lastChapter       Chapter?  @relation(fields: [lastChapterId], references: [id])\n  lastChapterReadAt DateTime?\n  createdAt         DateTime  @default(now())\n  updatedAt         DateTime  @updatedAt\n}\n\nmodel Book {\n  id            String   @id @default(uuid(7))\n  name          String   @default("")\n  storyId       String\n  story         Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)\n  coverArtAsset String\n  spineArtAsset String\n  pages         Int?\n  arcs          Arc[]\n  sortOrder     Int\n  nodeType      String   @default("story") // "story", "non-story", or "context"\n  createdAt     DateTime @default(now())\n  updatedAt     DateTime @default(now()) @updatedAt\n}\n\nmodel Arc {\n  id        String    @id @default(uuid(7))\n  name      String    @default("")\n  bookId    String\n  book      Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)\n  chapters  Chapter[]\n  sortOrder Int // Added for ordering within a book\n  nodeType  String    @default("story") // Added for consistency ("story", "non-story", "context")\n  createdAt DateTime  @default(now())\n  updatedAt DateTime  @default(now()) @updatedAt\n}\n\nmodel Chapter {\n  id               String              @id @default(uuid(7))\n  name             String              @default("")\n  arcId            String // Changed from bookId\n  arc              Arc                 @relation(fields: [arcId], references: [id], onDelete: Cascade) // Changed from book\n  publishedOn      DateTime?\n  sortOrder        Int\n  royalRoadId      Int? // ID of the chapter on Royal Road\n  scenes           Scene[]\n  StoryReadStatus  StoryReadStatus[]\n  createdAt        DateTime            @default(now())\n  updatedAt        DateTime            @default(now()) @updatedAt\n  nodeType         String              @default("story") // "story", "non-story", or "context"\n  publishingStatus ChapterPublishing[]\n}\n\nmodel Scene {\n  id         String      @id @default(uuid(7))\n  name       String      @default("")\n  body       String      @db.LongText()\n  chapter    Chapter     @relation(fields: [chapterId], references: [id], onDelete: Cascade)\n  chapterId  String\n  sortOrder  Int\n  nodeType   String      @default("story") // "story", "non-story", or "context"\n  createdAt  DateTime    @default(now())\n  updatedAt  DateTime    @updatedAt\n  paragraphs Paragraph[]\n}\n\nmodel Paragraph {\n  id                 String              @id @default(uuid(7))\n  sceneId            String\n  scene              Scene               @relation(fields: [sceneId], references: [id], onDelete: Cascade)\n  paragraphRevisions ParagraphRevision[]\n  createdAt          DateTime            @default(now())\n  updatedAt          DateTime            @default(now()) @updatedAt\n  sortOrder          Int\n}\n\nmodel ParagraphRevision {\n  id               String             @id @default(uuid(7))\n  paragraphId      String\n  paragraph        Paragraph          @relation(fields: [paragraphId], references: [id], onDelete: Cascade)\n  body             String             @db.LongText()\n  contentSchema    String?            @db.LongText() // Store the original content schema as JSON\n  version          Int                @default(1)\n  createdAt        DateTime           @default(now())\n  paragraphComment ParagraphComment[]\n}\n\nenum ParagraphCommentType {\n  COMMENT\n  SUGGESTION\n}\n\nmodel ParagraphComment {\n  id                  Int                  @id @default(autoincrement())\n  paragraphRevisionId String\n  paragraphRevision   ParagraphRevision    @relation(fields: [paragraphRevisionId], references: [id], onDelete: Cascade)\n  ownerId             Int\n  owner               User                 @relation(fields: [ownerId], references: [id], onDelete: Cascade)\n  body                String\n  type                ParagraphCommentType @default(COMMENT)\n  createdAt           DateTime             @default(now())\n  updatedAt           DateTime             @updatedAt\n}\n\nmodel File {\n  id        String   @id @default(uuid(7))\n  ownerId   Int\n  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)\n  storyId   String?\n  story     Story?   @relation(fields: [storyId], references: [id], onDelete: Cascade)\n  localPath String?\n  path      String   @unique\n  sha256    String   @default("")\n  width     Int?\n  height    Int?\n  bytes     Int?\n  mimeType  String\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nenum PublishingPlatform {\n  ROYAL_ROAD\n  // Add more platforms here as they are supported\n}\n\nenum PublishingStatus {\n  DRAFT\n  PUBLISHED\n  FAILED\n}\n\nmodel ChapterPublishing {\n  id           String             @id @default(uuid(7))\n  chapterId    String\n  chapter      Chapter            @relation(fields: [chapterId], references: [id], onDelete: Cascade)\n  platform     PublishingPlatform\n  status       PublishingStatus   @default(DRAFT)\n  platformId   String? // The ID of the chapter on the platform (e.g., Royal Road chapter ID)\n  publishedAt  DateTime? // When we successfully published the chapter\n  lastAttempt  DateTime? // Last time we tried to publish\n  errorMessage String?            @db.Text() // Last error message if publishing failed\n  createdAt    DateTime           @default(now())\n  updatedAt    DateTime           @updatedAt\n\n  @@unique([chapterId, platform])\n  @@unique([platform, platformId]) // Ensure platform IDs are unique per platform\n}\n',
  inlineSchemaHash: '746d591197d2e4723abb8269182d99a1d14ff4a814c2c73fee809e4e720ab8e2',
  copyEngine: true,
}

const fs = require('node:fs')

config.dirname = __dirname
if (!fs.existsSync(path.join(__dirname, 'schema.prisma'))) {
  const alternativePaths = ['prisma/src/generated/prisma/client', 'src/generated/prisma/client']

  const alternativePath =
    alternativePaths.find((altPath) => {
      return fs.existsSync(path.join(process.cwd(), altPath, 'schema.prisma'))
    }) ?? alternativePaths[0]

  config.dirname = path.join(process.cwd(), alternativePath)
  config.isBundled = true
}

config.runtimeDataModel = JSON.parse(
  '{"models":{"User":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"email","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"password","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"role","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"user","isGenerated":false,"isUpdatedAt":false},{"name":"avatarUrl","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"ownedStories","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Story","nativeType":null,"relationName":"StoryToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"bookShelfStories","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"BookShelfStory","nativeType":null,"relationName":"BookShelfStoryToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"accessKeys","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AccessKey","nativeType":null,"relationName":"AccessKeyToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"paragraphComments","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParagraphComment","nativeType":null,"relationName":"ParagraphCommentToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"files","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"File","nativeType":null,"relationName":"FileToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"sessions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Session","nativeType":null,"relationName":"SessionToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"storyReadStatuses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"StoryReadStatus","nativeType":null,"relationName":"StoryReadStatusToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Session":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"SessionToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"validUntil","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"AccessKey":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"key","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"AccessKeyToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"lastUsedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"BookShelfStory":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"BookShelfStoryToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"storyId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"story","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Story","nativeType":null,"relationName":"BookShelfStoryToStory","relationFromFields":["storyId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"kind","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SavedType","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Story":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"","isGenerated":false,"isUpdatedAt":false},{"name":"summary","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":["Text",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"StoryToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"royalRoadId","kind":"scalar","isList":false,"isRequired":false,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"bookShelfStories","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"BookShelfStory","nativeType":null,"relationName":"BookShelfStoryToStory","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"published","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","nativeType":null,"default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"StoryStatus","nativeType":null,"default":"ONGOING","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"StoryType","nativeType":null,"default":"ORIGINAL","isGenerated":false,"isUpdatedAt":false},{"name":"wordsPerWeek","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"spellingLevel","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":3,"isGenerated":false,"isUpdatedAt":false},{"name":"chapters","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"firstChapterReleasedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"lastChapterReleasedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"coverArtAsset","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"coverColor","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"#000000","isGenerated":false,"isUpdatedAt":false},{"name":"coverTextColor","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"#FFFFFF","isGenerated":false,"isUpdatedAt":false},{"name":"coverFontFamily","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"Georgia","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"sortOrder","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"pages","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"books","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Book","nativeType":null,"relationName":"BookToStory","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"files","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"File","nativeType":null,"relationName":"FileToStory","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"storyReadStatuses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"StoryReadStatus","nativeType":null,"relationName":"StoryToStoryReadStatus","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"storyTags","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"StoryTag","nativeType":null,"relationName":"StoryToStoryTag","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Tag":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"storyTags","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"StoryTag","nativeType":null,"relationName":"StoryTagToTag","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"StoryTag":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"storyId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"story","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Story","nativeType":null,"relationName":"StoryToStoryTag","relationFromFields":["storyId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"tagId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"tag","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Tag","nativeType":null,"relationName":"StoryTagToTag","relationFromFields":["tagId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["storyId","tagId"]],"uniqueIndexes":[{"name":null,"fields":["storyId","tagId"]}],"isGenerated":false},"StoryReadStatus":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"storyId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"story","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Story","nativeType":null,"relationName":"StoryToStoryReadStatus","relationFromFields":["storyId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"StoryReadStatusToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"lastChapterId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"lastChapter","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Chapter","nativeType":null,"relationName":"ChapterToStoryReadStatus","relationFromFields":["lastChapterId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"lastChapterReadAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Book":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"","isGenerated":false,"isUpdatedAt":false},{"name":"storyId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"story","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Story","nativeType":null,"relationName":"BookToStory","relationFromFields":["storyId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"coverArtAsset","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"spineArtAsset","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"pages","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"arcs","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Arc","nativeType":null,"relationName":"ArcToBook","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"sortOrder","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"nodeType","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"story","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Arc":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"","isGenerated":false,"isUpdatedAt":false},{"name":"bookId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"book","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Book","nativeType":null,"relationName":"ArcToBook","relationFromFields":["bookId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"chapters","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Chapter","nativeType":null,"relationName":"ArcToChapter","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"sortOrder","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"nodeType","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"story","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Chapter":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"","isGenerated":false,"isUpdatedAt":false},{"name":"arcId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"arc","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Arc","nativeType":null,"relationName":"ArcToChapter","relationFromFields":["arcId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"publishedOn","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"sortOrder","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"royalRoadId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"scenes","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Scene","nativeType":null,"relationName":"ChapterToScene","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"StoryReadStatus","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"StoryReadStatus","nativeType":null,"relationName":"ChapterToStoryReadStatus","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":true},{"name":"nodeType","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"story","isGenerated":false,"isUpdatedAt":false},{"name":"publishingStatus","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ChapterPublishing","nativeType":null,"relationName":"ChapterToChapterPublishing","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Scene":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"","isGenerated":false,"isUpdatedAt":false},{"name":"body","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":["LongText",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"chapter","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Chapter","nativeType":null,"relationName":"ChapterToScene","relationFromFields":["chapterId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"chapterId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"sortOrder","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"nodeType","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"story","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true},{"name":"paragraphs","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Paragraph","nativeType":null,"relationName":"ParagraphToScene","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Paragraph":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"sceneId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"scene","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Scene","nativeType":null,"relationName":"ParagraphToScene","relationFromFields":["sceneId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"paragraphRevisions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParagraphRevision","nativeType":null,"relationName":"ParagraphToParagraphRevision","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":true},{"name":"sortOrder","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ParagraphRevision":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"paragraphId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"paragraph","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Paragraph","nativeType":null,"relationName":"ParagraphToParagraphRevision","relationFromFields":["paragraphId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"body","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":["LongText",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"contentSchema","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":["LongText",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"version","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"paragraphComment","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParagraphComment","nativeType":null,"relationName":"ParagraphCommentToParagraphRevision","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ParagraphComment":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","nativeType":null,"default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"paragraphRevisionId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"paragraphRevision","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParagraphRevision","nativeType":null,"relationName":"ParagraphCommentToParagraphRevision","relationFromFields":["paragraphRevisionId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"ParagraphCommentToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"body","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"ParagraphCommentType","nativeType":null,"default":"COMMENT","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"File":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","nativeType":null,"relationName":"FileToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"storyId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"story","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Story","nativeType":null,"relationName":"FileToStory","relationFromFields":["storyId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"localPath","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"path","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"sha256","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":"","isGenerated":false,"isUpdatedAt":false},{"name":"width","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"height","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"bytes","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"mimeType","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ChapterPublishing":{"dbName":null,"schema":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","nativeType":null,"default":{"name":"uuid","args":[7]},"isGenerated":false,"isUpdatedAt":false},{"name":"chapterId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"chapter","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Chapter","nativeType":null,"relationName":"ChapterToChapterPublishing","relationFromFields":["chapterId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"platform","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PublishingPlatform","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"PublishingStatus","nativeType":null,"default":"DRAFT","isGenerated":false,"isUpdatedAt":false},{"name":"platformId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"publishedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"lastAttempt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":false},{"name":"errorMessage","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","nativeType":["Text",[]],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","nativeType":null,"default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","nativeType":null,"isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["chapterId","platform"],["platform","platformId"]],"uniqueIndexes":[{"name":null,"fields":["chapterId","platform"]},{"name":null,"fields":["platform","platformId"]}],"isGenerated":false}},"enums":{"SavedType":{"values":[{"name":"FAVORITE","dbName":null},{"name":"FOLLOW","dbName":null},{"name":"READ_LATER","dbName":null}],"dbName":null},"StoryStatus":{"values":[{"name":"COMPLETED","dbName":null},{"name":"ONGOING","dbName":null},{"name":"HIATUS","dbName":null}],"dbName":null},"StoryType":{"values":[{"name":"FANFICTION","dbName":null},{"name":"ORIGINAL","dbName":null}],"dbName":null},"ParagraphCommentType":{"values":[{"name":"COMMENT","dbName":null},{"name":"SUGGESTION","dbName":null}],"dbName":null},"PublishingPlatform":{"values":[{"name":"ROYAL_ROAD","dbName":null}],"dbName":null},"PublishingStatus":{"values":[{"name":"DRAFT","dbName":null},{"name":"PUBLISHED","dbName":null},{"name":"FAILED","dbName":null}],"dbName":null}},"types":{}}',
)
defineDmmfProperty(exports.Prisma, config.runtimeDataModel)
config.engineWasm = undefined
config.compilerWasm = undefined

const { warnEnvConflicts } = require('./runtime/library.js')

warnEnvConflicts({
  rootEnvPath: config.relativeEnvPaths.rootEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.rootEnvPath),
  schemaEnvPath:
    config.relativeEnvPaths.schemaEnvPath && path.resolve(config.dirname, config.relativeEnvPaths.schemaEnvPath),
})

const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)

// file annotations for bundling tools to include these files
path.join(__dirname, 'libquery_engine-debian-openssl-3.0.x.so.node')
path.join(process.cwd(), 'prisma/src/generated/prisma/client/libquery_engine-debian-openssl-3.0.x.so.node')
// file annotations for bundling tools to include these files
path.join(__dirname, 'schema.prisma')
path.join(process.cwd(), 'prisma/src/generated/prisma/client/schema.prisma')
