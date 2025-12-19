import { TRPCError } from '@trpc/server'
import type {
  Arc,
  Book,
  Chapter,
  ContentNode,
  Node,
  PersistedStory,
  Scene,
  SceneParagraph,
  Story,
} from '@writer/shared'
import short from 'short-uuid'
import z from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

const translator = short()

// Helper function to parse contentSchema or return null
function parseContentSchema(schemaString: string | null): ContentNode | null {
  if (!schemaString) return null
  try {
    return JSON.parse(schemaString)
  } catch (e) {
    console.error('Failed to parse contentSchema JSON:', e)
    return null
  }
}

export const downloadStory = protectedProcedure
  .input(
    z.object({
      storyId: z.string(),
    }),
  )
  .mutation(async ({ ctx, input }): Promise<PersistedStory> => {
    const storyUuid = translator.toUUID(input.storyId)

    // 1. Fetch Core Story Data including nested Arcs, Chapters, Scenes
    const storyData = await prisma.story.findUnique({
      where: {
        id: storyUuid,
        ownerId: ctx.authenticatedUser.id,
      },
      include: {
        books: {
          orderBy: { sortOrder: 'asc' },
          include: {
            arcs: {
              orderBy: { sortOrder: 'asc' },
              include: {
                chapters: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    scenes: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!storyData) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Story not found or you do not have access.',
      })
    }

    // 2. Fetch all Paragraphs and their latest revisions for the story
    const paragraphsWithLatestRevision = await prisma.paragraph.findMany({
      where: {
        scene: {
          chapter: {
            arc: {
              book: {
                storyId: storyUuid,
              },
            },
          },
        },
      },
      include: {
        paragraphRevisions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Create a map for easy lookup: paragraphId -> latestRevision
    const revisionMap = new Map(paragraphsWithLatestRevision.map((p) => [p.id, p.paragraphRevisions[0]]))

    // 3. Map DB Data to Client Schema & Reconstruct Structure
    const storyResponse: Partial<Story> = {
      id: input.storyId,
      name: storyData.name,
      modifiedTime: storyData.updatedAt.getTime(),
      settings: {
        headerImage: storyData.coverArtAsset,
        defaultPerspective: 'third',
      },
      uploadedFiles: {},
      item: {},
      characters: {},
      locations: {},
      plotPoints: {},
      structure: [],
      book: {},
      arc: {},
      chapter: {},
      scene: {},
    }

    const structure: Node[] = []
    const bookMap: Record<string, Book> = {}
    const arcMap: Record<string, Arc> = {}
    const chapterMap: Record<string, Chapter> = {}
    const sceneMap: Record<string, Scene> = {}

    for (const dbBook of storyData.books) {
      const bookId = translator.fromUUID(dbBook.id)
      const bookNode: Node = {
        id: bookId,
        name: dbBook.name,
        type: 'book',
        isOpen: false,
        nodeType: dbBook.nodeType as Node['nodeType'],
        children: [],
      }
      structure.push(bookNode)

      bookMap[bookId] = {
        id: bookId,
        title: dbBook.name,
        modifiedAt: dbBook.updatedAt.getTime(),
        summary: '',
        coverImage: dbBook.coverArtAsset,
      }

      for (const dbArc of dbBook.arcs) {
        const arcId = translator.fromUUID(dbArc.id)
        const arcNode: Node = {
          id: arcId,
          name: dbArc.name,
          type: 'arc',
          isOpen: false,
          nodeType: dbArc.nodeType as Node['nodeType'],
          children: [],
        }
        if (bookNode.children) {
          bookNode.children.push(arcNode)
        }

        arcMap[arcId] = {
          id: arcId,
          title: dbArc.name,
          modifiedAt: dbArc.updatedAt.getTime(),
          summary: '',
        }

        for (const dbChapter of dbArc.chapters) {
          const chapterId = translator.fromUUID(dbChapter.id)
          const chapterNode: Node = {
            id: chapterId,
            name: dbChapter.name,
            type: 'chapter',
            isOpen: false,
            nodeType: dbChapter.nodeType as Node['nodeType'],
            children: [],
          }
          if (arcNode.children) {
            arcNode.children.push(chapterNode)
          }

          chapterMap[chapterId] = {
            id: chapterId,
            title: dbChapter.name,
            modifiedAt: dbChapter.updatedAt.getTime(),
            summary: '',
            visibleFrom: dbChapter.publishedOn?.toISOString(),
            royalRoadId: dbChapter.royalRoadId ?? undefined,
          }

          for (const dbScene of dbChapter.scenes) {
            const sceneId = translator.fromUUID(dbScene.id)
            const sceneNode: Node = {
              id: sceneId,
              name: dbScene.name,
              type: 'scene',
              isOpen: false,
              nodeType: dbScene.nodeType as Node['nodeType'],
            }
            if (chapterNode.children) {
              chapterNode.children.push(sceneNode)
            }

            const sceneParagraphs: SceneParagraph[] = paragraphsWithLatestRevision
              .filter((p) => p.sceneId === dbScene.id)
              .map((p) => {
                const paragraphId = translator.fromUUID(p.id)
                const latestRevision = revisionMap.get(p.id)
                const contentSchema = parseContentSchema(latestRevision?.contentSchema ?? null)
                const text = contentSchema ?? latestRevision?.body ?? ''

                return {
                  id: paragraphId,
                  modifiedAt: latestRevision?.createdAt.getTime() ?? Date.now(),
                  text: text,
                  state: 'draft',
                  comments: [],
                }
              })

            sceneMap[sceneId] = {
              id: sceneId,
              title: dbScene.name,
              modifiedAt: dbScene.updatedAt.getTime(),
              summary: '',
              paragraphs: sceneParagraphs,
              text: dbScene.body,
              plot_point_actions: [],
            }
          }
        }
      }
    }

    storyResponse.structure = structure
    storyResponse.book = bookMap
    storyResponse.arc = arcMap
    storyResponse.chapter = chapterMap
    storyResponse.scene = sceneMap

    const persistedStory: PersistedStory = {
      story: storyResponse as Story,
      language: {
        languages: {},
      },
    }

    return persistedStory
  })
