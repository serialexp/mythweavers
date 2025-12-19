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

import { PrismaClient as TargetPrisma } from '@prisma/client'
import { PrismaClient as SourcePrisma } from '../../src/generated/story-prisma'
import { IdMapper, type MigrationLogger, createConsoleLogger, generateCuid } from './utils'

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
          where: { deleted: false },
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
      logger.info(`  Migrating ${story.nodes.length} nodes to hierarchy...`)

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
                name: node.title,
                summary: node.summary,
                chapterId: newChapterId,
                sortOrder: 0,
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

          // Migrate messages for this chapter/scene
          const chapterMessages = story.messages.filter((m) => m.nodeId === node.id)

          for (let msgIdx = 0; msgIdx < chapterMessages.length; msgIdx++) {
            const msg = chapterMessages[msgIdx]
            await migrateMessage(msg, newSceneId, msgIdx)
          }
        }
      }

      const migrateMessage = async (msg: (typeof story.messages)[0], sceneId: string, sortOrder: number) => {
        const newMessageId = generateCuid()
        idMapper.setMapping('message', msg.id, newMessageId)

        if (!dryRun) {
          await targetPrisma.message.create({
            data: {
              id: newMessageId,
              sceneId,
              sortOrder,
              instruction: msg.instruction,
              script: msg.script,
              createdAt: msg.timestamp,
              updatedAt: msg.timestamp,
            },
          })
        }
        stats.messages++

        // Create MessageRevision from current message state
        const newMsgRevisionId = generateCuid()

        if (!dryRun) {
          await targetPrisma.messageRevision.create({
            data: {
              id: newMsgRevisionId,
              messageId: newMessageId,
              version: 1,
              versionType: 'initial',
              model: msg.model,
              tokensPerSecond: msg.tokensPerSecond,
              totalTokens: msg.totalTokens,
              promptTokens: msg.promptTokens,
              cacheCreationTokens: msg.cacheCreationTokens,
              cacheReadTokens: msg.cacheReadTokens,
              think: msg.think,
              showThink: msg.showThink,
              createdAt: msg.timestamp,
            },
          })
        }

        // Parse paragraphs from message content
        // In story-backend, msg.paragraphs is JSON with paragraph data
        // msg.content is the raw text
        let paragraphsData: Array<{ text: string; summary?: string }> = []

        if (msg.paragraphs) {
          try {
            paragraphsData = msg.paragraphs as Array<{ text: string; summary?: string }>
          } catch {
            // If parsing fails, treat entire content as one paragraph
            paragraphsData = [{ text: msg.content }]
          }
        } else {
          // Split content by double newlines as paragraphs
          paragraphsData = msg.content
            .split(/\n\n+/)
            .filter((p) => p.trim())
            .map((text) => ({ text: text.trim() }))
        }

        // Create Paragraph and ParagraphRevision for each
        for (let pIdx = 0; pIdx < paragraphsData.length; pIdx++) {
          const para = paragraphsData[pIdx]
          const newParagraphId = generateCuid()
          const newParagraphRevisionId = generateCuid()

          if (!dryRun) {
            await targetPrisma.paragraph.create({
              data: {
                id: newParagraphId,
                messageRevisionId: newMsgRevisionId,
                sortOrder: pIdx,
                createdAt: msg.timestamp,
                updatedAt: msg.timestamp,
              },
            })

            await targetPrisma.paragraphRevision.create({
              data: {
                id: newParagraphRevisionId,
                paragraphId: newParagraphId,
                body: para.text,
                version: 1,
                state: null, // Story-backend doesn't track paragraph state
                createdAt: msg.timestamp,
              },
            })

            // Set current revision
            await targetPrisma.paragraph.update({
              where: { id: newParagraphId },
              data: { currentParagraphRevisionId: newParagraphRevisionId },
            })
          }
          stats.paragraphs++
        }

        // Set current message revision
        if (!dryRun) {
          await targetPrisma.message.update({
            where: { id: newMessageId },
            data: { currentMessageRevisionId: newMsgRevisionId },
          })
        }

        // Migrate message versions
        for (const version of msg.versions) {
          if (version.version === 1) continue // Already created above

          const newVersionId = generateCuid()

          if (!dryRun) {
            await targetPrisma.messageRevision.create({
              data: {
                id: newVersionId,
                messageId: newMessageId,
                version: version.version,
                versionType: version.versionType,
                model: version.model,
                createdAt: version.createdAt,
              },
            })

            // Create paragraph for this version
            const versionParagraphId = generateCuid()
            const versionParagraphRevisionId = generateCuid()

            await targetPrisma.paragraph.create({
              data: {
                id: versionParagraphId,
                messageRevisionId: newVersionId,
                sortOrder: 0,
                createdAt: version.createdAt,
                updatedAt: version.createdAt,
              },
            })

            await targetPrisma.paragraphRevision.create({
              data: {
                id: versionParagraphRevisionId,
                paragraphId: versionParagraphId,
                body: version.content,
                version: 1,
                createdAt: version.createdAt,
              },
            })

            await targetPrisma.paragraph.update({
              where: { id: versionParagraphId },
              data: { currentParagraphRevisionId: versionParagraphRevisionId },
            })
          }
        }

        // Migrate paragraph embeddings
        for (const _embedding of msg.paragraphEmbeddings) {
          // Find the corresponding paragraph revision
          // This is approximate since embeddings are per-message paragraph index
          const _paragraphRevisionId = generateCuid() // Would need proper mapping

          if (!dryRun) {
            // Note: This would need the actual paragraph revision ID
            // For now, skipping embeddings migration as it requires more complex mapping
          }
        }
      }

      // Process root nodes (books)
      for (let i = 0; i < rootNodes.length; i++) {
        await processNode(rootNodes[i], null, i)
      }

      // =========================================================================
      // 7. Migrate Maps
      // =========================================================================
      logger.info(`  Migrating ${story.maps.length} maps...`)

      for (const map of story.maps) {
        const newMapId = generateCuid()
        idMapper.setMapping('map', map.id, newMapId)

        if (!dryRun) {
          await targetPrisma.map.create({
            data: {
              id: newMapId,
              storyId: newStoryId,
              name: map.name,
              fileId: map.fileId,
              borderColor: map.borderColor,
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
                population: landmark.population,
                industry: landmark.industry,
                color: landmark.color,
                size: landmark.size,
                region: landmark.region,
                sector: landmark.sector,
                planetaryBodies: landmark.planetaryBodies,
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

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('Usage: npx tsx from-story.ts <source-user-id> <target-user-id> [story-id] [--dry-run] [--replace]')
    console.log('')
    console.log('Arguments:')
    console.log('  source-user-id   User ID (cuid) from story-backend SQLite')
    console.log('  target-user-id   User ID (int) in unified-backend PostgreSQL')
    console.log('  story-id         Optional: Specific story ID to migrate')
    console.log('  --dry-run        Run without making database changes')
    console.log('  --replace        Delete existing stories and re-import (otherwise skips if exists)')
    console.log('')
    console.log('Environment variables:')
    console.log('  SOURCE_DATABASE_URL  SQLite connection string for story-backend')
    console.log('  DATABASE_URL         PostgreSQL connection string for unified-backend')
    process.exit(1)
  }

  const sourceUserId = args[0]
  const targetUserId = Number.parseInt(args[1], 10)
  const storyIdArg = args.find((a) => !a.startsWith('--') && a !== sourceUserId && a !== args[1])
  const dryRun = args.includes('--dry-run')
  const replace = args.includes('--replace')

  if (Number.isNaN(targetUserId)) {
    console.error('Error: target-user-id must be a number')
    process.exit(1)
  }

  const logger = createConsoleLogger()

  // Initialize Prisma clients
  // Note: You'll need to configure these with appropriate connection strings
  const sourcePrisma = new SourcePrisma({
    datasources: {
      db: {
        url: process.env.SOURCE_DATABASE_URL || 'file:../../story-backend/prisma/dev.db',
      },
    },
  })

  const targetPrisma = new TargetPrisma()

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
