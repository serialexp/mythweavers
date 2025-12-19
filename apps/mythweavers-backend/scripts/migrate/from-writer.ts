/**
 * Migration script: Writer Frontend (JSON files) → Unified Backend (PostgreSQL)
 *
 * This script migrates story data from the Writer frontend's local JSON file format
 * to the unified PostgreSQL backend.
 *
 * Source: Writer frontend stores stories as a directory structure:
 *   - index.json - main story metadata and structure
 *   - scene/{sceneId}.json - individual scene files
 *   - chapter/{chapterId}.json, book/{bookId}.json, etc.
 *   - characters/{characterId}.json, locations/{locationId}.json, etc.
 *
 * Target: Unified PostgreSQL schema with:
 *   - Story → Book → Arc → Chapter → Scene → Message → MessageRevision → Paragraph → ParagraphRevision
 *   - Character, ContextItem (replaces Location + PlotPoint), Item
 *   - File references
 *
 * Key transformations:
 *   1. Scene.paragraphs[] → Message + MessageRevision + Paragraph + ParagraphRevision
 *   2. Location → ContextItem (type: 'location')
 *   3. PlotPoint → ContextItem (type: 'plot')
 *   4. Character maintains most fields, adds description from summary
 *   5. Scene.characterIds/referredCharacterIds → Scene.activeCharacterIds (JSON array)
 *   6. Scene.locationId + selectedContextNodes → Scene.activeContextItemIds (JSON array)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  IdMapper,
  type MigrationLogger,
  contentSchemaToText,
  createConsoleLogger,
  generateCuid,
  transformNodeType,
  transformParagraphState,
  transformPerspective,
} from './utils'

// Types matching @writer/shared schema
interface WriterNode {
  id: string
  name: string
  type: 'book' | 'arc' | 'chapter' | 'scene'
  isOpen: boolean
  nodeType: 'story' | 'non-story' | 'context'
  oneliner?: string
  summaries?: Array<{ level: number; text: string; timestamp: number }>
  children?: WriterNode[]
}

interface WriterParagraph {
  id: string
  text: string | object // Can be ContentNode
  words?: number
  aiCharacters?: number
  humanCharacters?: number
  state: 'ai' | 'draft' | 'revise' | 'final' | 'sdt'
  comments?: Array<{ text: string; user: string; createdAt: string }>
  plot_point_actions?: Array<{ plot_point_id: string; action: string }>
  inventory_actions?: Array<{ type: 'add' | 'remove'; item_name: string; item_amount: number }>
  modifiedAt?: number
}

interface WriterScene {
  id: string
  title: string
  summary: string
  paragraphs: WriterParagraph[]
  text?: string
  words?: number
  hasAI?: boolean
  perspective?: 'first' | 'third'
  protagonistId?: string
  characterIds?: string[]
  referredCharacterIds?: string[]
  locationId?: string
  selectedContextNodes?: string[]
  modifiedAt?: number
}

interface WriterChapter {
  id: string
  title: string
  summary: string
  visibleFrom?: string
  royalRoadId?: number
  modifiedAt?: number
}

interface WriterArc {
  id: string
  title: string
  summary: string
  modifiedAt?: number
}

interface WriterBook {
  id: string
  title: string
  summary: string
  coverImage?: string
  spineImage?: string
  modifiedAt?: number
}

interface WriterCharacter {
  id: string
  picture?: string
  name?: string
  firstName: string
  middleName?: string
  lastName?: string
  nickname?: string
  summary: string
  background?: string
  personality?: string
  personalityQuirks?: string
  likes?: string
  dislikes?: string
  age?: string
  gender?: string
  sexualOrientation?: string
  height?: number
  hairColor?: string
  eyeColor?: string
  distinguishingFeatures?: string
  writingStyle?: string
  isMainCharacter?: boolean
  laterVersionOf?: string
  significantActions?: Array<{ action: string; sceneId: string; timestamp: number }>
  modifiedAt?: number
}

interface WriterLocation {
  id: string
  name: string
  picture?: string
  description: string
  modifiedAt?: number
}

interface WriterPlotPoint {
  id: string
  title: string
  summary: string
  state: 'introduced' | 'unresolved' | 'resolved'
  modifiedAt?: number
}

interface WriterItem {
  id: string
  name: string
  modifiedAt?: number
}

interface WriterStorySettings {
  headerImage?: string
  aiInstructions?: string
  royalRoadId?: string
  defaultPerspective?: 'first' | 'third'
  defaultProtagonistId?: string
}

interface WriterStory {
  id: string
  name: string
  modifiedTime: number
  lastPublishTime?: number
  settings?: WriterStorySettings
  uploadedFiles?: Record<string, { hash: string; publicUrl: string }>
  item?: Record<string, WriterItem>
  structure: WriterNode[]
  chapter: Record<string, WriterChapter>
  book: Record<string, WriterBook>
  arc: Record<string, WriterArc>
  characters: Record<string, WriterCharacter>
  locations: Record<string, WriterLocation>
  plotPoints: Record<string, WriterPlotPoint>
  scene: Record<string, WriterScene>
  oneliner?: string
}

interface MigrationOptions {
  userId: number
  dryRun?: boolean
  replace?: boolean
  logger?: MigrationLogger
}

interface MigrationResult {
  success: boolean
  skipped?: boolean
  storyId?: string
  idMappings: IdMapper
  stats: {
    books: number
    arcs: number
    chapters: number
    scenes: number
    messages: number
    paragraphs: number
    characters: number
    contextItems: number
    items: number
  }
  errors: string[]
}

/**
 * Load a Writer story from disk
 */
