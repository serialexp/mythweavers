import { createHash } from 'node:crypto'
import archiver from 'archiver'
import type { FastifyPluginAsyncZod } from 'fastify-zod-openapi'
import unzipper from 'unzipper'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { getFileStream, saveBuffer } from '../../lib/file-storage.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

// Export manifest schema
const EXPORT_VERSION = '1.0.0'

const manifestSchema = z.object({
  version: z.string(),
  exportDate: z.string(),
  exportedBy: z.string(),
  storyId: z.string(),
  storyName: z.string(),
  checksum: z.string(),
})

type ExportManifest = z.infer<typeof manifestSchema>

// ID mapping interface for import
interface IdMaps {
  files: Map<string, string>
  characters: Map<string, string>
  contextItems: Map<string, string>
  calendars: Map<string, string>
  books: Map<string, string>
  arcs: Map<string, string>
  chapters: Map<string, string>
  scenes: Map<string, string>
  messages: Map<string, string>
  messageRevisions: Map<string, string>
  paragraphs: Map<string, string>
  paragraphRevisions: Map<string, string>
  maps: Map<string, string>
  landmarks: Map<string, string>
  pawns: Map<string, string>
  paths: Map<string, string>
  mediaAttachments: Map<string, string>
}

// Helper to get file extension from mime type
function getExtFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  return mimeToExt[mimeType] || 'bin'
}

// Helper to remap ID or return null
function remapId<T extends string | null | undefined>(
  id: T,
  map: Map<string, string>,
): T extends null | undefined ? T : string | null {
  if (id === null || id === undefined) return id as any
  return (map.get(id) ?? null) as any
}

// Helper to remap JSON array of IDs
function remapIdArray(
  ids: unknown,
  map: Map<string, string>,
): string[] | null {
  if (!Array.isArray(ids)) return null
  return ids.map((id) => map.get(id) ?? id).filter(Boolean)
}

const exportStoryRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /my/stories/:storyId/export-zip - Export story as ZIP
  fastify.get(
    '/stories/:storyId/export-zip',
    {
      schema: {
        description: 'Export a complete story with all data and files as a ZIP archive',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        params: z.object({
          storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
        }),
        response: {
          200: z.any().meta({ description: 'ZIP file stream' }),
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id
      const { storyId } = request.params

      // Load story with ownership check
      const story = await prisma.story.findFirst({
        where: { id: storyId, ownerId: userId },
        include: {
          coverArtFile: true,
          storyTags: { include: { tag: true } },
        },
      })

      if (!story) {
        return reply.status(404).send({ error: 'Story not found' })
      }

      // Load all related data
      const [
        books,
        characters,
        contextItems,
        calendars,
        maps,
        mediaAttachments,
        plotPointStates,
      ] = await Promise.all([
        // Books with full hierarchy
        prisma.book.findMany({
          where: { storyId, deleted: false },
          orderBy: { sortOrder: 'asc' },
          include: {
            coverArtFile: true,
            spineArtFile: true,
            arcs: {
              where: { deleted: false },
              orderBy: { sortOrder: 'asc' },
              include: {
                chapters: {
                  where: { deleted: false },
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    publishingStatus: true,
                    scenes: {
                      where: { deleted: false },
                      orderBy: { sortOrder: 'asc' },
                      include: {
                        mediaLinks: true,
                        messages: {
                          where: { deleted: false },
                          orderBy: { sortOrder: 'asc' },
                          include: {
                            plotPointStates: true,
                            messageRevisions: {
                              orderBy: { version: 'asc' },
                              include: {
                                paragraphs: {
                                  orderBy: { sortOrder: 'asc' },
                                  include: {
                                    paragraphRevisions: {
                                      orderBy: { version: 'asc' },
                                      include: {
                                        paragraphComments: true,
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        // Characters with inventory
        prisma.character.findMany({
          where: { storyId },
          orderBy: { createdAt: 'asc' },
          include: {
            pictureFile: true,
            inventory: true,
          },
        }),
        // Context items
        prisma.contextItem.findMany({
          where: { storyId },
          orderBy: { createdAt: 'asc' },
        }),
        // Calendars
        prisma.calendar.findMany({
          where: { storyId },
          orderBy: { createdAt: 'asc' },
        }),
        // Maps with all nested data
        prisma.map.findMany({
          where: { storyId },
          orderBy: { createdAt: 'asc' },
          include: {
            landmarks: {
              include: { states: true },
            },
            pawns: {
              include: { movements: true },
            },
            paths: {
              include: { segments: true },
            },
          },
        }),
        // Media attachments with all nested data
        prisma.mediaAttachment.findMany({
          where: { storyId },
          orderBy: { createdAt: 'asc' },
          include: {
            frames: { orderBy: { frameNumber: 'asc' } },
            segments: { orderBy: { segmentIndex: 'asc' } },
            sceneLinks: true,
          },
        }),
        // Story-level plot point states (not nested under messages)
        prisma.plotPointState.findMany({
          where: { storyId },
          orderBy: { createdAt: 'asc' },
        }),
      ])

      // Collect all file references
      const fileIds = new Set<string>()
      if (story.coverArtFileId) fileIds.add(story.coverArtFileId)
      for (const book of books) {
        if (book.coverArtFileId) fileIds.add(book.coverArtFileId)
        if (book.spineArtFileId) fileIds.add(book.spineArtFileId)
      }
      for (const char of characters) {
        if (char.pictureFileId) fileIds.add(char.pictureFileId)
      }

      // Load file metadata
      const files = await prisma.file.findMany({
        where: { id: { in: Array.from(fileIds) } },
      })

      // Build export data structure (strip internal fields)
      const exportData = {
        story: {
          // Core fields
          name: story.name,
          summary: story.summary,
          status: story.status,
          type: story.type,
          published: story.published,
          wordsPerWeek: story.wordsPerWeek,
          spellingLevel: story.spellingLevel,
          chapters: story.chapters,
          firstChapterReleasedAt: story.firstChapterReleasedAt?.toISOString() ?? null,
          lastChapterReleasedAt: story.lastChapterReleasedAt?.toISOString() ?? null,
          coverArtFileId: story.coverArtFileId,
          coverColor: story.coverColor,
          coverTextColor: story.coverTextColor,
          coverFontFamily: story.coverFontFamily,
          defaultPerspective: story.defaultPerspective,
          defaultTense: story.defaultTense,
          genre: story.genre,
          paragraphsPerTurn: story.paragraphsPerTurn,
          format: story.format,
          defaultProtagonistId: story.defaultProtagonistId,
          defaultCalendarId: story.defaultCalendarId,
          sortOrder: story.sortOrder,
          pages: story.pages,
          timelineStartTime: story.timelineStartTime,
          timelineEndTime: story.timelineEndTime,
          timelineGranularity: story.timelineGranularity,
          branchChoices: story.branchChoices,
          selectedNodeId: story.selectedNodeId,
          provider: story.provider,
          model: story.model,
          globalScript: story.globalScript,
          plotPointDefaults: story.plotPointDefaults,
        },
        tags: story.storyTags.map((st) => st.tag.name),
        books: books.map((book) => ({
          id: book.id,
          name: book.name,
          summary: book.summary,
          coverArtFileId: book.coverArtFileId,
          spineArtFileId: book.spineArtFileId,
          pages: book.pages,
          sortOrder: book.sortOrder,
          nodeType: book.nodeType,
          arcs: book.arcs.map((arc) => ({
            id: arc.id,
            name: arc.name,
            summary: arc.summary,
            sortOrder: arc.sortOrder,
            nodeType: arc.nodeType,
            chapters: arc.chapters.map((chapter) => ({
              id: chapter.id,
              name: chapter.name,
              summary: chapter.summary,
              publishedOn: chapter.publishedOn?.toISOString() ?? null,
              sortOrder: chapter.sortOrder,
              nodeType: chapter.nodeType,
              status: chapter.status,
              publishingStatus: chapter.publishingStatus.map((ps) => ({
                platform: ps.platform,
                status: ps.status,
                publishedAt: ps.publishedAt?.toISOString() ?? null,
              })),
              scenes: chapter.scenes.map((scene) => ({
                id: scene.id,
                name: scene.name,
                summary: scene.summary,
                sortOrder: scene.sortOrder,
                status: scene.status,
                includeInFull: scene.includeInFull,
                perspective: scene.perspective,
                viewpointCharacterId: scene.viewpointCharacterId,
                activeCharacterIds: scene.activeCharacterIds,
                activeContextItemIds: scene.activeContextItemIds,
                goal: scene.goal,
                storyTime: scene.storyTime,
                mediaLinks: scene.mediaLinks.map((link) => ({
                  mediaAttachmentId: link.mediaAttachmentId,
                  startTime: link.startTime,
                  endTime: link.endTime,
                  notes: link.notes,
                })),
                messages: scene.messages.map((message) => ({
                  id: message.id,
                  sortOrder: message.sortOrder,
                  instruction: message.instruction,
                  script: message.script,
                  type: message.type,
                  options: message.options,
                  currentMessageRevisionId: message.currentMessageRevisionId,
                  plotPointStates: message.plotPointStates.map((pps) => ({
                    key: pps.key,
                    value: pps.value,
                  })),
                  messageRevisions: message.messageRevisions.map((rev) => ({
                    id: rev.id,
                    version: rev.version,
                    versionType: rev.versionType,
                    model: rev.model,
                    tokensPerSecond: rev.tokensPerSecond,
                    totalTokens: rev.totalTokens,
                    promptTokens: rev.promptTokens,
                    cacheCreationTokens: rev.cacheCreationTokens,
                    cacheReadTokens: rev.cacheReadTokens,
                    think: rev.think,
                    showThink: rev.showThink,
                    paragraphs: rev.paragraphs.map((para) => ({
                      id: para.id,
                      sortOrder: para.sortOrder,
                      currentParagraphRevisionId: para.currentParagraphRevisionId,
                      paragraphRevisions: para.paragraphRevisions.map((pr) => ({
                        id: pr.id,
                        body: pr.body,
                        contentSchema: pr.contentSchema,
                        version: pr.version,
                        state: pr.state,
                        script: pr.script,
                        plotPointActions: pr.plotPointActions,
                        inventoryActions: pr.inventoryActions,
                        paragraphComments: pr.paragraphComments.map((pc) => ({
                          body: pc.body,
                          type: pc.type,
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
        characters: characters.map((char) => ({
          id: char.id,
          pictureFileId: char.pictureFileId,
          firstName: char.firstName,
          middleName: char.middleName,
          lastName: char.lastName,
          nickname: char.nickname,
          description: char.description,
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
          isMainCharacter: char.isMainCharacter,
          laterVersionOfId: char.laterVersionOfId,
          significantActions: char.significantActions,
          birthdate: char.birthdate,
          inventory: char.inventory.map((item) => ({
            name: item.name,
            description: item.description,
            amount: item.amount,
          })),
        })),
        contextItems: contextItems.map((ci) => ({
          id: ci.id,
          type: ci.type,
          name: ci.name,
          description: ci.description,
          isGlobal: ci.isGlobal,
        })),
        calendars: calendars.map((cal) => ({
          id: cal.id,
          name: cal.name,
          config: cal.config,
          isDefault: cal.id === story.defaultCalendarId,
        })),
        maps: maps.map((map) => ({
          id: map.id,
          name: map.name,
          fileId: map.fileId,
          borderColor: map.borderColor,
          propertySchema: map.propertySchema,
          landmarks: map.landmarks.map((lm) => ({
            id: lm.id,
            x: lm.x,
            y: lm.y,
            name: lm.name,
            description: lm.description,
            type: lm.type,
            color: lm.color,
            size: lm.size,
            properties: lm.properties,
            states: lm.states.map((s) => ({
              storyTime: s.storyTime,
              field: s.field,
              value: s.value,
            })),
          })),
          pawns: map.pawns.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            designation: p.designation,
            speed: p.speed,
            defaultX: p.defaultX,
            defaultY: p.defaultY,
            color: p.color,
            size: p.size,
            movements: p.movements.map((m) => ({
              startStoryTime: m.startStoryTime,
              endStoryTime: m.endStoryTime,
              startX: m.startX,
              startY: m.startY,
              endX: m.endX,
              endY: m.endY,
            })),
          })),
          paths: map.paths.map((path) => ({
            id: path.id,
            speedMultiplier: path.speedMultiplier,
            segments: path.segments.map((seg) => ({
              order: seg.order,
              startX: seg.startX,
              startY: seg.startY,
              endX: seg.endX,
              endY: seg.endY,
              startLandmarkId: seg.startLandmarkId,
              endLandmarkId: seg.endLandmarkId,
            })),
          })),
        })),
        mediaAttachments: mediaAttachments.map((ma) => ({
          id: ma.id,
          name: ma.name,
          description: ma.description,
          mediaType: ma.mediaType,
          duration: ma.duration,
          frames: ma.frames.map((f) => ({
            frameNumber: f.frameNumber,
            timestamp: f.timestamp,
            imageUrl: f.imageUrl,
            description: f.description,
          })),
          segments: ma.segments.map((s) => ({
            segmentIndex: s.segmentIndex,
            startTime: s.startTime,
            endTime: s.endTime,
            text: s.text,
            speaker: s.speaker,
            videoUrl: s.videoUrl,
          })),
          sceneLinks: ma.sceneLinks.map((sl) => ({
            sceneId: sl.sceneId,
            startTime: sl.startTime,
            endTime: sl.endTime,
            notes: sl.notes,
          })),
        })),
        plotPointStates: plotPointStates.map((pps) => ({
          messageId: pps.messageId,
          key: pps.key,
          value: pps.value,
        })),
        files: files.map((f) => ({
          id: f.id,
          sha256: f.sha256,
          mimeType: f.mimeType,
          width: f.width,
          height: f.height,
          bytes: f.bytes,
        })),
      }

      // Calculate checksum of story data
      const storyJson = JSON.stringify(exportData)
      const checksum = createHash('sha256').update(storyJson).digest('hex')

      // Create manifest
      const manifest: ExportManifest = {
        version: EXPORT_VERSION,
        exportDate: new Date().toISOString(),
        exportedBy: 'MythWeavers Backend v1.0.0',
        storyId: story.id,
        storyName: story.name,
        checksum,
      }

      // Pre-fetch all file contents into buffers
      const fileBuffers: { id: string; buffer: Buffer; mimeType: string }[] = []
      for (const file of files) {
        try {
          const { stream } = await getFileStream(
            file.localPath,
            file.r2Key,
            file.visibility as 'public' | 'private',
          )
          // Collect stream into buffer
          const chunks: Buffer[] = []
          for await (const chunk of stream as AsyncIterable<Buffer>) {
            chunks.push(chunk)
          }
          fileBuffers.push({
            id: file.id,
            buffer: Buffer.concat(chunks),
            mimeType: file.mimeType,
          })
        } catch (err) {
          fastify.log.warn({ fileId: file.id, error: err }, 'Failed to include file in export')
        }
      }

      // Create ZIP archive and collect into buffer using a promise
      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } })
        const chunks: Buffer[] = []

        archive.on('data', (chunk: Buffer) => chunks.push(chunk))
        archive.on('end', () => resolve(Buffer.concat(chunks)))
        archive.on('error', (err) => {
          fastify.log.error({ error: err }, 'Archive error')
          reject(err)
        })

        // Add manifest and story data
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })
        archive.append(storyJson, { name: 'story.json' })

        // Add pre-fetched file buffers
        for (const { id, buffer, mimeType } of fileBuffers) {
          const ext = getExtFromMimeType(mimeType)
          archive.append(buffer, { name: `files/${id}.${ext}` })
        }

        archive.finalize()
      })

      // Set response headers
      const filename = `story-export-${story.id}.zip`
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(zipBuffer)
    },
  )

  // POST /my/stories/import-zip - Import story from ZIP or JSON
  fastify.post(
    '/stories/import-zip',
    {
      schema: {
        description: 'Import a story from a ZIP archive or JSON file exported by MythWeavers',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        consumes: ['multipart/form-data'],
        response: {
          201: z.object({
            success: z.literal(true),
            storyId: z.string().meta({ description: 'ID of the newly created story' }),
            storyName: z.string().meta({ description: 'Name of the imported story' }),
          }),
          400: errorSchema,
          401: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id

      // Get uploaded file
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      // Read file into buffer
      const chunks: Buffer[] = []
      for await (const chunk of data.file) {
        chunks.push(chunk)
      }
      const fileBuffer = Buffer.concat(chunks)

      let exportData: any
      let directory: Awaited<ReturnType<typeof unzipper.Open.buffer>> | null = null
      let originalStoryId: string | null = null

      // Try to parse as JSON first
      try {
        const jsonData = JSON.parse(fileBuffer.toString('utf-8'))

        // Check if it's a bundle format (with manifest and story)
        if (jsonData.manifest && jsonData.story) {
          // Bundle format from artifact export
          exportData = jsonData.story
          originalStoryId = jsonData.manifest.storyId
          // Skip checksum verification for JSON imports (artifact uses simplified hash)
        } else if (jsonData.story) {
          // Direct story format
          exportData = jsonData
          originalStoryId = null
        } else {
          // Assume it's raw export data
          exportData = jsonData
          originalStoryId = null
        }
      } catch (jsonErr) {
        // Not JSON, try ZIP
        try {
          directory = await unzipper.Open.buffer(fileBuffer)
        } catch (zipErr) {
          return reply.status(400).send({ error: 'Invalid file format: must be JSON or ZIP' })
        }

        // Find manifest and story files
        const manifestFile = directory.files.find((f) => f.path === 'manifest.json')
        const storyFile = directory.files.find((f) => f.path === 'story.json')

        if (!manifestFile || !storyFile) {
          return reply.status(400).send({ error: 'Invalid ZIP: missing manifest.json or story.json' })
        }

        // Parse manifest
        const manifestBuffer = await manifestFile.buffer()
        let manifest: ExportManifest
        try {
          manifest = manifestSchema.parse(JSON.parse(manifestBuffer.toString('utf-8')))
        } catch (err) {
          return reply.status(400).send({ error: 'Invalid manifest format' })
        }

        // Check version compatibility
        if (manifest.version !== EXPORT_VERSION) {
          return reply.status(400).send({
            error: `Incompatible export version: ${manifest.version} (expected ${EXPORT_VERSION})`,
          })
        }

        // Parse story data
        const storyBuffer = await storyFile.buffer()
        const storyJson = storyBuffer.toString('utf-8')

        // Verify checksum
        const actualChecksum = createHash('sha256').update(storyJson).digest('hex')
        if (actualChecksum !== manifest.checksum) {
          return reply.status(400).send({ error: 'Checksum mismatch: data may be corrupted' })
        }

        exportData = JSON.parse(storyJson)
        originalStoryId = manifest.storyId
      }

      // Initialize ID maps
      const idMaps: IdMaps = {
        files: new Map(),
        characters: new Map(),
        contextItems: new Map(),
        calendars: new Map(),
        books: new Map(),
        arcs: new Map(),
        chapters: new Map(),
        scenes: new Map(),
        messages: new Map(),
        messageRevisions: new Map(),
        paragraphs: new Map(),
        paragraphRevisions: new Map(),
        maps: new Map(),
        landmarks: new Map(),
        pawns: new Map(),
        paths: new Map(),
        mediaAttachments: new Map(),
      }

      // Import in transaction
      const newStory = await prisma.$transaction(async (tx) => {
        // 1. Import files first (only from ZIP, skip for JSON imports)
        if (directory) {
          for (const fileData of exportData.files || []) {
            const zipFile = directory.files.find(
              (f) => f.path.startsWith('files/') && f.path.includes(fileData.id),
            )
            if (zipFile) {
              const fileBuffer = await zipFile.buffer()
              const ext = getExtFromMimeType(fileData.mimeType)
              const filename = `imported-${fileData.id}.${ext}`

              const metadata = await saveBuffer(
                fileBuffer,
                filename,
                fileData.mimeType,
                userId,
                'private',
              )

              const newFile = await tx.file.create({
                data: {
                  ownerId: userId,
                  localPath: metadata.localPath,
                  r2Key: metadata.r2Key,
                  visibility: metadata.visibility,
                  path: metadata.path,
                  sha256: metadata.sha256,
                  mimeType: metadata.mimeType,
                  width: metadata.width,
                  height: metadata.height,
                  bytes: metadata.bytes,
                },
              })
              idMaps.files.set(fileData.id, newFile.id)
            }
          }
        }

        // 2. Create story (with null for FK fields that need later fixup)
        const storyData = exportData.story
        const story = await tx.story.create({
          data: {
            name: storyData.name,
            summary: storyData.summary,
            ownerId: userId,
            status: storyData.status,
            type: storyData.type,
            published: false, // Always start unpublished
            wordsPerWeek: storyData.wordsPerWeek,
            spellingLevel: storyData.spellingLevel,
            chapters: storyData.chapters,
            coverArtFileId: remapId(storyData.coverArtFileId, idMaps.files),
            coverColor: storyData.coverColor,
            coverTextColor: storyData.coverTextColor,
            coverFontFamily: storyData.coverFontFamily,
            defaultPerspective: storyData.defaultPerspective,
            defaultTense: storyData.defaultTense,
            genre: storyData.genre,
            paragraphsPerTurn: storyData.paragraphsPerTurn,
            format: storyData.format,
            sortOrder: storyData.sortOrder,
            pages: storyData.pages,
            timelineStartTime: storyData.timelineStartTime,
            timelineEndTime: storyData.timelineEndTime,
            timelineGranularity: storyData.timelineGranularity,
            branchChoices: storyData.branchChoices,
            selectedNodeId: null, // Will be remapped later
            provider: storyData.provider,
            model: storyData.model,
            globalScript: storyData.globalScript,
            plotPointDefaults: storyData.plotPointDefaults,
            // These will be set after creating related entities
            defaultProtagonistId: null,
            defaultCalendarId: null,
          },
        })

        // Update files with storyId
        for (const [, newFileId] of idMaps.files) {
          await tx.file.update({
            where: { id: newFileId },
            data: { storyId: story.id },
          })
        }

        // 3. Create characters (first pass - without laterVersionOfId)
        for (const charData of exportData.characters || []) {
          const newChar = await tx.character.create({
            data: {
              storyId: story.id,
              pictureFileId: remapId(charData.pictureFileId, idMaps.files),
              firstName: charData.firstName,
              middleName: charData.middleName,
              lastName: charData.lastName,
              nickname: charData.nickname,
              description: charData.description,
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
              significantActions: charData.significantActions,
              birthdate: charData.birthdate,
              // laterVersionOfId will be set in second pass
            },
          })
          idMaps.characters.set(charData.id, newChar.id)

          // Create inventory items
          for (const item of charData.inventory || []) {
            await tx.item.create({
              data: {
                characterId: newChar.id,
                name: item.name,
                description: item.description,
                amount: item.amount,
              },
            })
          }
        }

        // Fixup character laterVersionOfId
        for (const charData of exportData.characters || []) {
          if (charData.laterVersionOfId) {
            const newId = idMaps.characters.get(charData.id)
            const newLaterVersionOfId = idMaps.characters.get(charData.laterVersionOfId)
            if (newId && newLaterVersionOfId) {
              await tx.character.update({
                where: { id: newId },
                data: { laterVersionOfId: newLaterVersionOfId },
              })
            }
          }
        }

        // 4. Create context items
        for (const ciData of exportData.contextItems || []) {
          const newCi = await tx.contextItem.create({
            data: {
              storyId: story.id,
              type: ciData.type,
              name: ciData.name,
              description: ciData.description,
              isGlobal: ciData.isGlobal,
            },
          })
          idMaps.contextItems.set(ciData.id, newCi.id)
        }

        // 5. Create calendars
        let defaultCalendarId: string | null = null
        for (const calData of exportData.calendars || []) {
          const newCal = await tx.calendar.create({
            data: {
              storyId: story.id,
              name: calData.name,
              config: calData.config,
            },
          })
          idMaps.calendars.set(calData.id, newCal.id)
          if (calData.isDefault) {
            defaultCalendarId = newCal.id
          }
        }

        // 6. Update story with defaultProtagonistId and defaultCalendarId
        const newProtagonistId = remapId(storyData.defaultProtagonistId, idMaps.characters)
        await tx.story.update({
          where: { id: story.id },
          data: {
            defaultProtagonistId: newProtagonistId,
            defaultCalendarId,
          },
        })

        // 7. Create books and nested hierarchy
        for (const bookData of exportData.books || []) {
          const newBook = await tx.book.create({
            data: {
              storyId: story.id,
              name: bookData.name,
              summary: bookData.summary,
              coverArtFileId: remapId(bookData.coverArtFileId, idMaps.files),
              spineArtFileId: remapId(bookData.spineArtFileId, idMaps.files),
              pages: bookData.pages,
              sortOrder: bookData.sortOrder,
              nodeType: bookData.nodeType,
            },
          })
          idMaps.books.set(bookData.id, newBook.id)

          for (const arcData of bookData.arcs || []) {
            const newArc = await tx.arc.create({
              data: {
                bookId: newBook.id,
                name: arcData.name,
                summary: arcData.summary,
                sortOrder: arcData.sortOrder,
                nodeType: arcData.nodeType,
              },
            })
            idMaps.arcs.set(arcData.id, newArc.id)

            for (const chapterData of arcData.chapters || []) {
              const newChapter = await tx.chapter.create({
                data: {
                  arcId: newArc.id,
                  name: chapterData.name,
                  summary: chapterData.summary,
                  publishedOn: chapterData.publishedOn
                    ? new Date(chapterData.publishedOn)
                    : null,
                  sortOrder: chapterData.sortOrder,
                  nodeType: chapterData.nodeType,
                  status: chapterData.status,
                  // Don't copy royalRoadId - would cause conflicts
                },
              })
              idMaps.chapters.set(chapterData.id, newChapter.id)

              // Create publishing status as DRAFT (don't copy platform IDs)
              for (const ps of chapterData.publishingStatus || []) {
                await tx.chapterPublishing.create({
                  data: {
                    chapterId: newChapter.id,
                    platform: ps.platform,
                    status: 'DRAFT', // Reset to draft
                  },
                })
              }

              for (const sceneData of chapterData.scenes || []) {
                const newScene = await tx.scene.create({
                  data: {
                    chapterId: newChapter.id,
                    name: sceneData.name,
                    summary: sceneData.summary,
                    sortOrder: sceneData.sortOrder,
                    status: sceneData.status,
                    includeInFull: sceneData.includeInFull,
                    perspective: sceneData.perspective,
                    viewpointCharacterId: remapId(
                      sceneData.viewpointCharacterId,
                      idMaps.characters,
                    ),
                    activeCharacterIds: remapIdArray(
                      sceneData.activeCharacterIds,
                      idMaps.characters,
                    ),
                    activeContextItemIds: remapIdArray(
                      sceneData.activeContextItemIds,
                      idMaps.contextItems,
                    ),
                    goal: sceneData.goal,
                    storyTime: sceneData.storyTime,
                  },
                })
                idMaps.scenes.set(sceneData.id, newScene.id)

                for (const messageData of sceneData.messages || []) {
                  // Create message without currentMessageRevisionId first
                  const newMessage = await tx.message.create({
                    data: {
                      sceneId: newScene.id,
                      sortOrder: messageData.sortOrder,
                      instruction: messageData.instruction,
                      script: messageData.script,
                      type: messageData.type,
                      options: messageData.options,
                    },
                  })
                  idMaps.messages.set(messageData.id, newMessage.id)

                  // Create plot point states for this message
                  for (const pps of messageData.plotPointStates || []) {
                    await tx.plotPointState.create({
                      data: {
                        storyId: story.id,
                        messageId: newMessage.id,
                        key: pps.key,
                        value: pps.value,
                      },
                    })
                  }

                  let currentRevisionId: string | null = null
                  for (const revData of messageData.messageRevisions || []) {
                    const newRev = await tx.messageRevision.create({
                      data: {
                        messageId: newMessage.id,
                        version: revData.version,
                        versionType: revData.versionType,
                        model: revData.model,
                        tokensPerSecond: revData.tokensPerSecond,
                        totalTokens: revData.totalTokens,
                        promptTokens: revData.promptTokens,
                        cacheCreationTokens: revData.cacheCreationTokens,
                        cacheReadTokens: revData.cacheReadTokens,
                        think: revData.think,
                        showThink: revData.showThink,
                      },
                    })
                    idMaps.messageRevisions.set(revData.id, newRev.id)

                    if (revData.id === messageData.currentMessageRevisionId) {
                      currentRevisionId = newRev.id
                    }

                    for (const paraData of revData.paragraphs || []) {
                      // Create paragraph without currentParagraphRevisionId first
                      const newPara = await tx.paragraph.create({
                        data: {
                          messageRevisionId: newRev.id,
                          sortOrder: paraData.sortOrder,
                        },
                      })
                      idMaps.paragraphs.set(paraData.id, newPara.id)

                      let currentParaRevId: string | null = null
                      for (const prData of paraData.paragraphRevisions || []) {
                        const newPr = await tx.paragraphRevision.create({
                          data: {
                            paragraphId: newPara.id,
                            body: prData.body,
                            contentSchema: prData.contentSchema,
                            version: prData.version,
                            state: prData.state,
                            script: prData.script,
                            plotPointActions: prData.plotPointActions,
                            inventoryActions: prData.inventoryActions,
                          },
                        })
                        idMaps.paragraphRevisions.set(prData.id, newPr.id)

                        if (prData.id === paraData.currentParagraphRevisionId) {
                          currentParaRevId = newPr.id
                        }

                        // Create paragraph comments (without owner - they become anonymous)
                        for (const pc of prData.paragraphComments || []) {
                          await tx.paragraphComment.create({
                            data: {
                              paragraphRevisionId: newPr.id,
                              ownerId: userId, // Assign to importing user
                              body: pc.body,
                              type: pc.type,
                            },
                          })
                        }
                      }

                      // Update paragraph with currentParagraphRevisionId
                      if (currentParaRevId) {
                        await tx.paragraph.update({
                          where: { id: newPara.id },
                          data: { currentParagraphRevisionId: currentParaRevId },
                        })
                      }
                    }
                  }

                  // Update message with currentMessageRevisionId
                  if (currentRevisionId) {
                    await tx.message.update({
                      where: { id: newMessage.id },
                      data: { currentMessageRevisionId: currentRevisionId },
                    })
                  }
                }
              }
            }
          }
        }

        // 8. Create maps and nested entities
        for (const mapData of exportData.maps || []) {
          const newMap = await tx.map.create({
            data: {
              storyId: story.id,
              name: mapData.name,
              fileId: mapData.fileId, // Map fileId is external URL, not internal file
              borderColor: mapData.borderColor,
              propertySchema: mapData.propertySchema,
            },
          })
          idMaps.maps.set(mapData.id, newMap.id)

          // Create landmarks
          for (const lmData of mapData.landmarks || []) {
            const newLm = await tx.landmark.create({
              data: {
                mapId: newMap.id,
                x: lmData.x,
                y: lmData.y,
                name: lmData.name,
                description: lmData.description,
                type: lmData.type,
                color: lmData.color,
                size: lmData.size,
                properties: lmData.properties,
              },
            })
            idMaps.landmarks.set(lmData.id, newLm.id)

            // Create landmark states
            for (const state of lmData.states || []) {
              await tx.landmarkState.create({
                data: {
                  storyId: story.id,
                  mapId: newMap.id,
                  landmarkId: newLm.id,
                  storyTime: state.storyTime,
                  field: state.field,
                  value: state.value,
                },
              })
            }
          }

          // Create pawns
          for (const pawnData of mapData.pawns || []) {
            const newPawn = await tx.pawn.create({
              data: {
                mapId: newMap.id,
                name: pawnData.name,
                description: pawnData.description,
                designation: pawnData.designation,
                speed: pawnData.speed,
                defaultX: pawnData.defaultX,
                defaultY: pawnData.defaultY,
                color: pawnData.color,
                size: pawnData.size,
              },
            })
            idMaps.pawns.set(pawnData.id, newPawn.id)

            // Create pawn movements
            for (const movement of pawnData.movements || []) {
              await tx.pawnMovement.create({
                data: {
                  storyId: story.id,
                  mapId: newMap.id,
                  pawnId: newPawn.id,
                  startStoryTime: movement.startStoryTime,
                  endStoryTime: movement.endStoryTime,
                  startX: movement.startX,
                  startY: movement.startY,
                  endX: movement.endX,
                  endY: movement.endY,
                },
              })
            }
          }

          // Create paths
          for (const pathData of mapData.paths || []) {
            const newPath = await tx.path.create({
              data: {
                mapId: newMap.id,
                speedMultiplier: pathData.speedMultiplier,
              },
            })
            idMaps.paths.set(pathData.id, newPath.id)

            // Create path segments
            for (const seg of pathData.segments || []) {
              await tx.pathSegment.create({
                data: {
                  pathId: newPath.id,
                  mapId: newMap.id,
                  order: seg.order,
                  startX: seg.startX,
                  startY: seg.startY,
                  endX: seg.endX,
                  endY: seg.endY,
                  startLandmarkId: remapId(seg.startLandmarkId, idMaps.landmarks),
                  endLandmarkId: remapId(seg.endLandmarkId, idMaps.landmarks),
                },
              })
            }
          }
        }

        // 9. Create media attachments
        for (const maData of exportData.mediaAttachments || []) {
          const newMa = await tx.mediaAttachment.create({
            data: {
              storyId: story.id,
              name: maData.name,
              description: maData.description,
              mediaType: maData.mediaType,
              duration: maData.duration,
            },
          })
          idMaps.mediaAttachments.set(maData.id, newMa.id)

          // Create frames
          for (const frame of maData.frames || []) {
            await tx.mediaFrame.create({
              data: {
                mediaAttachmentId: newMa.id,
                frameNumber: frame.frameNumber,
                timestamp: frame.timestamp,
                imageUrl: frame.imageUrl,
                description: frame.description,
              },
            })
          }

          // Create segments
          for (const seg of maData.segments || []) {
            await tx.mediaSegment.create({
              data: {
                mediaAttachmentId: newMa.id,
                segmentIndex: seg.segmentIndex,
                startTime: seg.startTime,
                endTime: seg.endTime,
                text: seg.text,
                speaker: seg.speaker,
                videoUrl: seg.videoUrl,
              },
            })
          }

          // Create scene links
          for (const link of maData.sceneLinks || []) {
            const newSceneId = idMaps.scenes.get(link.sceneId)
            if (newSceneId) {
              await tx.mediaSceneLink.create({
                data: {
                  mediaAttachmentId: newMa.id,
                  sceneId: newSceneId,
                  startTime: link.startTime,
                  endTime: link.endTime,
                  notes: link.notes,
                },
              })
            }
          }
        }

        // 10. Create tags (find or create)
        for (const tagName of exportData.tags || []) {
          let tag = await tx.tag.findUnique({ where: { name: tagName } })
          if (!tag) {
            tag = await tx.tag.create({ data: { name: tagName } })
          }
          await tx.storyTag.create({
            data: {
              storyId: story.id,
              tagId: tag.id,
            },
          })
        }

        // 11. Update story selectedNodeId if it was set
        if (storyData.selectedNodeId) {
          const newSelectedNodeId = idMaps.scenes.get(storyData.selectedNodeId)
          if (newSelectedNodeId) {
            await tx.story.update({
              where: { id: story.id },
              data: { selectedNodeId: newSelectedNodeId },
            })
          }
        }

        return story
      })

      fastify.log.info(
        { storyId: newStory.id, originalStoryId },
        'Story imported successfully',
      )

      return reply.status(201).send({
        success: true as const,
        storyId: newStory.id,
        storyName: newStory.name,
      })
    },
  )

  // Apply authentication to all routes in this plugin
  fastify.addHook('preHandler', requireAuth)
}

export default exportStoryRoutes
