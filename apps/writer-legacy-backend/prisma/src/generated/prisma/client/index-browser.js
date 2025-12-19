Object.defineProperty(exports, '__esModule', { value: true })

const { Decimal, objectEnumValues, makeStrictEnum, Public, getRuntime, skip } = require('./runtime/index-browser.js')

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

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.validator = Public.validator

/**
 * Extensions
 */
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`)
}

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
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(_target, _prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`
        } else {
          message = `PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in \`${runtime.prettyName}\`).`
        }

        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      },
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
