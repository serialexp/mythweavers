/**
 * Migration script: Story Backend (SQLite) → Unified Backend (PostgreSQL)
 *
 * This script migrates story data from the Story project's SQLite database
 * to the unified PostgreSQL backend.
 *
 * Source: Story Backend SQLite with Prisma schema including:
 *   - User (cuid), Session, PasswordResetToken
 *   - Story (with timeline, calendar, branching support)
 *   - Message (with versions, embeddings)
 *   - Character, ContextItem
 *   - Node (hierarchical: book/arc/chapter)
 *   - Chapter (legacy)
 *   - Map, Landmark, LandmarkState, Fleet, FleetMovement, Hyperlane, HyperlaneSegment
 *   - File, MessageVersion
 *
 * Target: Unified PostgreSQL schema
 *
 * Key transformations:
 *   1. User (cuid string) → User (auto-increment int) - requires user mapping
 *   2. Message → Message + MessageRevision + Paragraph + ParagraphRevision
 *   3. Node (book/arc/chapter hierarchy) → Book/Arc/Chapter separate tables
 *   4. Fleet → Pawn, Hyperlane → Path (renamed)
 *   5. Fleet.hyperdriveRating → Pawn.speed
 *   6. Calendar.config (string JSON) → Calendar.config (JSONB) + name extraction
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { IdMapper, type MigrationLogger, createConsoleLogger, generateCuid } from './utils'

// Dynamic imports to avoid errors when just showing help
type TargetPrisma = import('@prisma/client').PrismaClient
type SourcePrisma = import('../../src/generated/story-prisma').PrismaClient

interface MigrationOptions {
  sourceUserId: string // cuid from story-backend
  targetUserId: number // int from unified-backend
  storyId?: string // Optional: migrate specific story, otherwise all
  dryRun?: boolean
  replace?: boolean
  logger?: MigrationLogger
}

interface MigrationResult {
  success: boolean
  skippedStories: string[]
  storyIds: string[]
  idMappings: IdMapper
  stats: {
    stories: number
    books: number
    arcs: number
    chapters: number
    scenes: number
    messages: number
    paragraphs: number
    characters: number
    contextItems: number
    files: number
    maps: number
    landmarks: number
    pawns: number
    paths: number
    calendars: number
    mediaAttachments: number
  }
  errors: string[]
}

/**
 * Migrate stories from Story Backend to Unified Backend
 */
/**
 * Check if a story has already been migrated by looking for a story
 * with the same importedFromId
 */