export function loadWriterStory(projectPath: string): WriterStory {
  const indexPath = join(projectPath, 'index.json')

  if (!existsSync(indexPath)) {
    throw new Error(`Story index.json not found at: ${indexPath}`)
  }

  const indexContent = JSON.parse(readFileSync(indexPath, 'utf-8'))
  const story: WriterStory = indexContent.story || indexContent

  // Load individual entity files if they exist
  const entityTypes = ['scene', 'chapter', 'book', 'arc', 'characters', 'locations', 'plotPoints', 'item'] as const

  for (const entityType of entityTypes) {
    const entityDir = join(projectPath, entityType)
    if (existsSync(entityDir) && statSync(entityDir).isDirectory()) {
      const files = readdirSync(entityDir).filter((f) => f.endsWith('.json'))

      for (const file of files) {
        const entityId = file.replace('.json', '')
        const entityContent = JSON.parse(readFileSync(join(entityDir, file), 'utf-8'))

        // Ensure the record exists
        if (!story[entityType]) {
          // @ts-expect-error - dynamic assignment
          story[entityType] = {}
        }

        // @ts-expect-error - dynamic assignment
        story[entityType][entityId] = entityContent
      }
    }
  }

  return story
}

/**
 * Migrate a Writer story to the unified backend
 */
/**
 * Check if a story has already been migrated by looking for a story
 * with the same importedFromId
 */
async function findExistingMigratedStory(
  prisma: PrismaClient,
  sourceStoryId: string,
): Promise<{ id: string; name: string } | null> {
  const existing = await prisma.story.findUnique({
    where: {
      importedFromId: sourceStoryId,
    },
    select: { id: true, name: true },
  })
  return existing
}

/**
 * Delete an existing story and all its related data
 */
async function deleteExistingStory(prisma: PrismaClient, storyId: string, logger: MigrationLogger): Promise<void> {
  logger.info(`Deleting existing story: ${storyId}`)

  // Prisma's cascade delete should handle most relations
  // But we need to be careful about the order for some
  await prisma.story.delete({
    where: { id: storyId },
  })

  logger.info('Existing story deleted')
}

