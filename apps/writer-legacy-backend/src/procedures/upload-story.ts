import { type Node, contentSchemaToText, languageSchema, storySchema } from '@writer/shared'
import short from 'short-uuid'
import z from 'zod'
import {
  type Paragraph,
  type ParagraphRevision,
  ParagraphState,
  Perspective,
  PlotPointState,
} from '../generated/prisma/client/index.js'
import { Prisma } from '../generated/prisma/client/index.js'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'
import { publishChapterToRoyalRoad } from './publish-to-royal-road.js'
const translator = short()

// Helper function to get File ID by hash
async function getFileIdByHash(
  hash: string | undefined | null,
  storyId: string,
  ownerId: number,
): Promise<string | null> {
  if (!hash) return null
  try {
    const file = await prisma.file.findFirst({
      where: {
        sha256: hash,
        storyId: storyId,
        ownerId: ownerId,
      },
      select: { id: true },
    })
    return file?.id ?? null
  } catch (error) {
    console.error(`Error finding file with hash ${hash}:`, error)
    return null
  }
}

// Helper function to build maps for relationships including Arcs
function buildRelationshipMaps(structure: Node[]) {
  const arcToBookMap = new Map<string, string>()
  const chapterToArcMap = new Map<string, string>()
  const sceneToChapterMap = new Map<string, string>()
  const nodeTypes = {
    book: new Map<string, Node['nodeType']>(),
    arc: new Map<string, Node['nodeType']>(),
    chapter: new Map<string, Node['nodeType']>(),
    scene: new Map<string, Node['nodeType']>(),
  }
  const sortOrders = {
    book: new Map<string, number>(),
    arc: new Map<string, number>(),
    chapter: new Map<string, number>(),
    scene: new Map<string, number>(),
  }

  function traverse(
    node: Node,
    currentBookId: string | null,
    currentArcId: string | null,
    currentChapterId: string | null,
    parentNodeType: Node['nodeType'] = 'story',
  ) {
    let bookId = currentBookId
    let arcId = currentArcId
    let chapterId = currentChapterId

    // Determine the node type based on parent or its own setting
    const nodeType = node.nodeType || parentNodeType

    if (node.type === 'book') {
      bookId = node.id
      nodeTypes.book.set(node.id, nodeType)
      sortOrders.book.set(node.id, sortOrders.book.size)
    } else if (node.type === 'arc') {
      arcId = node.id
      if (bookId) {
        arcToBookMap.set(arcId, bookId)
        const bookNodeType = nodeTypes.book.get(bookId) || 'story'
        nodeTypes.arc.set(node.id, nodeType === 'story' ? bookNodeType : nodeType)
      } else {
        nodeTypes.arc.set(node.id, nodeType)
      }
      sortOrders.arc.set(node.id, sortOrders.arc.size)
    } else if (node.type === 'chapter') {
      chapterId = node.id
      if (arcId) {
        chapterToArcMap.set(chapterId, arcId)
        const arcNodeType = nodeTypes.arc.get(arcId) || 'story'
        nodeTypes.chapter.set(node.id, nodeType === 'story' ? arcNodeType : nodeType)
      } else {
        // Handle chapters potentially outside arcs if needed, though structure implies they shouldn't be
        nodeTypes.chapter.set(node.id, nodeType)
      }
      sortOrders.chapter.set(node.id, sortOrders.chapter.size)
    } else if (node.type === 'scene' && chapterId) {
      sceneToChapterMap.set(node.id, chapterId)
      const chapterNodeType = nodeTypes.chapter.get(chapterId) || 'story'
      nodeTypes.scene.set(node.id, nodeType === 'story' ? chapterNodeType : nodeType)
      sortOrders.scene.set(node.id, sortOrders.scene.size)
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child, bookId, arcId, chapterId, nodeType)
      }
    }
  }

  for (const rootNode of structure) {
    // Assuming structure starts with books
    traverse(rootNode, null, null, null)
  }

  return {
    arcToBookMap,
    chapterToArcMap,
    sceneToChapterMap,
    nodeTypes,
    sortOrders,
  }
}

// Define the Royal Road credentials schema
const royalRoadCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
})

// Create a new schema that extends the persisted schema
const uploadStorySchema = z.object({
  story: storySchema,
  language: languageSchema,
  royalRoadCredentials: royalRoadCredentialsSchema.optional(),
})