async function findExistingMigratedStory(
  targetPrisma: TargetPrisma,
  sourceStoryId: string,
): Promise<{ id: string; name: string } | null> {
  const existing = await targetPrisma.story.findUnique({
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
async function deleteExistingStory(
  targetPrisma: TargetPrisma,
  storyId: string,
  logger: MigrationLogger,
): Promise<void> {
  logger.info(`Deleting existing story: ${storyId}`)
  await targetPrisma.story.delete({
    where: { id: storyId },
  })
  logger.info('Existing story deleted')
}

export async function migrateFromStoryBackend(
  sourcePrisma: SourcePrisma,
  targetPrisma: TargetPrisma,
  options: MigrationOptions,
): Promise<MigrationResult> {
  // Note: Prisma clients are passed in from main() after dynamic import
  const {
    sourceUserId,
    targetUserId,
    storyId,
    dryRun = false,
    replace = false,
    logger = createConsoleLogger(),
  } = options

  const idMapper = new IdMapper()
  const errors: string[] = []
  const migratedStoryIds: string[] = []
  const skippedStories: string[] = []
  const stats = {
    stories: 0,
    books: 0,
    arcs: 0,
    chapters: 0,
    scenes: 0,
    messages: 0,
    paragraphs: 0,
    characters: 0,
    contextItems: 0,
    files: 0,
    maps: 0,
    landmarks: 0,
    pawns: 0,
    paths: 0,
    calendars: 0,
    mediaAttachments: 0,
  }

  logger.info('Starting migration from Story Backend to Unified Backend')
  if (dryRun) {
    logger.info('DRY RUN MODE - No changes will be made to the database')
  }

  try {
    // =========================================================================
    // 1. Load stories from source
    // =========================================================================
    const storiesQuery = storyId
      ? { where: { id: storyId, userId: sourceUserId, deleted: false } }
      : { where: { userId: sourceUserId, deleted: false } }

    const stories = await sourcePrisma.story.findMany({
      ...storiesQuery,
      include: {
        characters: true,
        contextItems: true,
        nodes: {
          orderBy: { order: 'asc' },
        },
        chapters: true, // Legacy chapters
        messages: {
          // Include deleted messages so they can be restored in the new system
          orderBy: { order: 'asc' },
          include: {
            versions: {
              orderBy: { version: 'desc' },
            },
            paragraphEmbeddings: true,
          },
        },
        maps: {
          include: {
            landmarks: {
              include: { states: true },
            },
            fleets: {
              include: { movements: true },
            },
            hyperlanes: {
              include: { segments: true },
            },
          },
        },
        calendars: true,
      },
    })

    logger.info(`Found ${stories.length} stories to migrate`)

    // =========================================================================
    // 2. Migrate each story
    // =========================================================================
    for (const story of stories) {
      logger.info(`\nMigrating story: ${story.name} (${story.id})`)

      // Check if story already exists
      const existingStory = await findExistingMigratedStory(targetPrisma, story.id)

      if (existingStory) {
        if (replace) {
          logger.info(`Story "${story.name}" already imported (${existingStory.id}), replacing...`)
          if (!dryRun) {
            await deleteExistingStory(targetPrisma, existingStory.id, logger)
          }
        } else {
          logger.info(`Story "${story.name}" already imported (${existingStory.id}), skipping.`)
          logger.info('Use --replace to delete and re-import the story.')
          skippedStories.push(story.name)
          continue
        }
      }

      const newStoryId = generateCuid()
      idMapper.setMapping('story', story.id, newStoryId)
      migratedStoryIds.push(newStoryId)

      if (!dryRun) {
        await targetPrisma.story.create({
          data: {
            id: newStoryId,
            name: story.name,
            summary: story.storySetting || null,
            ownerId: targetUserId,
            importedFromId: story.id, // Store original ID for re-migration detection
            published: false,
            status: 'ONGOING',
            type: 'ORIGINAL',
            defaultPerspective: story.person === 'first' ? 'FIRST' : 'THIRD',
            timelineStartTime: story.timelineStartTime,
            timelineEndTime: story.timelineEndTime,
            timelineGranularity: story.timelineGranularity,
            branchChoices: story.branchChoices,
            provider: story.provider,
            model: story.model,
            globalScript: story.globalScript || null,
            sortOrder: 0,
            createdAt: story.savedAt,
            updatedAt: story.updatedAt,
          },
        })
      }
      stats.stories++

      // =========================================================================
      // 3. Migrate Characters
      // =========================================================================
      logger.info(`  Migrating ${story.characters.length} characters...`)

      for (const char of story.characters) {
        const newCharId = generateCuid()
        idMapper.setMapping('character', char.id, newCharId)

        if (!dryRun) {
          await targetPrisma.character.create({
            data: {
              id: newCharId,
              storyId: newStoryId,
              firstName: char.name.split(' ')[0] || char.name,
              lastName: char.name.split(' ').slice(1).join(' ') || null,
              description: char.description,
              isMainCharacter: char.isProtagonist,
              birthdate: char.birthdate,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })
        }
        stats.characters++
      }

      // =========================================================================
      // 4. Migrate ContextItems
      // =========================================================================
      logger.info(`  Migrating ${story.contextItems.length} context items...`)

      for (const ctx of story.contextItems) {
        const newCtxId = generateCuid()
        idMapper.setMapping('contextItem', ctx.id, newCtxId)

        if (!dryRun) {
          await targetPrisma.contextItem.create({
            data: {
              id: newCtxId,
              storyId: newStoryId,
              type: ctx.type,
              name: ctx.name,
              description: ctx.description,
              isGlobal: ctx.isGlobal,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })
        }
        stats.contextItems++
      }

      // =========================================================================
      // 5. Migrate Calendars
      // =========================================================================
      logger.info(`  Migrating ${story.calendars.length} calendars...`)

      for (const cal of story.calendars) {
        const newCalId = generateCuid()
        idMapper.setMapping('calendar', cal.id, newCalId)

        // Parse the config to extract the name
        let config: Record<string, unknown> = {}
        let calName = 'Default Calendar'
        try {
          config = JSON.parse(cal.config)
          if (config.name && typeof config.name === 'string') {
            calName = config.name
          }
        } catch {
          errors.push(`Failed to parse calendar config for ${cal.id}`)
        }

        if (!dryRun) {
          await targetPrisma.calendar.create({
            data: {
              id: newCalId,
              storyId: newStoryId,
              name: calName,
              config, // Will be stored as JSONB
              createdAt: cal.createdAt,
              updatedAt: cal.updatedAt,
            },
          })
        }
        stats.calendars++
      }

      // Update default calendar
      if (story.defaultCalendarId) {
        const newDefaultCalId = idMapper.getMapping('calendar', story.defaultCalendarId)
        if (newDefaultCalId && !dryRun) {
          await targetPrisma.story.update({
            where: { id: newStoryId },
            data: { defaultCalendarId: newDefaultCalId },
          })
        }
      }

      // =========================================================================
      // 6. Migrate Node hierarchy → Book/Arc/Chapter
      // =========================================================================
      // Count chapters for progress display
      const totalChapters = story.nodes.filter((n) => n.type === 'chapter').length
      let processedChapters = 0

      logger.info(`  Migrating ${story.nodes.length} nodes (${totalChapters} chapters) to hierarchy...`)

      // Build tree from flat nodes
      const _nodeMap = new Map(story.nodes.map((n) => [n.id, n]))
      const rootNodes = story.nodes.filter((n) => !n.parentId)

      // Sort roots by order
      rootNodes.sort((a, b) => a.order - b.order)

      const processNode = async (
        node: (typeof story.nodes)[0],
        parentInfo: { type: string; id: string } | null,
        sortOrder: number,
      ) => {
        const children = story.nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.order - b.order)

        if (node.type === 'book') {
          const newBookId = generateCuid()
          idMapper.setMapping('book', node.id, newBookId)
          idMapper.setMapping('node', node.id, newBookId)

          if (!dryRun) {
            await targetPrisma.book.create({
              data: {
                id: newBookId,
                name: node.title,
                summary: node.summary,
                storyId: newStoryId,
                sortOrder,
                nodeType: 'story',
                createdAt: node.createdAt,
                updatedAt: node.updatedAt,
              },
            })
          }
          stats.books++

          for (let i = 0; i < children.length; i++) {
            await processNode(children[i], { type: 'book', id: newBookId }, i)
          }
        } else if (node.type === 'arc') {
          const newArcId = generateCuid()
          idMapper.setMapping('arc', node.id, newArcId)
          idMapper.setMapping('node', node.id, newArcId)

          if (!parentInfo || parentInfo.type !== 'book') {
            errors.push(`Arc ${node.id} has no parent book`)
            return
          }

          if (!dryRun) {
            await targetPrisma.arc.create({
              data: {
                id: newArcId,
                name: node.title,
                summary: node.summary,
                bookId: parentInfo.id,
                sortOrder,
                nodeType: 'story',
                createdAt: node.createdAt,
                updatedAt: node.updatedAt,
              },
            })
          }
          stats.arcs++

          for (let i = 0; i < children.length; i++) {
            await processNode(children[i], { type: 'arc', id: newArcId }, i)
          }
        } else if (node.type === 'chapter') {
          const newChapterId = generateCuid()
          idMapper.setMapping('chapter', node.id, newChapterId)
          idMapper.setMapping('node', node.id, newChapterId)

          if (!parentInfo || parentInfo.type !== 'arc') {
            errors.push(`Chapter ${node.id} has no parent arc`)
            return
          }

          if (!dryRun) {
            await targetPrisma.chapter.create({
              data: {
                id: newChapterId,
                name: node.title,
                summary: node.summary,
                arcId: parentInfo.id,
                sortOrder,
                nodeType: 'story',
                status: node.status || null,
                createdAt: node.createdAt,
                updatedAt: node.updatedAt,
              },
            })
          }
          stats.chapters++

          // Create a Scene for this chapter's content
          // In story-backend, Messages belong directly to Nodes (chapters)
          // In unified, we need Scene as an intermediate layer
          const newSceneId = generateCuid()
          idMapper.setMapping('scene', node.id, newSceneId)

          // Parse active character/context IDs from node
          let activeCharacterIds: string[] | null = null
          let activeContextItemIds: string[] | null = null
          let viewpointCharacterId: string | null = null

          if (node.activeCharacterIds) {
            try {
              const charIds = JSON.parse(node.activeCharacterIds) as string[]
              activeCharacterIds = charIds
                .map((id) => idMapper.getMapping('character', id))
                .filter((id): id is string => !!id)
            } catch {
              // Ignore parse errors
            }
          }

          if (node.activeContextItemIds) {
            try {
              const ctxIds = JSON.parse(node.activeContextItemIds) as string[]
              activeContextItemIds = ctxIds
                .map((id) => idMapper.getMapping('contextItem', id))
                .filter((id): id is string => !!id)
            } catch {
              // Ignore parse errors
            }
          }

          if (node.viewpointCharacterId) {
            viewpointCharacterId = idMapper.getMapping('character', node.viewpointCharacterId) || null
          }

          if (!dryRun) {
            await targetPrisma.scene.create({
              data: {
                id: newSceneId,
                name: 'Scene 1',
                summary: node.summary,
                chapterId: newChapterId,
                sortOrder: 0,
                status: node.status || null,
                includeInFull: node.includeInFull ?? 1,
                perspective: null, // Story-backend doesn't track perspective per scene
                viewpointCharacterId,
                activeCharacterIds: activeCharacterIds && activeCharacterIds.length > 0 ? activeCharacterIds : null,
                activeContextItemIds:
                  activeContextItemIds && activeContextItemIds.length > 0 ? activeContextItemIds : null,
                goal: node.goal,
                storyTime: node.storyTime,
                createdAt: node.createdAt,
                updatedAt: node.updatedAt,
              },
            })
          }
          stats.scenes++

          // Migrate messages for this chapter/scene (batched for performance)
          const chapterMessages = story.messages.filter((m) => m.nodeId === node.id)
          await migrateMessagesForScene(chapterMessages, newSceneId)

          processedChapters++
          const pct = Math.round((processedChapters / totalChapters) * 100)
          process.stdout.write(`\r    Chapter ${processedChapters}/${totalChapters} (${pct}%) - ${chapterMessages.length} messages`)
        }
      }

      // Clear the progress line after completion
      if (totalChapters > 0) {
        process.stdout.write('\r' + ' '.repeat(80) + '\r')
      }

      // Track branch messages that need their options updated after all messages are migrated
      const branchMessagesToUpdate: Array<{
        newMessageId: string
        sourceOptions: Array<{
          id: string
          label: string
          targetNodeId: string
          targetMessageId: string
          description?: string
        }>
      }> = []

      // Batched message migration - collects all data first, then bulk inserts
      const migrateMessagesForScene = async (messages: typeof story.messages, sceneId: string) => {
        if (messages.length === 0) return

        // Collect all data for batch insert
        const messagesToCreate: Array<{
          id: string
          sceneId: string
          sortOrder: number
          instruction: string | null
          script: string | null
          deleted: boolean
          type: string | null
          options: unknown | null
          createdAt: Date
          updatedAt: Date
        }> = []

        // Track message -> revision mapping for batch update
        const messageToRevisionMap: Array<{ messageId: string; revisionId: string }> = []

        const messageRevisionsToCreate: Array<{
          id: string
          messageId: string
          version: number
          versionType: string
          model: string | null
          tokensPerSecond: number | null
          totalTokens: number | null
          promptTokens: number | null
          cacheCreationTokens: number | null
          cacheReadTokens: number | null
          think: string | null
          showThink: boolean
          createdAt: Date
        }> = []

        const paragraphsToCreate: Array<{
          id: string
          messageRevisionId: string
          sortOrder: number
          createdAt: Date
          updatedAt: Date
        }> = []

        // Track paragraph -> revision mapping for batch update
        const paragraphToRevisionMap: Array<{ paragraphId: string; revisionId: string }> = []

        const paragraphRevisionsToCreate: Array<{
          id: string
          paragraphId: string
          body: string
          version: number
          state: null
          createdAt: Date
        }> = []

        // Process each message and collect data
        for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
          const msg = messages[msgIdx]
          const newMessageId = generateCuid()
          idMapper.setMapping('message', msg.id, newMessageId)

          // Build all versions including current, then sort by date to assign version numbers
          // The current message content is the latest version
          interface VersionEntry {
            content: string
            versionType: string
            model: string | null
            tokensPerSecond: number | null
            totalTokens: number | null
            promptTokens: number | null
            cacheCreationTokens: number | null
            cacheReadTokens: number | null
            think: string | null
            showThink: boolean
            createdAt: Date
            isCurrent: boolean
            paragraphs?: string[]
          }

          const allVersions: VersionEntry[] = []

          // Add historical versions from msg.versions
          for (const version of msg.versions) {
            allVersions.push({
              content: version.content,
              versionType: version.versionType || 'edit',
              model: version.model,
              tokensPerSecond: null,
              totalTokens: null,
              promptTokens: null,
              cacheCreationTokens: null,
              cacheReadTokens: null,
              think: null,
              showThink: false,
              createdAt: new Date(version.createdAt),
              isCurrent: false,
            })
          }

          // Add current message content as the latest version
          // Parse paragraphs for current content
          let currentParagraphTexts: string[] = []
          if (msg.paragraphs) {
            currentParagraphTexts = (msg.paragraphs as string[]).filter((p) => p != null)
          } else {
            currentParagraphTexts = msg.content
              .split(/\n\n+/)
              .filter((p) => p.trim())
              .map((text) => text.trim())
          }

          allVersions.push({
            content: msg.content,
            versionType: allVersions.length === 0 ? 'initial' : 'edit',
            model: msg.model,
            tokensPerSecond: msg.tokensPerSecond,
            totalTokens: msg.totalTokens,
            promptTokens: msg.promptTokens,
            cacheCreationTokens: msg.cacheCreationTokens,
            cacheReadTokens: msg.cacheReadTokens,
            think: msg.think,
            showThink: msg.showThink ?? false,
            createdAt: new Date(msg.timestamp),
            isCurrent: true,
            paragraphs: currentParagraphTexts,
          })

          // Sort by creation date ascending (oldest first = version 1)
          allVersions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

          // Find which revision ID will be the current one
          let currentRevisionId: string | null = null

          // Create revisions with correct version numbers
          for (let versionIdx = 0; versionIdx < allVersions.length; versionIdx++) {
            const versionEntry = allVersions[versionIdx]
            const versionNumber = versionIdx + 1 // Version 1, 2, 3, etc.
            const newRevisionId = generateCuid()

            if (versionEntry.isCurrent) {
              currentRevisionId = newRevisionId
            }

            messageRevisionsToCreate.push({
              id: newRevisionId,
              messageId: newMessageId,
              version: versionNumber,
              versionType: versionNumber === 1 ? 'initial' : versionEntry.versionType,
              model: versionEntry.model,
              tokensPerSecond: versionEntry.tokensPerSecond,
              totalTokens: versionEntry.totalTokens,
              promptTokens: versionEntry.promptTokens,
              cacheCreationTokens: versionEntry.cacheCreationTokens,
              cacheReadTokens: versionEntry.cacheReadTokens,
              think: versionEntry.think,
              showThink: versionEntry.showThink,
              createdAt: versionEntry.createdAt,
            })

            // Create paragraphs for this revision
            if (versionEntry.isCurrent && versionEntry.paragraphs) {
              // Current version has structured paragraphs
              for (let pIdx = 0; pIdx < versionEntry.paragraphs.length; pIdx++) {
                const newParagraphId = generateCuid()
                const newParagraphRevisionId = generateCuid()

                paragraphsToCreate.push({
                  id: newParagraphId,
                  messageRevisionId: newRevisionId,
                  sortOrder: pIdx,
                  createdAt: versionEntry.createdAt,
                  updatedAt: versionEntry.createdAt,
                })
                paragraphToRevisionMap.push({ paragraphId: newParagraphId, revisionId: newParagraphRevisionId })

                paragraphRevisionsToCreate.push({
                  id: newParagraphRevisionId,
                  paragraphId: newParagraphId,
                  body: versionEntry.paragraphs[pIdx] ?? '',
                  version: 1,
                  state: null,
                  createdAt: versionEntry.createdAt,
                })
              }
              stats.paragraphs += versionEntry.paragraphs.length
            } else {
              // Historical version - single paragraph with full content
              const newParagraphId = generateCuid()
              const newParagraphRevisionId = generateCuid()

              paragraphsToCreate.push({
                id: newParagraphId,
                messageRevisionId: newRevisionId,
                sortOrder: 0,
                createdAt: versionEntry.createdAt,
                updatedAt: versionEntry.createdAt,
              })
              paragraphToRevisionMap.push({ paragraphId: newParagraphId, revisionId: newParagraphRevisionId })

              paragraphRevisionsToCreate.push({
                id: newParagraphRevisionId,
                paragraphId: newParagraphId,
                body: versionEntry.content,
                version: 1,
                state: null,
                createdAt: versionEntry.createdAt,
              })
            }
          }

          // Message (currentMessageRevisionId set via batch update after revisions exist)
          // For branch messages, track for post-processing (targets may not be migrated yet)
          if (msg.type === 'branch' && msg.options) {
            const sourceOptions = msg.options as Array<{
              id: string
              label: string
              targetNodeId: string
              targetMessageId: string
              description?: string
            }>
            branchMessagesToUpdate.push({
              newMessageId,
              sourceOptions,
            })
          }

          messagesToCreate.push({
            id: newMessageId,
            sceneId,
            sortOrder: msgIdx,
            instruction: msg.instruction,
            script: msg.script,
            deleted: msg.deleted ?? false, // Preserve deleted status for restoration
            type: msg.type || null, // Preserve message type (branch, event, chapter)
            options: null, // Will be updated after all messages are migrated
            createdAt: msg.timestamp,
            updatedAt: msg.timestamp,
          })

          if (currentRevisionId) {
            messageToRevisionMap.push({ messageId: newMessageId, revisionId: currentRevisionId })
          }

          stats.messages++
        }

        // Bulk insert all data (order matters for FK constraints)
        if (!dryRun) {
          // 1. Create messages first (revisions reference them)
          await targetPrisma.message.createMany({ data: messagesToCreate })

          // 2. Create message revisions (they reference messages)
          await targetPrisma.messageRevision.createMany({ data: messageRevisionsToCreate })

          // 3. Batch update messages to set currentMessageRevisionId
          // Using raw SQL for efficient batch update
          if (messageToRevisionMap.length > 0) {
            const messageUpdateCases = messageToRevisionMap
              .map((m) => `WHEN '${m.messageId}' THEN '${m.revisionId}'`)
              .join(' ')
            const messageIds = messageToRevisionMap.map((m) => `'${m.messageId}'`).join(',')
            await targetPrisma.$executeRawUnsafe(`
              UPDATE "Message"
              SET "currentMessageRevisionId" = CASE "id" ${messageUpdateCases} END
              WHERE "id" IN (${messageIds})
            `)
          }

          // 4. Create paragraphs first (revisions reference them)
          await targetPrisma.paragraph.createMany({ data: paragraphsToCreate })

          // 5. Create paragraph revisions (they reference paragraphs)
          await targetPrisma.paragraphRevision.createMany({ data: paragraphRevisionsToCreate })

          // 6. Batch update paragraphs to set currentParagraphRevisionId
          if (paragraphToRevisionMap.length > 0) {
            const paragraphUpdateCases = paragraphToRevisionMap
              .map((p) => `WHEN '${p.paragraphId}' THEN '${p.revisionId}'`)
              .join(' ')
            const paragraphIds = paragraphToRevisionMap.map((p) => `'${p.paragraphId}'`).join(',')
            await targetPrisma.$executeRawUnsafe(`
              UPDATE "Paragraph"
              SET "currentParagraphRevisionId" = CASE "id" ${paragraphUpdateCases} END
              WHERE "id" IN (${paragraphIds})
            `)
          }
        }
      }

      // Process root nodes (books)
      for (let i = 0; i < rootNodes.length; i++) {
        await processNode(rootNodes[i], null, i)
      }

      // =========================================================================
      // 6b. Update branch message options with remapped IDs
      // =========================================================================
      if (branchMessagesToUpdate.length > 0) {
        logger.info(`  Updating ${branchMessagesToUpdate.length} branch message options...`)
        for (const branch of branchMessagesToUpdate) {
          const mappedOptions = branch.sourceOptions.map((opt) => ({
            id: opt.id,
            label: opt.label,
            // Map old node ID to new scene ID (scenes were created from chapters/nodes)
            targetNodeId: idMapper.getMapping('scene', opt.targetNodeId) || opt.targetNodeId,
            // Map old message ID to new message ID
            targetMessageId: idMapper.getMapping('message', opt.targetMessageId) || opt.targetMessageId,
            description: opt.description,
          }))

          if (!dryRun) {
            await targetPrisma.message.update({
              where: { id: branch.newMessageId },
              data: { options: mappedOptions },
            })
          }
        }
      }

      // =========================================================================
      // 6c. Update branchChoices with remapped message IDs
      // =========================================================================
      if (story.branchChoices && Object.keys(story.branchChoices).length > 0) {
        logger.info(`  Remapping ${Object.keys(story.branchChoices).length} branch choices...`)
        const remappedBranchChoices: Record<string, string> = {}

        for (const [oldMessageId, optionId] of Object.entries(story.branchChoices)) {
          const newMessageId = idMapper.getMapping('message', oldMessageId)
          if (newMessageId) {
            remappedBranchChoices[newMessageId] = optionId as string
          } else {
            logger.warn(`    Branch choice for message ${oldMessageId} could not be remapped (message not found)`)
          }
        }

        if (!dryRun && Object.keys(remappedBranchChoices).length > 0) {
          await targetPrisma.story.update({
            where: { id: newStoryId },
            data: { branchChoices: remappedBranchChoices },
          })
          logger.info(`    Updated story with ${Object.keys(remappedBranchChoices).length} remapped branch choices`)
        }
      }

      // =========================================================================
      // 6d. Update selectedNodeId with remapped scene ID
      // =========================================================================
      if (story.selectedNodeId) {
        const newSelectedNodeId = idMapper.getMapping('scene', story.selectedNodeId)
        if (newSelectedNodeId) {
          logger.info(`  Remapping selectedNodeId: ${story.selectedNodeId} -> ${newSelectedNodeId}`)
          if (!dryRun) {
            await targetPrisma.story.update({
              where: { id: newStoryId },
              data: { selectedNodeId: newSelectedNodeId },
            })
          }
        } else {
          logger.warn(`  Could not remap selectedNodeId ${story.selectedNodeId} (scene not found)`)
        }
      }

      // =========================================================================
      // 7. Migrate Files (map images, etc.)
      // =========================================================================
      // Get all files for this story from the source database
      const sourceFiles = await sourcePrisma.file.findMany({
        where: { storyId: story.id },
      })
      logger.info(`  Migrating ${sourceFiles.length} files...`)

      // Check if R2 is configured
      const useR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)

      // Ensure uploads directory exists (for local storage fallback)
      const uploadsDir = path.resolve(__dirname, '../../uploads')
      if (!useR2 && !fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }

      for (const file of sourceFiles) {
        const newFileId = generateCuid()
        idMapper.setMapping('file', file.id, newFileId)

        if (!dryRun) {
          // Generate a unique filename
          const ext = path.extname(file.filename) || '.bin'
          const uniqueFilename = `${newFileId}${ext}`
          const sha256 = crypto.createHash('sha256').update(file.data).digest('hex')

          let filePath: string | null = null
          let r2Key: string | null = null
          let urlPath: string

          if (useR2) {
            // Upload to R2
            const { putToR2, generateStorageKey } = await import('../../src/lib/r2-storage.js')
            r2Key = generateStorageKey(targetUserId, uniqueFilename)
            const result = await putToR2(r2Key, file.data, file.mimeType, 'private')
            urlPath = result.url
          } else {
            // Fall back to local storage
            filePath = path.join(uploadsDir, uniqueFilename)
            urlPath = `/files/${uniqueFilename}`
            fs.writeFileSync(filePath, file.data)
          }

          // Create the file record in the target database
          await targetPrisma.file.create({
            data: {
              id: newFileId,
              ownerId: targetUserId,
              storyId: newStoryId,
              localPath: filePath,
              r2Key: r2Key,
              visibility: 'private',
              path: urlPath,
              sha256,
              bytes: file.data.length,
              mimeType: file.mimeType,
              createdAt: file.createdAt,
              updatedAt: file.createdAt, // Source doesn't have updatedAt
            },
          })
        }
        stats.files++
      }

      // =========================================================================
      // 7b. Update Characters with Profile Images
      // =========================================================================
      // Now that files are migrated, update characters with their profile images
      logger.info(`  Linking character profile images...`)
      let linkedImages = 0
      for (const char of story.characters) {
        if (char.profileImageId) {
          const newFileId = idMapper.getMapping('file', char.profileImageId)
          const newCharId = idMapper.getMapping('character', char.id)
          if (newFileId && newCharId && !dryRun) {
            await targetPrisma.character.update({
              where: { id: newCharId },
              data: { pictureFileId: newFileId },
            })
            linkedImages++
          }
        }
      }
      if (linkedImages > 0) {
        logger.info(`    Linked ${linkedImages} character profile images`)
      }

      // =========================================================================
      // 8. Migrate Maps
      // =========================================================================
      logger.info(`  Migrating ${story.maps.length} maps...`)

      // Default property schema for Star Wars stories (migrated from fixed columns)
      const starWarsPropertySchema = {
        properties: [
          { key: 'population', label: 'Population', type: 'text' },
          { key: 'industry', label: 'Industry', type: 'enum', options: [
            { value: 'farming', label: 'Agricultural' },
            { value: 'mining', label: 'Mining' },
            { value: 'trade', label: 'Trade Hub' },
            { value: 'political', label: 'Political' },
            { value: 'industry', label: 'Industrial' },
          ]},
          { key: 'region', label: 'Region', type: 'text' },
          { key: 'sector', label: 'Sector', type: 'text' },
          { key: 'planetaryBodies', label: 'Planetary Bodies', type: 'text' },
        ],
        stateFields: [
          { key: 'allegiance', label: 'Allegiance', options: [
            { value: 'republic', label: 'Republic', color: '#3498db' },
            { value: 'separatist', label: 'Separatist', color: '#e74c3c' },
            { value: 'contested', label: 'Contested', color: '#f39c12' },
            { value: 'neutral', label: 'Neutral', color: '#95a5a6' },
            { value: 'independent', label: 'Independent', color: '#7f8c8d' },
          ]},
        ],
      }

      for (const map of story.maps) {
        const newMapId = generateCuid()
        idMapper.setMapping('map', map.id, newMapId)

        // Get the new file ID (mapped from old fileId)
        const newFileId = map.fileId ? idMapper.getMapping('file', map.fileId) : null

        if (!dryRun) {
          await targetPrisma.map.create({
            data: {
              id: newMapId,
              storyId: newStoryId,
              name: map.name,
              fileId: newFileId,
              borderColor: map.borderColor,
              propertySchema: starWarsPropertySchema,
              createdAt: map.createdAt,
              updatedAt: map.updatedAt,
            },
          })
        }
        stats.maps++

        // Migrate Landmarks
        for (const landmark of map.landmarks) {
          const newLandmarkId = generateCuid()
          idMapper.setMapping('landmark', landmark.id, newLandmarkId)

          // Convert fixed columns to properties JSON
          const properties: Record<string, string> = {}
          if (landmark.population) properties.population = landmark.population
          if (landmark.industry) properties.industry = landmark.industry
          if (landmark.region) properties.region = landmark.region
          if (landmark.sector) properties.sector = landmark.sector
          if (landmark.planetaryBodies) properties.planetaryBodies = landmark.planetaryBodies

          if (!dryRun) {
            await targetPrisma.landmark.create({
              data: {
                id: newLandmarkId,
                mapId: newMapId,
                x: landmark.x,
                y: landmark.y,
                name: landmark.name,
                description: landmark.description,
                type: landmark.type,
                color: landmark.color,
                size: landmark.size,
                properties,
              },
            })

            // Migrate LandmarkStates
            for (const state of landmark.states) {
              await targetPrisma.landmarkState.create({
                data: {
                  id: generateCuid(),
                  storyId: newStoryId,
                  mapId: newMapId,
                  landmarkId: newLandmarkId,
                  storyTime: state.storyTime,
                  field: state.field,
                  value: state.value,
                  createdAt: state.createdAt,
                  updatedAt: state.updatedAt,
                },
              })
            }
          }
          stats.landmarks++
        }

        // Migrate Fleets → Pawns
        for (const fleet of map.fleets) {
          const newPawnId = generateCuid()
          idMapper.setMapping('fleet', fleet.id, newPawnId)
          idMapper.setMapping('pawn', fleet.id, newPawnId)

          if (!dryRun) {
            await targetPrisma.pawn.create({
              data: {
                id: newPawnId,
                mapId: newMapId,
                name: fleet.name,
                description: fleet.description,
                designation: fleet.designation,
                speed: fleet.hyperdriveRating, // Renamed field
                defaultX: fleet.defaultX,
                defaultY: fleet.defaultY,
                color: fleet.color,
                size: fleet.size,
              },
            })

            // Migrate FleetMovements → PawnMovements
            for (const movement of fleet.movements) {
              await targetPrisma.pawnMovement.create({
                data: {
                  id: generateCuid(),
                  storyId: newStoryId,
                  mapId: newMapId,
                  pawnId: newPawnId,
                  startStoryTime: movement.startStoryTime,
                  endStoryTime: movement.endStoryTime,
                  startX: movement.startX,
                  startY: movement.startY,
                  endX: movement.endX,
                  endY: movement.endY,
                  createdAt: movement.createdAt,
                  updatedAt: movement.updatedAt,
                },
              })
            }
          }
          stats.pawns++
        }

        // Migrate Hyperlanes → Paths
        for (const hyperlane of map.hyperlanes) {
          const newPathId = generateCuid()
          idMapper.setMapping('hyperlane', hyperlane.id, newPathId)
          idMapper.setMapping('path', hyperlane.id, newPathId)

          if (!dryRun) {
            await targetPrisma.path.create({
              data: {
                id: newPathId,
                mapId: newMapId,
                speedMultiplier: hyperlane.speedMultiplier,
                createdAt: hyperlane.createdAt,
                updatedAt: hyperlane.updatedAt,
              },
            })

            // Migrate HyperlaneSegments → PathSegments
            for (const segment of hyperlane.segments) {
              await targetPrisma.pathSegment.create({
                data: {
                  id: generateCuid(),
                  pathId: newPathId,
                  mapId: newMapId,
                  order: segment.order,
                  startX: segment.startX,
                  startY: segment.startY,
                  endX: segment.endX,
                  endY: segment.endY,
                  startLandmarkId: segment.startLandmarkId
                    ? idMapper.getMapping('landmark', segment.startLandmarkId)
                    : null,
                  endLandmarkId: segment.endLandmarkId ? idMapper.getMapping('landmark', segment.endLandmarkId) : null,
                  createdAt: segment.createdAt,
                  updatedAt: segment.updatedAt,
                },
              })
            }
          }
          stats.paths++
        }
      }

      logger.info('  Story migration complete')
    }

    // =========================================================================
    // 8. Summary
    // =========================================================================
    logger.info(`\n${'='.repeat(60)}`)
    logger.info('Migration complete!')
    logger.info('='.repeat(60))
    logger.info('Statistics:')
    logger.info(`  - Stories: ${stats.stories}`)
    logger.info(`  - Books: ${stats.books}`)
    logger.info(`  - Arcs: ${stats.arcs}`)
    logger.info(`  - Chapters: ${stats.chapters}`)
    logger.info(`  - Scenes: ${stats.scenes}`)
    logger.info(`  - Messages: ${stats.messages}`)
    logger.info(`  - Paragraphs: ${stats.paragraphs}`)
    logger.info(`  - Characters: ${stats.characters}`)
    logger.info(`  - Context Items: ${stats.contextItems}`)
    logger.info(`  - Calendars: ${stats.calendars}`)
    logger.info(`  - Files: ${stats.files}`)
    logger.info(`  - Maps: ${stats.maps}`)
    logger.info(`  - Landmarks: ${stats.landmarks}`)
    logger.info(`  - Pawns (Fleets): ${stats.pawns}`)
    logger.info(`  - Paths (Hyperlanes): ${stats.paths}`)

    if (errors.length > 0) {
      logger.warn(`\nEncountered ${errors.length} errors:`)
      for (const error of errors) {
        logger.warn(`  - ${error}`)
      }
    }

    if (skippedStories.length > 0) {
      logger.info(`\nSkipped ${skippedStories.length} already-migrated stories: ${skippedStories.join(', ')}`)
    }

    return {
      success: errors.length === 0,
      skippedStories,
      storyIds: migratedStoryIds,
      idMappings: idMapper,
      stats,
      errors,
    }
  } catch (error) {
    logger.error('Migration failed', error)
    return {
      success: false,
      skippedStories,
      storyIds: migratedStoryIds,
      idMappings: idMapper,
      stats,
      errors: [...errors, error instanceof Error ? error.message : String(error)],
    }
  }
}

async function showHelp(sourceUserId?: string, targetUserId?: number) {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    Story Migration Tool                                      ║
║                                                                              ║
║  Migrates stories from Story Backend (SQLite) to Unified Backend (PostgreSQL)║
╚══════════════════════════════════════════════════════════════════════════════╝

Usage:
  pnpm migrate:story <source-user-id> <target-user-id> [story-id] [options]

Arguments:
  source-user-id   User ID (cuid) from story-backend SQLite database
  target-user-id   User ID (integer) in unified-backend PostgreSQL database
  story-id         (Optional) Specific story ID to migrate
                   If omitted, shows available stories to choose from

Options:
  --all            Migrate all stories (required if no story-id specified)
  --dry-run        Preview changes without modifying the database
  --replace        Delete and re-import stories that already exist
  --help, -h       Show this help message

Environment Variables:
  SOURCE_DATABASE_URL   SQLite connection string for story-backend
                        Default: file:../../story-backend/prisma/dev.db
  DATABASE_URL          PostgreSQL connection string for unified-backend
`)

  // Try to show available users from databases
  try {
    const { PrismaClient: TargetPrismaClient } = await import('@prisma/client')
    const { PrismaClient: SourcePrismaClient } = await import('../../src/generated/story-prisma')

    const sourcePrisma = new SourcePrismaClient({
      datasources: {
        db: { url: process.env.SOURCE_DATABASE_URL || 'file:../../story-backend/prisma/dev.db' },
      },
    })
    const targetPrisma = new TargetPrismaClient()

    // Get users from both databases
    const [sourceUsers, targetUsers] = await Promise.all([
      sourcePrisma.user.findMany({ take: 5, select: { id: true, email: true } }),
      targetPrisma.user.findMany({ take: 5, select: { id: true, email: true } }),
    ])

    if (sourceUsers.length > 0) {
      console.log('Available source users (story-backend):')
      for (const user of sourceUsers) {
        console.log(`  ${user.id}  ${user.email}`)
      }
      console.log('')
    }

    if (targetUsers.length > 0) {
      console.log('Available target users (unified-backend):')
      for (const user of targetUsers) {
        console.log(`  ${user.id}  ${user.email}`)
      }
      console.log('')
    }

    // If source user ID provided, show their stories
    if (sourceUserId) {
      const stories = await sourcePrisma.story.findMany({
        where: { userId: sourceUserId, deleted: false },
        select: { id: true, name: true },
        take: 20,
      })

      if (stories.length > 0) {
        console.log(`Stories for source user ${sourceUserId}:`)
        for (const story of stories) {
          console.log(`  ${story.id}  "${story.name}"`)
        }
        console.log('')
      } else {
        console.log(`No stories found for source user ${sourceUserId}\n`)
      }
    }

    await sourcePrisma.$disconnect()
    await targetPrisma.$disconnect()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    if (errorMsg.includes('Cannot find module') && errorMsg.includes('story-prisma')) {
      console.log('Source Prisma client not generated. Run this first:')
      console.log('  cd apps/mythweavers-backend && pnpm prisma:generate:source\n')
    } else {
      console.log('Could not connect to databases to show available users.')
      console.log(`Error: ${errorMsg}`)
      console.log('')
      console.log('Make sure SOURCE_DATABASE_URL and DATABASE_URL are set correctly.')
      console.log(`Current SOURCE_DATABASE_URL: ${process.env.SOURCE_DATABASE_URL || '(not set, using default)'}\n`)
    }
  }

  console.log(`Examples:
  # List available stories for a user
  pnpm migrate:story clx1234567890 1

  # Migrate a specific story
  pnpm migrate:story clx1234567890 1 story_cuid_here

  # Migrate ALL stories for a user
  pnpm migrate:story clx1234567890 1 --all

  # Preview migration without changes
  pnpm migrate:story clx1234567890 1 --all --dry-run

  # Re-import an already migrated story
  pnpm migrate:story clx1234567890 1 story_cuid_here --replace
`)
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2)
  const nonFlagArgs = args.filter((a) => !a.startsWith('--'))

  // Show help if requested or no arguments provided
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    // Pass any provided user IDs to show relevant info
    const sourceUserId = nonFlagArgs[0]
    const targetUserId = nonFlagArgs[1] ? Number.parseInt(nonFlagArgs[1], 10) : undefined
    await showHelp(sourceUserId, targetUserId)
    process.exit(args.length === 0 ? 1 : 0)
  }

  if (args.length < 2) {
    console.error('Error: Missing required arguments.\n')
    await showHelp(nonFlagArgs[0])
    process.exit(1)
  }

  const sourceUserId = args[0]
  const targetUserId = Number.parseInt(args[1], 10)
  const storyIdArg = args.find((a) => !a.startsWith('--') && a !== sourceUserId && a !== args[1])
  const dryRun = args.includes('--dry-run')
  const replace = args.includes('--replace')
  const migrateAll = args.includes('--all')

  if (Number.isNaN(targetUserId)) {
    console.error('Error: target-user-id must be a number')
    process.exit(1)
  }

  const logger = createConsoleLogger()

  // Dynamic imports - only load Prisma clients after validating arguments
  // This allows showing help without needing the generated clients
  const { PrismaClient: TargetPrismaClient } = await import('@prisma/client')
  const { PrismaClient: SourcePrismaClient } = await import('../../src/generated/story-prisma')

  // Initialize Prisma clients
  const sourcePrisma = new SourcePrismaClient({
    datasources: {
      db: {
        url: process.env.SOURCE_DATABASE_URL || 'file:../../story-backend/prisma/dev.db',
      },
    },
  })

  const targetPrisma = new TargetPrismaClient()

  // If no story ID and no --all flag, show available stories
  if (!storyIdArg && !migrateAll) {
    const stories = await sourcePrisma.story.findMany({
      where: { userId: sourceUserId, deleted: false },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })

    if (stories.length === 0) {
      console.log(`No stories found for user ${sourceUserId}`)
      process.exit(1)
    }

    console.log(`\nAvailable stories for user ${sourceUserId}:\n`)
    for (const story of stories) {
      const date = story.updatedAt.toISOString().split('T')[0]
      console.log(`  ${story.id}  "${story.name}" (${date})`)
    }
    console.log(`\nTo migrate a specific story:`)
    console.log(`  pnpm migrate:story ${sourceUserId} ${targetUserId} <story-id>\n`)
    console.log(`To migrate ALL ${stories.length} stories:`)
    console.log(`  pnpm migrate:story ${sourceUserId} ${targetUserId} --all\n`)

    await sourcePrisma.$disconnect()
    await targetPrisma.$disconnect()
    process.exit(0)
  }

  try {
    const result = await migrateFromStoryBackend(sourcePrisma, targetPrisma, {
      sourceUserId,
      targetUserId,
      storyId: storyIdArg,
      dryRun,
      replace,
      logger,
    })

    if (result.success) {
      if (result.storyIds.length === 0 && result.skippedStories.length > 0) {
        logger.info('\nAll stories already migrated, nothing to do.')
      } else {
        logger.info('\nMigration successful!')
        if (result.storyIds.length > 0) {
          logger.info(`Migrated story IDs: ${result.storyIds.join(', ')}`)
        }

        // Save ID mappings for reference
        if (!dryRun && result.storyIds.length > 0) {
          const fs = await import('node:fs')
          const mappingsPath = `./migration-mappings-${Date.now()}.json`
          fs.writeFileSync(mappingsPath, JSON.stringify(result.idMappings.toJSON(), null, 2))
          logger.info(`ID mappings saved to: ${mappingsPath}`)
        }
      }
    } else {
      logger.error('Migration completed with errors')
      process.exit(1)
    }
  } finally {
    await sourcePrisma.$disconnect()
    await targetPrisma.$disconnect()
  }
}

// Run if called directly
main()
