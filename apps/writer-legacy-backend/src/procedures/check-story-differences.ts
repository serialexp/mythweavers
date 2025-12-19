import { TRPCError } from '@trpc/server'
import type { Difference, DifferenceResult, EntityType } from '@writer/shared' // Correct import path
import short from 'short-uuid'
import z from 'zod'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

const translator = short()

const checkStoryDifferencesInputSchema = z.object({
  storyId: z.string(),
  clientNodes: z.record(
    z.object({
      modifiedAt: z.number(),
      type: z.enum(['book', 'arc', 'chapter', 'scene']),
    }),
  ),
  clientParagraphs: z.record(z.number()), // Map<paragraphId, modifiedAt>
})

export const checkStoryDifferences = protectedProcedure
  .input(checkStoryDifferencesInputSchema)
  .mutation(async ({ ctx, input }): Promise<DifferenceResult> => {
    const storyUuid = translator.toUUID(input.storyId)

    // Verify story ownership
    const storyOwner = await prisma.story.findUnique({
      where: { id: storyUuid, ownerId: ctx.authenticatedUser.id },
      select: { id: true, updatedAt: true },
    })
    if (!storyOwner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Story not found or you do not have access.',
      })
    }

    // 1. Fetch Server Data (IDs and Timestamps only)
    const serverBooks = await prisma.book.findMany({
      where: { storyId: storyUuid },
      select: { id: true, updatedAt: true },
    })
    const serverArcs = await prisma.arc.findMany({
      where: { book: { storyId: storyUuid } },
      select: { id: true, updatedAt: true },
    })
    const serverChapters = await prisma.chapter.findMany({
      where: { arc: { book: { storyId: storyUuid } } },
      select: { id: true, updatedAt: true },
    })
    const serverScenes = await prisma.scene.findMany({
      where: { chapter: { arc: { book: { storyId: storyUuid } } } },
      select: { id: true, updatedAt: true },
    })
    // Fetch all paragraphs first, then latest revisions
    const allParagraphs = await prisma.paragraph.findMany({
      where: { scene: { chapter: { arc: { book: { storyId: storyUuid } } } } },
      select: { id: true },
    })
    const paragraphIds = allParagraphs.map((p) => p.id)
    const serverLatestRevisions = await prisma.paragraphRevision.findMany({
      where: { paragraphId: { in: paragraphIds } },
      orderBy: { version: 'desc' },
      distinct: ['paragraphId'],
      select: { paragraphId: true, createdAt: true },
    })

    // 2. Create Server Timestamp Maps
    const serverMap: Record<string, { timestamp: number; type: EntityType }> = {}
    for (const b of serverBooks) {
      serverMap[translator.fromUUID(b.id)] = {
        timestamp: b.updatedAt.getTime(),
        type: 'Book',
      }
    }
    for (const a of serverArcs) {
      serverMap[translator.fromUUID(a.id)] = {
        timestamp: a.updatedAt.getTime(),
        type: 'Arc',
      }
    }
    for (const c of serverChapters) {
      serverMap[translator.fromUUID(c.id)] = {
        timestamp: c.updatedAt.getTime(),
        type: 'Chapter',
      }
    }
    for (const s of serverScenes) {
      serverMap[translator.fromUUID(s.id)] = {
        timestamp: s.updatedAt.getTime(),
        type: 'Scene',
      }
    }
    for (const r of serverLatestRevisions) {
      serverMap[translator.fromUUID(r.paragraphId)] = {
        timestamp: r.createdAt.getTime(),
        type: 'Paragraph',
      }
    }

    // 3. Compare and Categorize
    const results: DifferenceResult = {
      lastUpdate: storyOwner.updatedAt.getTime(),
      localNew: [],
      serverNew: [],
      modifiedLocal: [],
      modifiedServer: [],
      inSync: [],
    }
    const processedServerIds = new Set<string>()

    // Compare Nodes (Book, Arc, Chapter, Scene)
    for (const clientId in input.clientNodes) {
      if (Object.hasOwn(input.clientNodes, clientId)) {
        const clientData = input.clientNodes[clientId]
        const clientType = (clientData.type.charAt(0).toUpperCase() + clientData.type.slice(1)) as EntityType // Capitalize type
        const serverData = serverMap[clientId]
        processedServerIds.add(clientId)

        const diff: Difference = {
          id: clientId,
          type: clientType,
          localTimestamp: clientData.modifiedAt,
        }

        if (serverData) {
          diff.serverTimestamp = serverData.timestamp
          if (serverData.type !== clientType) {
            console.warn(`Type mismatch for ID ${clientId}: Client=${clientType}, Server=${serverData.type}`)
            // Handle type mismatch? For now, treat as modified.
            results.modifiedServer.push(diff) // Or some other category?
          } else if (clientData.modifiedAt > serverData.timestamp) {
            results.modifiedLocal.push(diff)
          } else if (serverData.timestamp > clientData.modifiedAt) {
            results.modifiedServer.push(diff)
          } else {
            results.inSync.push(diff)
          }
        } else {
          results.localNew.push(diff)
        }
      }
    }

    // Compare Paragraphs
    for (const clientId in input.clientParagraphs) {
      if (Object.hasOwn(input.clientParagraphs, clientId)) {
        const clientTimestamp = input.clientParagraphs[clientId]
        const serverData = serverMap[clientId]
        processedServerIds.add(clientId)

        const diff: Difference = {
          id: clientId,
          type: 'Paragraph',
          localTimestamp: clientTimestamp,
        }

        if (serverData) {
          diff.serverTimestamp = serverData.timestamp
          if (serverData.type !== 'Paragraph') {
            console.warn(`Type mismatch for ID ${clientId}: Client=Paragraph, Server=${serverData.type}`)
            results.modifiedServer.push(diff) // Or some other category?
          } else if (clientTimestamp > serverData.timestamp) {
            results.modifiedLocal.push(diff)
          } else if (serverData.timestamp > clientTimestamp) {
            results.modifiedServer.push(diff)
          } else {
            results.inSync.push(diff)
          }
        } else {
          results.localNew.push(diff)
        }
      }
    }

    // Find items only on the server
    for (const serverId in serverMap) {
      if (Object.hasOwn(serverMap, serverId)) {
        if (!processedServerIds.has(serverId)) {
          const serverData = serverMap[serverId]
          results.serverNew.push({
            id: serverId,
            type: serverData.type,
            serverTimestamp: serverData.timestamp,
          })
        }
      }
    }

    return results
  })