export const uploadStory = protectedProcedure.input(uploadStorySchema).mutation(async ({ input, ctx }) => {
  const { story, language, royalRoadCredentials } = input
  const storyUuid = translator.toUUID(story.id)
  const ownerId = ctx.authenticatedUser.id
  const uploadedFilesMap = story.uploadedFiles ?? {} // Use the uploadedFiles map from input

  // Helper to get hash from path using the uploadedFilesMap
  const getHashFromPath = (relativePath: string | undefined | null): string | null => {
    if (!relativePath) return null
    // Normalize path? (e.g., ensure leading slash?)
    const lookupPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
    return uploadedFilesMap[lookupPath]?.hash ?? null
  }

  // Resolve Story File IDs first using path -> hash -> ID
  const storyCoverArtPath = story.settings?.headerImage
  const storyCoverArtHash = getHashFromPath(storyCoverArtPath)
  const storyCoverArtFileId = await getFileIdByHash(storyCoverArtHash, storyUuid, ownerId)
  const defaultProtagonistUuid = story.settings?.defaultProtagonistId
    ? translator.toUUID(story.settings.defaultProtagonistId)
    : null

  // --- Create or update the Story ---
  const upsertedStory = await prisma.story.upsert({
    where: { id: storyUuid },
    create: {
      id: storyUuid,
      name: story.name,
      ownerId: ownerId,
      summary: story.oneliner, // Added summary
      coverArtFileId: storyCoverArtFileId, // Use resolved File ID
      defaultPerspective: story.settings?.defaultPerspective
        ? story.settings.defaultPerspective === 'first'
          ? Perspective.FIRST
          : Perspective.THIRD
        : Perspective.THIRD, // Added default perspective
      defaultProtagonistId: defaultProtagonistUuid, // Added default protagonist ID
      royalRoadId: story.settings?.royalRoadId ? Number.parseInt(story.settings.royalRoadId) : undefined,
      updatedAt: story.modifiedTime ? new Date(story.modifiedTime) : new Date(), // Use current time if modifiedTime is missing
    },
    update: {
      name: story.name,
      summary: story.oneliner,
      coverArtFileId: storyCoverArtFileId,
      defaultPerspective: story.settings?.defaultPerspective
        ? story.settings.defaultPerspective === 'first'
          ? Perspective.FIRST
          : Perspective.THIRD
        : Perspective.THIRD,
      defaultProtagonistId: defaultProtagonistUuid,
      royalRoadId: story.settings?.royalRoadId ? Number.parseInt(story.settings.royalRoadId) : undefined,
      updatedAt: story.modifiedTime ? new Date(story.modifiedTime) : new Date(),
    },
  })
  // Store the timestamp explicitly
  const storyUpdatedAt = upsertedStory.updatedAt

  // Build the relationship maps including Arcs
  const { arcToBookMap, chapterToArcMap, sceneToChapterMap, nodeTypes, sortOrders } = buildRelationshipMaps(
    story.structure,
  )

  const wordsPerBook = new Map<string, number>()
  let totalWords = 0

  // --- Upsert Books ---
  const existingBooks = new Set<string>()
  for (const bookId in story.book) {
    if (Object.hasOwn(story.book, bookId)) {
      const bookData = story.book[bookId]
      const bookUuid = translator.toUUID(bookId)
      existingBooks.add(bookUuid)
      const sortOrder = sortOrders.book.get(bookId) ?? 0
      const nodeType = nodeTypes.book.get(bookId) || 'story'

      // Resolve Book File IDs using path -> hash -> ID
      const bookCoverPath = bookData.coverImage
      const bookCoverHash = getHashFromPath(bookCoverPath)
      const bookCoverArtFileId = await getFileIdByHash(bookCoverHash, storyUuid, ownerId)

      const bookSpinePath = bookData.spineImage
      const bookSpineHash = getHashFromPath(bookSpinePath)
      const bookSpineArtFileId = await getFileIdByHash(bookSpineHash, storyUuid, ownerId)

      await prisma.book.upsert({
        where: { id: bookUuid },
        create: {
          id: bookUuid,
          name: bookData.title,
          summary: bookData.summary, // Added summary
          coverArtFileId: bookCoverArtFileId, // Use resolved File ID
          spineArtFileId: bookSpineArtFileId, // Use resolved File ID
          sortOrder: sortOrder,
          storyId: storyUuid,
          nodeType: nodeType,
          updatedAt: bookData.modifiedAt ? new Date(bookData.modifiedAt) : undefined,
        },
        update: {
          name: bookData.title,
          summary: bookData.summary,
          coverArtFileId: bookCoverArtFileId,
          spineArtFileId: bookSpineArtFileId,
          storyId: storyUuid,
          sortOrder: sortOrder,
          nodeType: nodeType,
          updatedAt: bookData.modifiedAt ? new Date(bookData.modifiedAt) : undefined,
        },
      })
      // Remove separate update call, handled by upsert
      // await prisma.book.update({...
    }
  }
  await prisma.book.deleteMany({
    where: { storyId: storyUuid, id: { notIn: [...existingBooks] } },
  })

  // --- Upsert Arcs ---
  const existingArcs = new Set<string>()
  for (const arcId in story.arc) {
    if (Object.hasOwn(story.arc, arcId)) {
      const arcData = story.arc[arcId]
      const arcUuid = translator.toUUID(arcId)
      const bookId = arcToBookMap.get(arcId)
      if (!bookId) {
        console.warn(`Arc ${arcId} has no parent book, skipping.`)
        continue
      }
      const bookUuid = translator.toUUID(bookId)
      existingArcs.add(arcUuid)
      const sortOrder = sortOrders.arc.get(arcId) ?? 0
      const nodeType = nodeTypes.arc.get(arcId) || 'story'

      await prisma.arc.upsert({
        where: { id: arcUuid },
        create: {
          id: arcUuid,
          name: arcData.title,
          summary: arcData.summary, // Added summary
          bookId: bookUuid,
          sortOrder: sortOrder,
          nodeType: nodeType,
          updatedAt: arcData.modifiedAt ? new Date(arcData.modifiedAt) : undefined,
        },
        update: {
          name: arcData.title,
          summary: arcData.summary,
          bookId: bookUuid,
          sortOrder: sortOrder,
          nodeType: nodeType,
          updatedAt: arcData.modifiedAt ? new Date(arcData.modifiedAt) : undefined,
        },
      })
    }
  }
  // Delete orphaned Arcs
  const allStoryArcs = await prisma.arc.findMany({
    where: { book: { storyId: storyUuid } },
    select: { id: true },
  })
  const arcsToDelete = allStoryArcs.filter((arc) => !existingArcs.has(arc.id)).map((arc) => arc.id)
  if (arcsToDelete.length > 0) {
    await prisma.arc.deleteMany({ where: { id: { in: arcsToDelete } } })
  }

  // --- Upsert Chapters ---
  const publishedChapters = new Set<string>()
  // Define type for chapters needing publishing
  interface ChapterToPublish {
    id: string
    royalRoadId?: number | null
    publishDate?: Date
  }
  const chaptersToPublish: ChapterToPublish[] = []
  const existingChapters = new Set<string>()
  for (const chapterId in story.chapter) {
    if (Object.hasOwn(story.chapter, chapterId)) {
      const chapterData = story.chapter[chapterId]
      const chapterUuid = translator.toUUID(chapterId)
      const arcId = chapterToArcMap.get(chapterId)

      if (!arcId) {
        console.warn(`Chapter ${chapterId} has no parent arc, skipping.`)
        continue
      }
      const arcUuid = translator.toUUID(arcId)
      existingChapters.add(chapterUuid)

      const sortOrder = sortOrders.chapter.get(chapterId) ?? 0
      const nodeType = nodeTypes.chapter.get(chapterId) || 'story'

      await prisma.chapter.upsert({
        where: { id: chapterUuid },
        create: {
          id: chapterUuid,
          name: chapterData.title,
          summary: chapterData.summary, // Added summary
          publishedOn: chapterData.visibleFrom ? new Date(chapterData.visibleFrom) : undefined,
          sortOrder: sortOrder,
          arcId: arcUuid,
          royalRoadId: chapterData.royalRoadId, // Keep royal road id
          updatedAt: chapterData.modifiedAt ? new Date(chapterData.modifiedAt) : undefined,
          nodeType: nodeType,
        },
        update: {
          name: chapterData.title,
          summary: chapterData.summary,
          arcId: arcUuid,
          royalRoadId: chapterData.royalRoadId,
          publishedOn: chapterData.visibleFrom ? new Date(chapterData.visibleFrom) : undefined,
          sortOrder: sortOrder,
          nodeType: nodeType,
          updatedAt: chapterData.modifiedAt ? new Date(chapterData.modifiedAt) : undefined,
        },
      })

      // Publishing check logic remains the same...
      // ... (rest of chapter loop and publishing check) ...
    }
  }
  // Delete orphaned Chapters
  const allStoryChapters = await prisma.chapter.findMany({
    where: { arc: { book: { storyId: storyUuid } } },
    select: { id: true },
  })
  const chaptersToDelete = allStoryChapters.filter((chap) => !existingChapters.has(chap.id)).map((chap) => chap.id)
  if (chaptersToDelete.length > 0) {
    await prisma.chapter.deleteMany({
      where: { id: { in: chaptersToDelete } },
    })
  }

  // --- Upsert Characters, Locations, PlotPoints, Items (NEW) ---
  const existingCharacters = new Set<string>()
  const existingLocations = new Set<string>()
  const existingPlotPoints = new Set<string>()
  const existingItems = new Set<string>()

  // Characters
  for (const characterId in story.characters) {
    if (Object.hasOwn(story.characters, characterId)) {
      const charData = story.characters[characterId]
      const charUuid = translator.toUUID(characterId)
      existingCharacters.add(charUuid)

      // Resolve Character File ID using path -> hash -> ID
      const charPicturePath = charData.picture
      const charPictureHash = getHashFromPath(charPicturePath)
      const pictureFileId = await getFileIdByHash(charPictureHash, storyUuid, ownerId)
      const laterVersionUuid = charData.laterVersionOf ? translator.toUUID(charData.laterVersionOf) : null

      await prisma.character.upsert({
        where: { id: charUuid },
        create: {
          id: charUuid,
          storyId: storyUuid,
          pictureFileId: pictureFileId,
          firstName: charData.firstName,
          middleName: charData.middleName,
          lastName: charData.lastName,
          nickname: charData.nickname,
          summary: charData.summary,
          background: charData.background,
          personality: charData.personality,
          personalityQuirks: charData.personalityQuirks,
          likes: charData.likes,
          dislikes: charData.dislikes,
          age: charData.age,
          gender: charData.gender,
          sexualOrientation: charData.sexualOrientation,
          height: charData.height,
          hairColor: charData.hairColor,
          eyeColor: charData.eyeColor,
          distinguishingFeatures: charData.distinguishingFeatures,
          writingStyle: charData.writingStyle,
          isMainCharacter: charData.isMainCharacter,
          laterVersionOfId: laterVersionUuid,
          significantActions: charData.significantActions
            ? JSON.parse(JSON.stringify(charData.significantActions))
            : Prisma.JsonNull, // Store as JSON
          updatedAt: charData.modifiedAt ? new Date(charData.modifiedAt) : undefined,
        },
        update: {
          pictureFileId: pictureFileId,
          firstName: charData.firstName,
          middleName: charData.middleName,
          lastName: charData.lastName,
          nickname: charData.nickname,
          summary: charData.summary,
          background: charData.background,
          personality: charData.personality,
          personalityQuirks: charData.personalityQuirks,
          likes: charData.likes,
          dislikes: charData.dislikes,
          age: charData.age,
          gender: charData.gender,
          sexualOrientation: charData.sexualOrientation,
          height: charData.height,
          hairColor: charData.hairColor,
          eyeColor: charData.eyeColor,
          distinguishingFeatures: charData.distinguishingFeatures,
          writingStyle: charData.writingStyle,
          isMainCharacter: charData.isMainCharacter,
          laterVersionOfId: laterVersionUuid,
          significantActions: charData.significantActions
            ? JSON.parse(JSON.stringify(charData.significantActions))
            : Prisma.JsonNull, // Store as JSON
          updatedAt: charData.modifiedAt ? new Date(charData.modifiedAt) : undefined,
        },
      })
    }
  }
  // Delete orphaned Characters
  const allDbCharacters = await prisma.character.findMany({
    where: { storyId: storyUuid },
    select: { id: true },
  })
  const charactersToDelete = allDbCharacters.filter((c) => !existingCharacters.has(c.id)).map((c) => c.id)
  if (charactersToDelete.length > 0) {
    await prisma.character.deleteMany({
      where: { id: { in: charactersToDelete } },
    })
  }

  // Locations
  for (const locationId in story.locations) {
    if (Object.hasOwn(story.locations, locationId)) {
      const locData = story.locations[locationId]
      const locUuid = translator.toUUID(locationId)
      existingLocations.add(locUuid)

      // Resolve Location File ID using path -> hash -> ID
      const locPicturePath = locData.picture
      const locPictureHash = getHashFromPath(locPicturePath)
      const pictureFileId = await getFileIdByHash(locPictureHash, storyUuid, ownerId)

      await prisma.location.upsert({
        where: { id: locUuid },
        create: {
          id: locUuid,
          storyId: storyUuid,
          name: locData.name,
          pictureFileId: pictureFileId,
          description: locData.description,
          updatedAt: locData.modifiedAt ? new Date(locData.modifiedAt) : undefined,
        },
        update: {
          name: locData.name,
          pictureFileId: pictureFileId,
          description: locData.description,
          updatedAt: locData.modifiedAt ? new Date(locData.modifiedAt) : undefined,
        },
      })
    }
  }
  // Delete orphaned Locations
  const allDbLocations = await prisma.location.findMany({
    where: { storyId: storyUuid },
    select: { id: true },
  })
  const locationsToDelete = allDbLocations.filter((l) => !existingLocations.has(l.id)).map((l) => l.id)
  if (locationsToDelete.length > 0) {
    await prisma.location.deleteMany({
      where: { id: { in: locationsToDelete } },
    })
  }

  // Plot Points
  for (const plotPointId in story.plotPoints) {
    if (Object.hasOwn(story.plotPoints, plotPointId)) {
      const ppData = story.plotPoints[plotPointId]
      const ppUuid = translator.toUUID(plotPointId)
      existingPlotPoints.add(ppUuid)

      // Map client state string to server enum
      let state: PlotPointState = PlotPointState.UNRESOLVED
      if (ppData.state === 'introduced') state = PlotPointState.INTRODUCED
      else if (ppData.state === 'resolved') state = PlotPointState.RESOLVED

      await prisma.plotPoint.upsert({
        where: { id: ppUuid },
        create: {
          id: ppUuid,
          storyId: storyUuid,
          title: ppData.title,
          summary: ppData.summary,
          state: state,
          updatedAt: ppData.modifiedAt ? new Date(ppData.modifiedAt) : undefined,
        },
        update: {
          title: ppData.title,
          summary: ppData.summary,
          state: state,
          updatedAt: ppData.modifiedAt ? new Date(ppData.modifiedAt) : undefined,
        },
      })
    }
  }
  // Delete orphaned Plot Points
  const allDbPlotPoints = await prisma.plotPoint.findMany({
    where: { storyId: storyUuid },
    select: { id: true },
  })
  const plotPointsToDelete = allDbPlotPoints.filter((pp) => !existingPlotPoints.has(pp.id)).map((pp) => pp.id)
  if (plotPointsToDelete.length > 0) {
    await prisma.plotPoint.deleteMany({
      where: { id: { in: plotPointsToDelete } },
    })
  }

  // Items
  if (story.item) {
    for (const itemId in story.item) {
      if (Object.hasOwn(story.item, itemId)) {
        const itemData = story.item[itemId]
        const itemUuid = translator.toUUID(itemId)
        existingItems.add(itemUuid)

        await prisma.item.upsert({
          where: {
            storyId_name: { storyId: storyUuid, name: itemData.name },
          }, // Use unique constraint
          create: {
            id: itemUuid,
            storyId: storyUuid,
            name: itemData.name,
            updatedAt: itemData.modifiedAt ? new Date(itemData.modifiedAt) : undefined,
          },
          update: {
            // Usually only name matters, but update timestamp if needed
            name: itemData.name, // Allow name changes?
            updatedAt: itemData.modifiedAt ? new Date(itemData.modifiedAt) : undefined,
          },
        })
      }
    }
  }
  // Delete orphaned Items
  const allDbItems = await prisma.item.findMany({
    where: { storyId: storyUuid },
    select: { id: true },
  })
  const itemsToDelete = allDbItems.filter((i) => !existingItems.has(i.id)).map((i) => i.id)
  if (itemsToDelete.length > 0) {
    await prisma.item.deleteMany({ where: { id: { in: itemsToDelete } } })
  }

  // --- Prepare operations for paragraphs and revisions ---
  const paragraphUpsertOps: Prisma.PrismaPromise<Paragraph>[] = []
  const revisionCreateOps: Prisma.PrismaPromise<ParagraphRevision>[] = []
  const allParagraphIdsInUpload = new Set<string>()
  // Update type for the map to include new fields
  const latestRevisionsMap = new Map<
    string,
    {
      body: string
      contentSchema: string | null
      version: number
      state?: ParagraphState | null
      aiCharacters?: number | null
      humanCharacters?: number | null
      plotPointActions?: Prisma.JsonValue | null
      inventoryActions?: Prisma.JsonValue | null
    }
  >()

  // --- Upsert Scenes & Prepare Paragraph/Revision Ops ---
  const existingScenes = new Set<string>()
  const sceneCharacterUpdates: Prisma.PrismaPromise<unknown>[] = [] // For many-to-many updates

  for (const sceneId in story.scene) {
    if (Object.hasOwn(story.scene, sceneId)) {
      const sceneData = story.scene[sceneId]
      const sceneUuid = translator.toUUID(sceneId)
      const chapterId = sceneToChapterMap.get(sceneId)
      if (!chapterId) {
        console.warn(`Scene ${sceneId} has no parent chapter, skipping.`)
        continue
      }
      const chapterUuid = translator.toUUID(chapterId)
      existingScenes.add(sceneUuid)

      const sortOrder = sortOrders.scene.get(sceneId) ?? 0
      const nodeType = nodeTypes.scene.get(sceneId) || 'story'

      // Resolve Scene relations
      const protagonistUuid = sceneData.protagonistId ? translator.toUUID(sceneData.protagonistId) : null
      const locationUuid = sceneData.locationId ? translator.toUUID(sceneData.locationId) : null
      const perspective = sceneData.perspective
        ? sceneData.perspective === 'first'
          ? Perspective.FIRST
          : Perspective.THIRD
        : null

      // Word count aggregation - map chapterId to bookId via arcId
      const arcIdForScene = chapterToArcMap.get(chapterId)
      const bookIdForScene = arcIdForScene ? arcToBookMap.get(arcIdForScene) : undefined

      if (bookIdForScene && publishedChapters.has(chapterId)) {
        wordsPerBook.set(bookIdForScene, (wordsPerBook.get(bookIdForScene) || 0) + (sceneData.words ?? 0))
        totalWords += sceneData.words ?? 0
      }

      await prisma.scene.upsert({
        where: { id: sceneUuid },
        create: {
          id: sceneUuid,
          name: sceneData.title,
          summary: sceneData.summary, // Added summary
          body: sceneData.text, // Keep body for now
          chapterId: chapterUuid,
          sortOrder: sortOrder,
          nodeType: nodeType,
          perspective: perspective, // Added perspective
          protagonistId: protagonistUuid, // Added protagonist relation
          locationId: locationUuid, // Added location relation
          // participatingCharacters / referredCharacters handled below
          createdAt: sceneData.modifiedAt ? new Date(sceneData.modifiedAt) : undefined,
          updatedAt: sceneData.modifiedAt ? new Date(sceneData.modifiedAt) : undefined,
        },
        update: {
          name: sceneData.title,
          summary: sceneData.summary,
          body: sceneData.text,
          chapterId: chapterUuid,
          sortOrder: sortOrder,
          nodeType: nodeType,
          perspective: perspective,
          protagonistId: protagonistUuid,
          locationId: locationUuid,
          updatedAt: sceneData.modifiedAt ? new Date(sceneData.modifiedAt) : undefined,
        },
      })

      // --- Handle Scene Character Many-to-Many Relations ---
      // Clear existing relations first, then add new ones
      // Participating Characters
      const participatingCharUuids = (sceneData.characterIds ?? []).map((id) => translator.toUUID(id))
      sceneCharacterUpdates.push(prisma.sceneCharacter.deleteMany({ where: { sceneId: sceneUuid } }))
      if (participatingCharUuids.length > 0) {
        sceneCharacterUpdates.push(
          prisma.sceneCharacter.createMany({
            data: participatingCharUuids.map((charId) => ({
              sceneId: sceneUuid,
              characterId: charId,
            })),
            skipDuplicates: true, // In case of race conditions?
          }),
        )
      }
      // Referred Characters
      const referredCharUuids = (sceneData.referredCharacterIds ?? []).map((id) => translator.toUUID(id))
      sceneCharacterUpdates.push(
        prisma.sceneReferredCharacter.deleteMany({
          where: { sceneId: sceneUuid },
        }),
      )
      if (referredCharUuids.length > 0) {
        sceneCharacterUpdates.push(
          prisma.sceneReferredCharacter.createMany({
            data: referredCharUuids.map((charId) => ({
              sceneId: sceneUuid,
              characterId: charId,
            })),
            skipDuplicates: true,
          }),
        )
      }

      // Pre-fetch latest revisions for *this scene* to build the map
      const latestRevisionsForScene = await prisma.paragraphRevision.findMany({
        where: { paragraph: { sceneId: sceneUuid } },
        orderBy: { version: 'desc' }, // Use version now
        distinct: ['paragraphId'],
        select: {
          paragraphId: true,
          body: true,
          contentSchema: true,
          version: true,
          // Select new fields
          state: true,
          aiCharacters: true,
          humanCharacters: true,
          plotPointActions: true,
          inventoryActions: true,
        },
      })
      for (const rev of latestRevisionsForScene) {
        latestRevisionsMap.set(rev.paragraphId, {
          body: rev.body,
          contentSchema: rev.contentSchema,
          version: rev.version,
          // Include new fields in the map value
          state: rev.state,
          aiCharacters: rev.aiCharacters,
          humanCharacters: rev.humanCharacters,
          plotPointActions: rev.plotPointActions,
          inventoryActions: rev.inventoryActions,
        })
      }

      // Prepare Paragraph Upserts and Revision Creates for this scene
      for (const [index, paragraphData] of sceneData.paragraphs.entries()) {
        const paragraphUuid = translator.toUUID(paragraphData.id)
        allParagraphIdsInUpload.add(paragraphUuid)

        // Prepare Paragraph Upsert Operation
        paragraphUpsertOps.push(
          prisma.paragraph.upsert({
            where: { id: paragraphUuid },
            create: {
              id: paragraphUuid,
              sceneId: sceneUuid,
              sortOrder: index,
              createdAt: paragraphData.modifiedAt ? new Date(paragraphData.modifiedAt) : undefined,
              updatedAt: paragraphData.modifiedAt ? new Date(paragraphData.modifiedAt) : undefined,
            },
            update: {
              sortOrder: index,
              updatedAt: paragraphData.modifiedAt ? new Date(paragraphData.modifiedAt) : undefined,
            },
          }),
        )

        const renderedText =
          typeof paragraphData.text === 'string' ? paragraphData.text : contentSchemaToText(paragraphData.text)
        const newContentSchema = typeof paragraphData.text === 'string' ? null : JSON.stringify(paragraphData.text)
        const latestRevision = latestRevisionsMap.get(paragraphUuid)
        const hasChanged =
          !latestRevision || latestRevision.body !== renderedText || latestRevision.contentSchema !== newContentSchema

        // Map state
        let paraState: ParagraphState | undefined = undefined
        switch (paragraphData.state) {
          case 'ai':
            paraState = ParagraphState.AI
            break
          case 'draft':
            paraState = ParagraphState.DRAFT
            break
          case 'revise':
            paraState = ParagraphState.REVISE
            break
          case 'final':
            paraState = ParagraphState.FINAL
            break
          case 'sdt':
            paraState = ParagraphState.SDT
            break
        }

        // Check if revision needs update (content or new fields changed)
        const revisionNeedsUpdate =
          hasChanged ||
          latestRevision?.state !== paraState ||
          latestRevision?.aiCharacters !== paragraphData.aiCharacters ||
          latestRevision?.humanCharacters !== paragraphData.humanCharacters ||
          JSON.stringify(latestRevision?.plotPointActions) !== JSON.stringify(paragraphData.plot_point_actions ?? []) ||
          JSON.stringify(latestRevision?.inventoryActions) !== JSON.stringify(paragraphData.inventory_actions ?? [])

        if (revisionNeedsUpdate) {
          // Prepare Revision Create Operation
          revisionCreateOps.push(
            prisma.paragraphRevision.create({
              data: {
                paragraphId: paragraphUuid,
                body: renderedText,
                contentSchema: newContentSchema,
                version: (latestRevision?.version ?? 0) + 1,
                // --- ADDED FIELDS ---
                state: paraState,
                aiCharacters: paragraphData.aiCharacters,
                humanCharacters: paragraphData.humanCharacters,
                plotPointActions: paragraphData.plot_point_actions ?? Prisma.JsonNull,
                inventoryActions: paragraphData.inventory_actions ?? Prisma.JsonNull,
                // --- END ADDED FIELDS ---
                createdAt: paragraphData.modifiedAt ? new Date(paragraphData.modifiedAt) : undefined,
              },
            }),
          )
        }
      }
    }
  }

  // --- Execute Paragraph/Revision and Scene-Character Transactions ---
  console.log(
    `Executing transaction for ${paragraphUpsertOps.length} paragraphs, ${revisionCreateOps.length} revisions, and ${sceneCharacterUpdates.length} scene character updates.`,
  )
  await prisma.$transaction([
    ...paragraphUpsertOps,
    ...revisionCreateOps,
    ...sceneCharacterUpdates, // Add scene character updates to transaction
  ])
  console.log('Paragraph/Revision/Scene-Character transaction complete.')

  // --- Delete Orphaned Paragraphs Globally ---
  // Need to fetch all paragraph IDs for the story *now* after upserts
  // This is less efficient than per-scene but necessary post-transaction
  console.log('Deleting orphaned paragraphs...')
  const allCurrentParagraphIds = await prisma.paragraph
    .findMany({
      where: {
        scene: { chapter: { arc: { book: { storyId: storyUuid } } } },
      },
      select: { id: true },
    })
    .then((paragraphs) => new Set(paragraphs.map((p) => p.id)))

  const paragraphsToDelete = [...allCurrentParagraphIds].filter((id) => !allParagraphIdsInUpload.has(id))

  if (paragraphsToDelete.length > 0) {
    console.log(`Deleting ${paragraphsToDelete.length} orphaned paragraphs.`)
    await prisma.paragraph.deleteMany({
      where: { id: { in: paragraphsToDelete } },
    })
  } else {
    console.log('No orphaned paragraphs to delete.')
  }

  // Delete orphaned Scenes
  const allStoryScenes = await prisma.scene.findMany({
    where: { chapter: { arc: { book: { storyId: storyUuid } } } },
    select: { id: true },
  })
  const scenesToDelete = allStoryScenes.filter((scene) => !existingScenes.has(scene.id)).map((scene) => scene.id)
  if (scenesToDelete.length > 0) {
    await prisma.scene.deleteMany({ where: { id: { in: scenesToDelete } } })
  }

  // --- Final Updates & Publishing ---
  // Update story word count
  await prisma.story.update({
    where: { id: storyUuid },
    data: {
      pages: Math.ceil(totalWords / 250),
      updatedAt: new Date(), // Explicitly update story timestamp
    },
  })

  // Update book word counts
  for (const [bookId, words] of wordsPerBook.entries()) {
    await prisma.book.update({
      where: { id: translator.toUUID(bookId) },
      data: {
        pages: Math.ceil(words / 250),
      },
    })
  }

  // Publish chapters if needed
  if (chaptersToPublish.length > 0 && story.settings?.publishToRoyalRoad) {
    // ... (publishing logic remains the same, uses chapter Uuid)
    if (!royalRoadCredentials) {
      console.warn('Royal Road credentials not provided but publishing is enabled')
      return {
        success: false,
        error: 'Royal Road credentials are required for publishing',
        updatedAt: storyUpdatedAt, // Use the stored server update time
      }
    }

    console.log('chaptersToPublish', chaptersToPublish)

    for (const chapter of chaptersToPublish) {
      try {
        await publishChapterToRoyalRoad(
          chapter.id,
          royalRoadCredentials.username,
          royalRoadCredentials.password,
          ctx.authenticatedUser.id,
          chapter.royalRoadId ?? undefined,
          chapter.publishDate,
        )
      } catch (error) {
        console.error(`Failed to publish chapter ${chapter.id} to Royal Road:`, error)
      }
    }
  } else {
    console.log('No chapters to publish')
  }

  // Fetch the final updated story to get the accurate updatedAt time
  const finalStory = await prisma.story.findUnique({
    where: { id: storyUuid },
    select: { updatedAt: true }, // Only select updatedAt
  })

  return {
    success: true,
    // Use the timestamp from the database after all updates
    updatedAt: finalStory?.updatedAt ?? storyUpdatedAt, // Use the stored variable
  }
})