export async function migrateWriterStory(
  prisma: PrismaClient,
  story: WriterStory,
  options: MigrationOptions,
): Promise<MigrationResult> {
  const { userId, dryRun = false, replace = false, logger = createConsoleLogger() } = options
  const idMapper = new IdMapper()
  const errors: string[] = []
  const stats = {
    books: 0,
    arcs: 0,
    chapters: 0,
    scenes: 0,
    messages: 0,
    paragraphs: 0,
    characters: 0,
    contextItems: 0,
    items: 0,
  }

  logger.info(`Starting migration of story: ${story.name} (${story.id})`)

  if (dryRun) {
    logger.info('DRY RUN MODE - No changes will be made to the database')
  }

  try {
    // =========================================================================
    // 0. Check if story already exists
    // =========================================================================
    const existingStory = await findExistingMigratedStory(prisma, story.id)

    if (existingStory) {
      if (replace) {
        logger.info(`Story "${story.name}" already imported (${existingStory.id}), replacing...`)
        if (!dryRun) {
          await deleteExistingStory(prisma, existingStory.id, logger)
        }
      } else {
        logger.info(`Story "${story.name}" already imported (${existingStory.id}), skipping.`)
        logger.info('Use --replace to delete and re-import the story.')
        return {
          success: true,
          skipped: true,
          storyId: existingStory.id,
          idMappings: idMapper,
          stats,
          errors: [],
        }
      }
    }

    // =========================================================================
    // 1. Create Story
    // =========================================================================
    logger.info('Creating story record...')

    const newStoryId = generateCuid()
    idMapper.setMapping('story', story.id, newStoryId)

    if (!dryRun) {
      await prisma.story.create({
        data: {
          id: newStoryId,
          name: story.name,
          summary: story.oneliner || null,
          ownerId: userId,
          importedFromId: story.id, // Store original ID for re-migration detection
          royalRoadId: story.settings?.royalRoadId ? Number.parseInt(story.settings.royalRoadId, 10) : null,
          published: !!story.lastPublishTime,
          status: 'ONGOING',
          type: 'ORIGINAL',
          defaultPerspective: transformPerspective(story.settings?.defaultPerspective),
          sortOrder: 0,
          createdAt: new Date(story.modifiedTime),
          updatedAt: new Date(story.modifiedTime),
        },
      })
    }

    // =========================================================================
    // 2. Migrate Characters
    // =========================================================================
    logger.info('Migrating characters...')
    const characters = Object.values(story.characters || {})

    for (const char of characters) {
      const newCharId = generateCuid()
      idMapper.setMapping('character', char.id, newCharId)

      if (!dryRun) {
        await prisma.character.create({
          data: {
            id: newCharId,
            storyId: newStoryId,
            firstName: char.firstName || char.name?.split(' ')[0] || 'Unknown',
            middleName: char.middleName,
            lastName: char.lastName || char.name?.split(' ').slice(1).join(' ') || null,
            nickname: char.nickname,
            description: char.summary, // Map summary to description (used for AI generation)
            background: char.background,
            personality: char.personality,
            personalityQuirks: char.personalityQuirks,
            likes: char.likes,
            dislikes: char.dislikes,
            age: char.age,
            gender: char.gender,
            sexualOrientation: char.sexualOrientation,
            height: char.height,
            hairColor: char.hairColor,
            eyeColor: char.eyeColor,
            distinguishingFeatures: char.distinguishingFeatures,
            writingStyle: char.writingStyle,
            isMainCharacter: char.isMainCharacter ?? true,
            laterVersionOfId: char.laterVersionOf ? idMapper.getMapping('character', char.laterVersionOf) : null,
            significantActions: char.significantActions ? JSON.stringify(char.significantActions) : null,
            createdAt: char.modifiedAt ? new Date(char.modifiedAt) : new Date(),
            updatedAt: char.modifiedAt ? new Date(char.modifiedAt) : new Date(),
          },
        })
      }
      stats.characters++
    }
    logger.progress(stats.characters, characters.length, 'Characters')

    // Update default protagonist after all characters are created
    if (story.settings?.defaultProtagonistId) {
      const newProtagonistId = idMapper.getMapping('character', story.settings.defaultProtagonistId)
      if (newProtagonistId && !dryRun) {
        await prisma.story.update({
          where: { id: newStoryId },
          data: { defaultProtagonistId: newProtagonistId },
        })
      }
    }

    // =========================================================================
    // 3. Migrate Locations → ContextItems (type: 'location')
    // =========================================================================
    logger.info('Migrating locations to context items...')
    const locations = Object.values(story.locations || {})

    for (const loc of locations) {
      const newContextId = generateCuid()
      idMapper.setMapping('location', loc.id, newContextId)
      idMapper.setMapping('contextItem', loc.id, newContextId) // Also map as contextItem

      if (!dryRun) {
        await prisma.contextItem.create({
          data: {
            id: newContextId,
            storyId: newStoryId,
            type: 'location',
            name: loc.name,
            description: loc.description || '',
            isGlobal: false,
            createdAt: loc.modifiedAt ? new Date(loc.modifiedAt) : new Date(),
            updatedAt: loc.modifiedAt ? new Date(loc.modifiedAt) : new Date(),
          },
        })
      }
      stats.contextItems++
    }

    // =========================================================================
    // 4. Migrate PlotPoints → ContextItems (type: 'plot')
    // =========================================================================
    logger.info('Migrating plot points to context items...')
    const plotPoints = Object.values(story.plotPoints || {})

    for (const pp of plotPoints) {
      const newContextId = generateCuid()
      idMapper.setMapping('plotPoint', pp.id, newContextId)
      idMapper.setMapping('contextItem', pp.id, newContextId) // Also map as contextItem

      if (!dryRun) {
        await prisma.contextItem.create({
          data: {
            id: newContextId,
            storyId: newStoryId,
            type: 'plot',
            name: pp.title,
            description: pp.summary || '',
            isGlobal: false,
            createdAt: pp.modifiedAt ? new Date(pp.modifiedAt) : new Date(),
            updatedAt: pp.modifiedAt ? new Date(pp.modifiedAt) : new Date(),
          },
        })
      }
      stats.contextItems++
    }
    logger.progress(stats.contextItems, locations.length + plotPoints.length, 'Context Items')

    // =========================================================================
    // 5. Traverse tree structure and create hierarchy
    // =========================================================================
    logger.info('Migrating story structure...')

    const processNode = async (
      node: WriterNode,
      parentInfo: { type: string; id: string } | null,
      sortOrder: number,
    ) => {
      const nodeType = transformNodeType(node.nodeType)

      if (node.type === 'book') {
        const bookData = story.book[node.id]
        const newBookId = generateCuid()
        idMapper.setMapping('book', node.id, newBookId)

        if (!dryRun) {
          await prisma.book.create({
            data: {
              id: newBookId,
              name: node.name || bookData?.title || '',
              summary: bookData?.summary || null,
              storyId: newStoryId,
              sortOrder,
              nodeType,
              createdAt: bookData?.modifiedAt ? new Date(bookData.modifiedAt) : new Date(),
              updatedAt: bookData?.modifiedAt ? new Date(bookData.modifiedAt) : new Date(),
            },
          })
        }
        stats.books++

        // Process children (arcs)
        if (node.children) {
          for (let i = 0; i < node.children.length; i++) {
            await processNode(node.children[i], { type: 'book', id: newBookId }, i)
          }
        }
      } else if (node.type === 'arc') {
        const arcData = story.arc[node.id]
        const newArcId = generateCuid()
        idMapper.setMapping('arc', node.id, newArcId)

        if (!parentInfo || parentInfo.type !== 'book') {
          errors.push(`Arc ${node.id} has no parent book`)
          return
        }

        if (!dryRun) {
          await prisma.arc.create({
            data: {
              id: newArcId,
              name: node.name || arcData?.title || '',
              summary: arcData?.summary || null,
              bookId: parentInfo.id,
              sortOrder,
              nodeType,
              createdAt: arcData?.modifiedAt ? new Date(arcData.modifiedAt) : new Date(),
              updatedAt: arcData?.modifiedAt ? new Date(arcData.modifiedAt) : new Date(),
            },
          })
        }
        stats.arcs++

        // Process children (chapters)
        if (node.children) {
          for (let i = 0; i < node.children.length; i++) {
            await processNode(node.children[i], { type: 'arc', id: newArcId }, i)
          }
        }
      } else if (node.type === 'chapter') {
        const chapterData = story.chapter[node.id]
        const newChapterId = generateCuid()
        idMapper.setMapping('chapter', node.id, newChapterId)

        if (!parentInfo || parentInfo.type !== 'arc') {
          errors.push(`Chapter ${node.id} has no parent arc`)
          return
        }

        if (!dryRun) {
          await prisma.chapter.create({
            data: {
              id: newChapterId,
              name: node.name || chapterData?.title || '',
              summary: chapterData?.summary || null,
              arcId: parentInfo.id,
              sortOrder,
              royalRoadId: chapterData?.royalRoadId || null,
              nodeType,
              publishedOn: chapterData?.visibleFrom ? new Date(chapterData.visibleFrom) : null,
              createdAt: chapterData?.modifiedAt ? new Date(chapterData.modifiedAt) : new Date(),
              updatedAt: chapterData?.modifiedAt ? new Date(chapterData.modifiedAt) : new Date(),
            },
          })
        }
        stats.chapters++

        // Process children (scenes)
        if (node.children) {
          for (let i = 0; i < node.children.length; i++) {
            await processNode(node.children[i], { type: 'chapter', id: newChapterId }, i)
          }
        }
      } else if (node.type === 'scene') {
        await migrateScene(node, parentInfo, sortOrder)
      }
    }

    const migrateScene = async (
      node: WriterNode,
      parentInfo: { type: string; id: string } | null,
      sortOrder: number,
    ) => {
      const sceneData = story.scene[node.id]
      if (!sceneData) {
        errors.push(`Scene data not found for node: ${node.id}`)
        return
      }

      const newSceneId = generateCuid()
      idMapper.setMapping('scene', node.id, newSceneId)

      if (!parentInfo || parentInfo.type !== 'chapter') {
        errors.push(`Scene ${node.id} has no parent chapter`)
        return
      }

      // Build active character IDs array
      const activeCharacterIds: string[] = []
      if (sceneData.characterIds) {
        for (const charId of sceneData.characterIds) {
          const newCharId = idMapper.getMapping('character', charId)
          if (newCharId) activeCharacterIds.push(newCharId)
        }
      }
      if (sceneData.referredCharacterIds) {
        for (const charId of sceneData.referredCharacterIds) {
          const newCharId = idMapper.getMapping('character', charId)
          if (newCharId && !activeCharacterIds.includes(newCharId)) {
            activeCharacterIds.push(newCharId)
          }
        }
      }

      // Build active context item IDs array
      const activeContextItemIds: string[] = []
      if (sceneData.locationId) {
        const newLocId = idMapper.getMapping('location', sceneData.locationId)
        if (newLocId) activeContextItemIds.push(newLocId)
      }
      if (sceneData.selectedContextNodes) {
        for (const contextId of sceneData.selectedContextNodes) {
          const newContextId = idMapper.getMapping('contextItem', contextId)
          if (newContextId && !activeContextItemIds.includes(newContextId)) {
            activeContextItemIds.push(newContextId)
          }
        }
      }

      // Get viewpoint character
      const viewpointCharacterId = sceneData.protagonistId
        ? idMapper.getMapping('character', sceneData.protagonistId)
        : null

      if (!dryRun) {
        await prisma.scene.create({
          data: {
            id: newSceneId,
            name: node.name || sceneData.title || '',
            summary: sceneData.summary || null,
            chapterId: parentInfo.id,
            sortOrder,
            perspective: transformPerspective(sceneData.perspective),
            viewpointCharacterId,
            activeCharacterIds: activeCharacterIds.length > 0 ? activeCharacterIds : null,
            activeContextItemIds: activeContextItemIds.length > 0 ? activeContextItemIds : null,
            createdAt: sceneData.modifiedAt ? new Date(sceneData.modifiedAt) : new Date(),
            updatedAt: sceneData.modifiedAt ? new Date(sceneData.modifiedAt) : new Date(),
          },
        })
      }
      stats.scenes++

      // =========================================================================
      // 6. Migrate paragraphs → Single Message per Scene with multiple Paragraphs
      // =========================================================================
      // In the unified schema, each scene gets:
      //   - One Message (container for all scene content)
      //   - One MessageRevision (version 1, initial)
      //   - Multiple Paragraphs under that revision (one per Writer paragraph)
      //   - Each Paragraph gets a ParagraphRevision with the actual content

      const paragraphs = sceneData.paragraphs || []

      if (paragraphs.length > 0) {
        // Create single Message for the scene
        const newMessageId = generateCuid()
        idMapper.setMapping('message', node.id, newMessageId)

        // Create MessageRevision
        const newMessageRevisionId = generateCuid()

        if (!dryRun) {
          await prisma.message.create({
            data: {
              id: newMessageId,
              sceneId: newSceneId,
              sortOrder: 0,
              instruction: null,
              script: null,
              createdAt: sceneData.modifiedAt ? new Date(sceneData.modifiedAt) : new Date(),
              updatedAt: sceneData.modifiedAt ? new Date(sceneData.modifiedAt) : new Date(),
            },
          })

          await prisma.messageRevision.create({
            data: {
              id: newMessageRevisionId,
              messageId: newMessageId,
              version: 1,
              versionType: 'initial',
              model: null,
              createdAt: sceneData.modifiedAt ? new Date(sceneData.modifiedAt) : new Date(),
            },
          })

          // Set current message revision
          await prisma.message.update({
            where: { id: newMessageId },
            data: { currentMessageRevisionId: newMessageRevisionId },
          })
        }
        stats.messages++

        // Create Paragraphs under the single MessageRevision
        for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
          const para = paragraphs[pIdx]

          const newParagraphId = generateCuid()
          idMapper.setMapping('paragraph', para.id, newParagraphId)

          const newParagraphRevisionId = generateCuid()

          // Extract text content
          const bodyText = typeof para.text === 'string' ? para.text : contentSchemaToText(para.text)

          // Preserve content schema as JSON if it's a structured document
          const contentSchema = typeof para.text === 'object' ? JSON.stringify(para.text) : null

          if (!dryRun) {
            await prisma.paragraph.create({
              data: {
                id: newParagraphId,
                messageRevisionId: newMessageRevisionId,
                sortOrder: pIdx,
                createdAt: para.modifiedAt ? new Date(para.modifiedAt) : new Date(),
                updatedAt: para.modifiedAt ? new Date(para.modifiedAt) : new Date(),
              },
            })

            await prisma.paragraphRevision.create({
              data: {
                id: newParagraphRevisionId,
                paragraphId: newParagraphId,
                body: bodyText,
                contentSchema,
                version: 1,
                state: transformParagraphState(para.state),
                plotPointActions: para.plot_point_actions
                  ? para.plot_point_actions.map((ppa) => ({
                      plotPointId: idMapper.getMapping('plotPoint', ppa.plot_point_id) || ppa.plot_point_id,
                      action: ppa.action,
                    }))
                  : null,
                inventoryActions: para.inventory_actions
                  ? para.inventory_actions.map((ia) => ({
                      type: ia.type.toUpperCase(),
                      itemName: ia.item_name,
                      amount: ia.item_amount,
                    }))
                  : null,
                createdAt: para.modifiedAt ? new Date(para.modifiedAt) : new Date(),
              },
            })

            // Set current paragraph revision
            await prisma.paragraph.update({
              where: { id: newParagraphId },
              data: { currentParagraphRevisionId: newParagraphRevisionId },
            })

            // Migrate paragraph comments
            if (para.comments && para.comments.length > 0) {
              for (const comment of para.comments) {
                await prisma.paragraphComment.create({
                  data: {
                    paragraphRevisionId: newParagraphRevisionId,
                    ownerId: userId,
                    body: comment.text,
                    type: 'COMMENT',
                    createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
                    updatedAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
                  },
                })
              }
            }
          }

          stats.paragraphs++
        }
      }
    }

    // Process top-level nodes (books)
    for (let i = 0; i < story.structure.length; i++) {
      await processNode(story.structure[i], null, i)
    }

    logger.info(
      `Structure migration complete: ${stats.books} books, ${stats.arcs} arcs, ${stats.chapters} chapters, ${stats.scenes} scenes`,
    )

    // =========================================================================
    // 7. Migrate Items (assign to default protagonist)
    // =========================================================================
    logger.info('Migrating items...')
    const items = Object.values(story.item || {})

    if (items.length > 0) {
      const defaultProtagonistId = story.settings?.defaultProtagonistId
      const newProtagonistId = defaultProtagonistId ? idMapper.getMapping('character', defaultProtagonistId) : null

      if (newProtagonistId) {
        for (const item of items) {
          const newItemId = generateCuid()
          idMapper.setMapping('item', item.id, newItemId)

          if (!dryRun) {
            await prisma.item.create({
              data: {
                id: newItemId,
                characterId: newProtagonistId,
                name: item.name,
                amount: 1,
                createdAt: item.modifiedAt ? new Date(item.modifiedAt) : new Date(),
                updatedAt: item.modifiedAt ? new Date(item.modifiedAt) : new Date(),
              },
            })
          }
          stats.items++
        }
        logger.info(`Migrated ${items.length} items to default protagonist`)
      } else {
        logger.warn(`Skipping ${items.length} items - no default protagonist set for story`)
      }
    }

    // =========================================================================
    // 8. Summary
    // =========================================================================
    logger.info('Migration complete!')
    logger.info('Statistics:')
    logger.info(`  - Books: ${stats.books}`)
    logger.info(`  - Arcs: ${stats.arcs}`)
    logger.info(`  - Chapters: ${stats.chapters}`)
    logger.info(`  - Scenes: ${stats.scenes}`)
    logger.info(`  - Messages: ${stats.messages}`)
    logger.info(`  - Paragraphs: ${stats.paragraphs}`)
    logger.info(`  - Characters: ${stats.characters}`)
    logger.info(`  - Context Items: ${stats.contextItems}`)
    logger.info(`  - Items: ${stats.items}`)

    if (errors.length > 0) {
      logger.warn(`Encountered ${errors.length} errors:`)
      for (const error of errors) {
        logger.warn(`  - ${error}`)
      }
    }

    return {
      success: errors.length === 0,
      storyId: newStoryId,
      idMappings: idMapper,
      stats,
      errors,
    }
  } catch (error) {
    logger.error('Migration failed', error)
    return {
      success: false,
      idMappings: idMapper,
      stats,
      errors: [...errors, error instanceof Error ? error.message : String(error)],
    }
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('Usage: npx tsx from-writer.ts <project-path> <user-id> [--dry-run] [--replace]')
    console.log('')
    console.log('Arguments:')
    console.log('  project-path  Path to the Writer story project directory')
    console.log('  user-id       User ID to assign ownership to')
    console.log('  --dry-run     Run without making database changes')
    console.log('  --replace     Delete existing story and re-import (otherwise skips if exists)')
    process.exit(1)
  }

  const projectPath = args[0]
  const userId = Number.parseInt(args[1], 10)
  const dryRun = args.includes('--dry-run')
  const replace = args.includes('--replace')

  if (Number.isNaN(userId)) {
    console.error('Error: user-id must be a number')
    process.exit(1)
  }

  const logger = createConsoleLogger()

  try {
    logger.info(`Loading story from: ${projectPath}`)
    const story = loadWriterStory(projectPath)
    logger.info(`Loaded story: ${story.name}`)

    const prisma = new PrismaClient()

    try {
      const result = await migrateWriterStory(prisma, story, {
        userId,
        dryRun,
        replace,
        logger,
      })

      if (result.skipped) {
        logger.info('Story already migrated, nothing to do.')
      } else if (result.success) {
        logger.info(`Migration successful! New story ID: ${result.storyId}`)

        // Save ID mappings for reference
        if (!dryRun) {
          const mappingsPath = join(projectPath, 'migration-mappings.json')
          const fs = await import('node:fs')
          fs.writeFileSync(mappingsPath, JSON.stringify(result.idMappings.toJSON(), null, 2))
          logger.info(`ID mappings saved to: ${mappingsPath}`)
        }
      } else {
        logger.error('Migration completed with errors')
        process.exit(1)
      }
    } finally {
      await prisma.$disconnect()
    }
  } catch (error) {
    logger.error('Fatal error', error)
    process.exit(1)
  }
}

// Run if called directly
main()
