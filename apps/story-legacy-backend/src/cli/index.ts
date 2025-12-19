#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  CORUSCANT_CALENDAR,
  CalendarEngine,
  type PathfindingHyperlane,
  type PathfindingLandmark,
  calculateOptimalPath,
  formatTravelTime,
} from '@mythweavers/shared'
import { Command } from 'commander'
import dotenv from 'dotenv'
import { prisma } from '../lib/prisma'
import { getStoryDefaultCalendar } from '../services/calendarService'
import { rebuildParagraphEmbeddings, searchParagraphEmbeddings } from '../services/paragraphEmbeddingService'
import {
  createMessage,
  createNode,
  deleteMessage,
  deleteNode,
  getCharacter,
  getCharacters,
  getCharactersAtPoint,
  getMessages,
  getNodes,
  listStories,
  replaceInMessage,
  searchMessages,
  updateMessage,
  updateNode,
} from '../story/storyOperations'

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true })
dotenv.config({
  path: path.resolve(process.cwd(), 'backend/.env'),
  quiet: true,
})

const program = new Command()
program.name('story-cli').description('CLI for interacting with the story backend data')

function printJSON(data: unknown) {
  if (data === undefined) {
    return
  }
  console.log(JSON.stringify(data, null, 2))
}

function printMarkdownTable(data: unknown) {
  if (data === undefined) {
    return
  }
  console.table(data)
}

function parseOptionalInt(value: string | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`${field} must be a number`)
  }
  return parsed
}

type CliStoryNode = Awaited<ReturnType<typeof getNodes>>[number]

function printNodeTree(nodes: CliStoryNode[]) {
  if (nodes.length === 0) {
    console.log('No nodes found.')
    return
  }

  const childrenByParent = new Map<string | null, CliStoryNode[]>()
  for (const node of nodes) {
    const parentId = node.parentId ?? null
    const siblings = childrenByParent.get(parentId)
    if (siblings === undefined) {
      childrenByParent.set(parentId, [node])
    } else {
      siblings.push(node)
    }
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.order - b.order)
  }

  const printSubtree = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId)
    if (!children) {
      return
    }

    for (const child of children) {
      const title = child.title?.trim() || '(untitled)'
      const indent = '  '.repeat(depth)
      const typeLabel = child.type.charAt(0).toUpperCase() + child.type.slice(1).toLowerCase()
      console.log(`${indent}- [${typeLabel}] ${title} (${child.id})`)
      printSubtree(child.id, depth + 1)
    }
  }

  printSubtree(null, 0)
}

type CliMessage = Awaited<ReturnType<typeof getMessages>>[number]

type MessageTreeEntry = {
  node: CliStoryNode
  messages: CliMessage[]
}

function expandNodeIds(nodeIds: string[], allNodes: CliStoryNode[]): string[] {
  const nodesById = new Map<string, CliStoryNode>(allNodes.map((node) => [node.id, node]))
  const childrenByParent = new Map<string | null, CliStoryNode[]>(
    allNodes.reduce((acc, node) => {
      const parentId = node.parentId ?? null
      let bucket = acc.get(parentId)
      if (!bucket) {
        bucket = []
        acc.set(parentId, bucket)
      }
      bucket.push(node)
      return acc
    }, new Map<string | null, CliStoryNode[]>()),
  )

  const result = new Set<string>()

  for (const nodeId of nodeIds) {
    const node = nodesById.get(nodeId)
    if (!node) {
      throw new Error(`Node with ID ${nodeId} not found`)
    }

    if (node.type === 'chapter') {
      result.add(nodeId)
      continue
    }

    const chapters: string[] = []
    const queue: string[] = [nodeId]

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        continue
      }

      const currentNode = nodesById.get(current)
      if (!currentNode) {
        continue
      }

      const children = childrenByParent.get(current) ?? []

      for (const child of children) {
        if (child.type === 'chapter') {
          chapters.push(child.id)
        } else {
          queue.push(child.id)
        }
      }
    }

    if (chapters.length === 0) {
      console.warn(`Warning: node ${nodeId} does not have any descendant chapters.`)
    }

    for (const chapterId of chapters) {
      result.add(chapterId)
    }
  }

  return Array.from(result)
}

async function fetchMapTravelData(
  storyId: string,
  mapId: string,
): Promise<{
  landmarks: PathfindingLandmark[]
  hyperlanes: PathfindingHyperlane[]
}> {
  const map = await prisma.map.findFirst({
    where: { id: mapId, storyId },
    select: { id: true },
  })

  if (!map) {
    throw new Error(`Map ${mapId} not found for story ${storyId}`)
  }

  const [landmarks, hyperlanes] = await Promise.all([
    prisma.landmark.findMany({
      where: { mapId, map: { storyId } },
      select: {
        id: true,
        mapId: true,
        x: true,
        y: true,
        name: true,
        description: true,
        type: true,
        population: true,
        industry: true,
        planetaryBodies: true,
        region: true,
        sector: true,
        color: true,
        size: true,
      },
    }),
    prisma.hyperlane.findMany({
      where: { mapId, map: { storyId } },
      select: {
        id: true,
        mapId: true,
        speedMultiplier: true,
        segments: {
          select: {
            id: true,
            hyperlaneId: true,
            mapId: true,
            order: true,
            startX: true,
            startY: true,
            endX: true,
            endY: true,
            startLandmarkId: true,
            endLandmarkId: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    }),
  ])

  const landmarkData: PathfindingLandmark[] = landmarks.map((landmark) => ({
    id: landmark.id,
    mapId: landmark.mapId,
    x: landmark.x,
    y: landmark.y,
    name: landmark.name,
    description: landmark.description ?? undefined,
    type: landmark.type ?? 'system',
    population: landmark.population ?? undefined,
    industry: landmark.industry ?? undefined,
    planetaryBodies: landmark.planetaryBodies ?? undefined,
    region: landmark.region ?? undefined,
    sector: landmark.sector ?? undefined,
    color: landmark.color ?? undefined,
    size: landmark.size ?? undefined,
  }))

  const hyperlaneData: PathfindingHyperlane[] = hyperlanes.map((hyperlane) => ({
    id: hyperlane.id,
    mapId: hyperlane.mapId,
    speedMultiplier: hyperlane.speedMultiplier,
    segments: hyperlane.segments.map((segment) => ({
      ...segment,
      startLandmarkId: segment.startLandmarkId ?? undefined,
      endLandmarkId: segment.endLandmarkId ?? undefined,
    })),
  }))

  return { landmarks: landmarkData, hyperlanes: hyperlaneData }
}

/**
 * Format a story time using a calendar engine
 * @param storyTime - Story time in minutes from epoch
 * @param calendar - Calendar engine to use (defaults to Coruscant)
 * @returns Formatted date string
 */
function formatStoryTimeWithCalendar(
  storyTime: number,
  calendar: CalendarEngine = new CalendarEngine(CORUSCANT_CALENDAR),
): string {
  const date = calendar.storyTimeToDate(storyTime)
  return calendar.formatDate(date)
}

/**
 * Format a story time label for a story
 * Uses the story's default calendar if available
 * @param storyTime - Story time in minutes from epoch
 * @param storyId - Story ID (optional, uses Coruscant if not provided)
 * @returns Formatted date string or undefined
 */
async function formatStoryTimeLabel(
  storyTime: number | null | undefined,
  storyId?: string,
): Promise<string | undefined> {
  if (storyTime === undefined || storyTime === null) {
    return undefined
  }

  let calendar: CalendarEngine | null = null

  if (storyId) {
    calendar = await getStoryDefaultCalendar(storyId)
  }

  // Fall back to Coruscant calendar if no story calendar found
  if (!calendar) {
    calendar = new CalendarEngine(CORUSCANT_CALENDAR)
  }

  return formatStoryTimeWithCalendar(storyTime, calendar)
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return ''
  }
  return new Promise<string>((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

function withAction(handler: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await handler(...args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Error: ${message}`)
      process.exitCode = 1
    }
  }
}

program
  .command('stories:list')
  .description('List stories')
  .option('--include-deleted', 'Include soft-deleted stories')
  .action(
    withAction(async (options: { includeDeleted?: boolean }) => {
      const stories = await listStories({
        includeDeleted: Boolean(options.includeDeleted),
      })
      printMarkdownTable(
        stories.map((story) => ({
          id: story.id,
          name: story.name,
        })),
      )
    }),
  )

program
  .command('nodes:list')
  .description('List nodes for a story')
  .argument('<storyId>', 'Story ID')
  .option('--with-word-counts', 'Include word counts for chapter nodes')
  .action(
    withAction(async (storyId: string, options: { withWordCounts?: boolean }) => {
      const nodes = await getNodes(storyId, {
        includeWordCounts: Boolean(options.withWordCounts),
      })
      printNodeTree(nodes)
    }),
  )

program
  .command('nodes:create')
  .description('Create a node (book, arc, or chapter)')
  .argument('<storyId>', 'Story ID')
  .argument('<type>', 'Node type (book|arc|chapter)')
  .argument('<title>', 'Node title')
  .option('--parent <nodeId>', 'Parent node ID (required for arcs and chapters)')
  .option('--order <index>', 'Insertion order within the parent')
  .action(
    withAction(async (storyId: string, type: string, title: string, options: { parent?: string; order?: string }) => {
      const normalizedType = type.toLowerCase()
      if (!['book', 'arc', 'chapter'].includes(normalizedType)) {
        throw new Error('Node type must be one of book, arc, or chapter')
      }
      if (normalizedType !== 'book' && !options.parent) {
        throw new Error('Parent node ID is required for arc and chapter nodes')
      }
      const node = await createNode({
        storyId,
        type: normalizedType as 'book' | 'arc' | 'chapter',
        title,
        parentId: options.parent ?? null,
        order: parseOptionalInt(options.order, 'order'),
      })
      printJSON(node)
    }),
  )

program
  .command('nodes:update')
  .description('Update a node')
  .argument('<storyId>', 'Story ID')
  .argument('<nodeId>', 'Node ID')
  .option('--title <title>', 'New title')
  .option('--summary <summary>', 'New summary')
  .option('--include-in-full <0|1|2>', '0=skip, 1=summary, 2=full content')
  .option('--status <status>', 'Chapter status')
  .option('--order <index>', 'Order within parent')
  .option('--parent <nodeId>', 'New parent node ID')
  .option('--expanded <bool>', 'Set expanded flag (true|false)')
  .option('--story-time <minutes>', 'Story timeline minute marker')
  .option('--active-characters <ids...>', 'Character IDs active in this node')
  .option('--active-context <ids...>', 'Context item IDs active in this node')
  .option('--viewpoint <characterId>', 'Viewpoint character ID')
  .action(
    withAction(
      async (
        storyId: string,
        nodeId: string,
        options: {
          title?: string
          summary?: string
          includeInFull?: string
          status?: string
          order?: string
          parent?: string
          expanded?: string
          storyTime?: string
          activeCharacters?: string[]
          activeContext?: string[]
          viewpoint?: string
        },
      ) => {
        const payload: Record<string, unknown> = {
          storyId,
          nodeId,
        }

        if (options.title !== undefined) payload.title = options.title
        if (options.summary !== undefined) payload.summary = options.summary
        if (options.includeInFull !== undefined) {
          const includeValue = parseOptionalInt(options.includeInFull, 'includeInFull')
          if (includeValue !== undefined && ![0, 1, 2].includes(includeValue)) {
            throw new Error('include-in-full must be 0, 1, or 2')
          }
          payload.includeInFull = includeValue
        }
        if (options.status !== undefined) payload.status = options.status
        if (options.order !== undefined) payload.order = parseOptionalInt(options.order, 'order')
        if (options.parent !== undefined) payload.parentId = options.parent
        if (options.expanded !== undefined) payload.expanded = options.expanded === 'true'
        if (options.storyTime !== undefined) payload.storyTime = parseOptionalInt(options.storyTime, 'storyTime')
        if (options.activeCharacters !== undefined) payload.activeCharacterIds = options.activeCharacters
        if (options.activeContext !== undefined) payload.activeContextItemIds = options.activeContext
        if (options.viewpoint !== undefined) payload.viewpointCharacterId = options.viewpoint

        await updateNode(payload as any)
        console.log('OK')
      },
    ),
  )

program
  .command('nodes:delete')
  .description('Delete a node and its descendants')
  .argument('<storyId>', 'Story ID')
  .argument('<nodeId>', 'Node ID')
  .action(
    withAction(async (storyId: string, nodeId: string) => {
      const result = await deleteNode(storyId, nodeId)
      printJSON(result)
    }),
  )

program
  .command('maps:travel-time')
  .description('Calculate travel time between two landmarks on a map')
  .argument('<storyId>', 'Story ID')
  .argument('<mapId>', 'Map ID')
  .argument('<fromLandmarkId>', 'Start landmark ID')
  .argument('<toLandmarkId>', 'Destination landmark ID')
  .option('--hyperdrive <rating>', 'Hyperdrive rating (default: 1)')
  .action(
    withAction(
      async (
        storyId: string,
        mapId: string,
        fromLandmarkId: string,
        toLandmarkId: string,
        options: { hyperdrive?: string },
      ) => {
        const rating = options.hyperdrive ? Number.parseFloat(options.hyperdrive) : 1

        if (!Number.isFinite(rating) || rating <= 0) {
          throw new Error('hyperdrive rating must be a positive number')
        }

        const { landmarks, hyperlanes } = await fetchMapTravelData(storyId, mapId)

        const landmarkById = new Map(landmarks.map((landmark) => [landmark.id, landmark]))

        const formatLandmarkChoice = (landmark: PathfindingLandmark): string => {
          const displayName = landmark.name ? `"${landmark.name}"` : 'Unnamed landmark'
          return `${displayName} [${landmark.id}]`
        }

        const resolveLandmark = (input: string, label: 'from' | 'to'): PathfindingLandmark => {
          const raw = input.trim()
          if (!raw) {
            throw new Error(`The ${label} landmark argument cannot be empty.`)
          }

          const byId = landmarkById.get(raw)
          if (byId) {
            return byId
          }

          const exactMatches = landmarks.filter(
            (landmark) => landmark.name !== undefined && landmark.name.toLowerCase() === raw.toLowerCase(),
          )

          if (exactMatches.length === 1) {
            return exactMatches[0]
          }

          if (exactMatches.length > 1) {
            const details = exactMatches
              .slice(0, 5)
              .map((landmark) => formatLandmarkChoice(landmark))
              .join('; ')
            const suffix = exactMatches.length > 5 ? `; and ${exactMatches.length - 5} more` : ''
            throw new Error(
              `Multiple landmarks share the name "${raw}" on map ${mapId}. Please use a more specific pattern or ID. Matches: ${details}${suffix}`,
            )
          }

          let regex: RegExp
          try {
            regex = new RegExp(raw, 'i')
          } catch (error) {
            throw new Error(`Invalid ${label} landmark pattern "${raw}": ${String(error)}`)
          }

          const regexMatches = landmarks.filter((landmark) => {
            const haystacks = [
              landmark.name ?? '',
              landmark.description ?? '',
              landmark.region ?? '',
              landmark.sector ?? '',
            ]
            return haystacks.some((value) => regex.test(value))
          })

          if (regexMatches.length === 0) {
            throw new Error(
              `No landmark matched the ${label} input "${raw}" on map ${mapId}. Use maps:landmarks to inspect available landmarks.`,
            )
          }

          if (regexMatches.length > 1) {
            const details = regexMatches
              .slice(0, 5)
              .map((landmark) => formatLandmarkChoice(landmark))
              .join('; ')
            const suffix = regexMatches.length > 5 ? `; and ${regexMatches.length - 5} more` : ''
            throw new Error(
              `Multiple landmarks matched the ${label} pattern "${raw}" on map ${mapId}. Please refine your input or use an ID. Matches: ${details}${suffix}`,
            )
          }

          return regexMatches[0]
        }

        const start = resolveLandmark(fromLandmarkId, 'from')
        const end = resolveLandmark(toLandmarkId, 'to')

        const result = calculateOptimalPath(start.x, start.y, end.x, end.y, landmarks, hyperlanes, rating)

        const findLabel = (landmarkId: string | null | undefined, x: number, y: number): string | undefined => {
          if (landmarkId) {
            const landmark = landmarkById.get(landmarkId)
            if (landmark?.name) {
              return landmark.name
            }
          }

          let nearestName: string | undefined
          let nearestDistance = Number.POSITIVE_INFINITY
          for (const landmark of landmarks) {
            const dx = landmark.x - x
            const dy = landmark.y - y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance < nearestDistance) {
              nearestDistance = distance
              nearestName = landmark.name
            }
          }

          return nearestDistance <= 0.01 ? nearestName : undefined
        }

        console.log(`Total travel time: ${result.totalTime} minutes (${formatTravelTime(result.totalTime)})`)

        if (result.segments.length === 0) {
          console.log('No segments found (start and end are identical).')
          return
        }

        console.log('Segments:')
        result.segments.forEach((segment, index) => {
          const typeLabel =
            segment.type === 'hyperlane'
              ? `Hyperlane${segment.hyperlaneId ? ` (${segment.hyperlaneId})` : ''}`
              : 'Normal space'
          const startLabel = findLabel(segment.startLandmarkId, segment.startX, segment.startY)
          const endLabel = findLabel(segment.endLandmarkId, segment.endX, segment.endY)
          const between =
            startLabel && endLabel
              ? `${startLabel} → ${endLabel}`
              : `${segment.startX.toFixed(3)},${segment.startY.toFixed(3)} → ${segment.endX.toFixed(3)},${segment.endY.toFixed(3)}`

          console.log(`  ${index + 1}. ${typeLabel} – ${segment.travelTime} minutes (${between})`)
        })
      },
    ),
  )

program
  .command('story:time-display')
  .description('Format a storyTime value (minutes from epoch) using Coruscant calendar')
  .argument('<storyTime>', 'Story time in minutes (negative for BBY, positive for ABY)')
  .option('--json', 'Output the full parsed date as JSON')
  .action(
    withAction(async (storyTimeArg: string, options: { json?: boolean }) => {
      const parsed = Number.parseInt(storyTimeArg, 10)
      if (!Number.isFinite(parsed)) {
        throw new Error(`storyTime must be an integer value, received: ${storyTimeArg}`)
      }

      const calendar = new CalendarEngine(CORUSCANT_CALENDAR)
      const date = calendar.storyTimeToDate(parsed)

      if (options.json) {
        printJSON(date)
        return
      }

      console.log(calendar.formatDate(date))
    }),
  )

program
  .command('maps:list')
  .description('List maps for a story')
  .argument('<storyId>', 'Story ID')
  .action(
    withAction(async (storyId: string) => {
      const maps = await prisma.map.findMany({
        where: { storyId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      })

      if (maps.length === 0) {
        console.log('No maps found.')
        return
      }

      printJSON(maps)
    }),
  )

program
  .command('maps:landmarks')
  .description('List landmarks for a map (optional regex filter)')
  .argument('<storyId>', 'Story ID')
  .argument('<mapId>', 'Map ID')
  .option('--search <pattern>', 'Case-insensitive regex to match landmark names (and descriptions)')
  .action(
    withAction(async (storyId: string, mapId: string, options: { search?: string }) => {
      const { landmarks } = await fetchMapTravelData(storyId, mapId)

      let filtered = landmarks
      if (options.search) {
        let regex: RegExp
        try {
          regex = new RegExp(options.search, 'i')
        } catch (error) {
          throw new Error(`Invalid regex pattern "${options.search}": ${String(error)}`)
        }

        filtered = landmarks.filter((landmark) => {
          const haystacks = [
            landmark.name ?? '',
            landmark.description ?? '',
            landmark.region ?? '',
            landmark.sector ?? '',
          ]
          return haystacks.some((value) => regex.test(value))
        })
      }

      if (filtered.length === 0) {
        console.log('No landmarks found.')
        return
      }

      printJSON(
        filtered.map((landmark) => ({
          id: landmark.id,
          name: landmark.name,
          type: landmark.type,
          x: landmark.x,
          y: landmark.y,
          region: landmark.region,
          sector: landmark.sector,
          population: landmark.population,
          industry: landmark.industry,
        })),
      )
    }),
  )

program
  .command('nodes:read')
  .description(
    'Read message content from a single node, either the full text or summaries with --summary. Best to read summaries first when reading a whole arc. For multiple nodes, call this command multiple times.',
  )
  .argument('<storyId>', 'Story ID')
  .argument('<nodeId>', 'Single node ID')
  .option('--include-deleted', 'Include soft-deleted messages')
  .option('--summary', 'Print stored summaries instead of full content')
  .option('--page <number>', 'Page number (for long chapters with many messages)')
  .action(
    withAction(
      async (
        storyId: string,
        nodeId: string,
        options: {
          includeDeleted?: boolean
          summary?: boolean
          page?: string
        },
      ) => {
        if (!nodeId || !nodeId.trim()) {
          throw new Error('Node ID is required')
        }

        const includeDeleted = Boolean(options.includeDeleted)
        const summaryOnly = Boolean(options.summary)
        const page = options.page ? Number.parseInt(options.page, 10) : 1

        if (Number.isNaN(page) || page < 1) {
          throw new Error('Page must be a positive integer')
        }

        // Target about 10,000 words per page to stay well under 13,000 word limit
        const WORDS_PER_PAGE = 10000
        const allMessages: Array<{ text: string; wordCount: number }> = []

        const allNodes = await getNodes(storyId)
        const nodesById = new Map(allNodes.map((node) => [node.id, node]))

        const targetNodeIds = expandNodeIds([nodeId.trim()], allNodes)

        for (const expandedNodeId of targetNodeIds) {
          const nodeDetails = nodesById.get(expandedNodeId)
          if (!nodeDetails) {
            throw new Error(`Node with ID ${expandedNodeId} not found in story ${storyId}`)
          }
          const storyTimeLabel = await formatStoryTimeLabel(nodeDetails.storyTime, storyId)

          const messages = await getMessages(storyId, expandedNodeId, {
            includeDeleted,
          })

          for (const message of messages) {
            const headerLine = '-'.repeat(38)
            const nodeHeaderSuffix = storyTimeLabel ? `, story time: ${storyTimeLabel}` : ''
            const rawTimeSuffix =
              nodeDetails.storyTime !== undefined && nodeDetails.storyTime !== null
                ? `, storyTime=${nodeDetails.storyTime}`
                : ''

            let body: string

            // Handle branch messages specially
            if (message.type === 'branch' && message.options) {
              const branchOptions = message.options as Array<{
                id: string
                label: string
                targetNodeId: string
                targetMessageId: string
                description?: string
              }>

              const branchContent = summaryOnly
                ? (message.paragraphSummary?.trim() ??
                  message.summary?.trim() ??
                  message.sentenceSummary?.trim() ??
                  message.content?.trim() ??
                  '')
                : (message.content?.trim() ?? '')

              const optionLines = branchOptions.map((opt) => {
                const targetNode = nodesById.get(opt.targetNodeId)
                const targetNodeTitle = targetNode?.title ?? opt.targetNodeId
                const desc = opt.description ? ` - ${opt.description}` : ''
                return `  - ${opt.label}${desc} (Go to message ${opt.targetMessageId} in chapter "${targetNodeTitle}")`
              })

              body = `BRANCH:\n${branchContent}\n\nOptions:\n${optionLines.join('\n')}`
            } else {
              body = summaryOnly
                ? (message.paragraphSummary?.trim() ??
                  message.summary?.trim() ??
                  message.sentenceSummary?.trim() ??
                  '[no summary available]')
                : (message.content?.trim() ?? '')
            }

            if (body) {
              const fullText = `${headerLine}\nnode id: ${expandedNodeId}${nodeHeaderSuffix}${rawTimeSuffix}, message id: ${message.id}\n${headerLine}\n\n${body}`

              const wordCount = body.split(/\s+/).length
              allMessages.push({ text: fullText, wordCount })
            }
          }
        }

        if (allMessages.length === 0) {
          return
        }

        // Paginate messages by word count
        const pages: string[][] = [[]]
        let currentPageWords = 0
        let currentPageIndex = 0

        for (const msg of allMessages) {
          if (currentPageWords + msg.wordCount > WORDS_PER_PAGE && pages[currentPageIndex].length > 0) {
            // Start a new page
            currentPageIndex++
            pages[currentPageIndex] = []
            currentPageWords = 0
          }

          pages[currentPageIndex].push(msg.text)
          currentPageWords += msg.wordCount
        }

        const totalPages = pages.length

        if (page > totalPages) {
          throw new Error(`Page ${page} does not exist. This node has ${totalPages} page(s).`)
        }

        const output = pages[page - 1].join('\n\n')
        process.stdout.write(output.endsWith('\n') ? output : `${output}\n`)

        // Show pagination info if there are multiple pages
        if (totalPages > 1) {
          console.log(`\n${'='.repeat(50)}`)
          console.log(`Page ${page} of ${totalPages}`)
          if (page < totalPages) {
            console.log(`To read the next page, use: --page ${page + 1}`)
          }
          if (page === 1 && totalPages > 1) {
            console.log(`This node has ${totalPages} pages total.`)
          }
          console.log('='.repeat(50))
        }
      },
    ),
  )

program
  .command('messages:list')
  .description('List all messages in a node with one-line summaries')
  .argument('<storyId>', 'Story ID')
  .argument('<nodeIds>', 'Comma-separated node IDs')
  .option('--include-deleted', 'Include soft-deleted messages')
  .action(
    withAction(
      async (
        storyId: string,
        nodeIdsArg: string,
        options: {
          includeDeleted?: boolean
        },
      ) => {
        const nodeIds = nodeIdsArg
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)

        if (nodeIds.length === 0) {
          throw new Error('At least one node ID is required')
        }

        const includeDeleted = Boolean(options.includeDeleted)
        const allNodes = await getNodes(storyId)
        const nodesById = new Map(allNodes.map((node) => [node.id, node]))

        const entries: MessageTreeEntry[] = []

        for (const nodeId of nodeIds) {
          const node = nodesById.get(nodeId)
          if (!node) {
            throw new Error(`Node with ID ${nodeId} not found in story ${storyId}`)
          }

          if (node.type !== 'chapter') {
            const descendantChapterIds = expandNodeIds([nodeId], allNodes)
            const descendantChapters = descendantChapterIds
              .map((id) => nodesById.get(id))
              .filter((candidate): candidate is CliStoryNode => Boolean(candidate))

            const nodeLabel = node.title?.trim() || '(untitled)'
            const typeLabel = node.type.charAt(0).toUpperCase() + node.type.slice(1).toLowerCase()

            if (descendantChapters.length === 0) {
              console.log(
                `Node ${node.id} (${nodeLabel}) is a ${typeLabel} node with no descendant chapters. Messages are only stored on chapter nodes.`,
              )
            } else {
              console.log(
                [
                  `Node ${node.id} (${nodeLabel}) is a ${typeLabel} node. Messages are only stored on chapter nodes.`,
                  'Chapters under this node:',
                  ...descendantChapters.map((chapter) => {
                    const chapterTitle = chapter.title?.trim() || '(untitled)'
                    return `  - ${chapterTitle} (${chapter.id})`
                  }),
                ].join('\n'),
              )
            }
            continue
          }

          const messages = await getMessages(storyId, nodeId, {
            includeDeleted,
          })

          entries.push({ node, messages })
        }

        for (const { node, messages } of entries) {
          if (messages.length === 0) {
            console.log(`No messages found for chapter ${node.id}.`)
            continue
          }

          for (const message of messages) {
            const deletedLabel = message.deleted ? ' [deleted]' : ''
            const summaryLabel = message.sentenceSummary ? ` — ${message.sentenceSummary.trim()}` : ''
            console.log(`${message.id}${deletedLabel}${summaryLabel}`)
          }
        }
      },
    ),
  )

program
  .command('messages:create')
  .description('Create a new message in a node')
  .argument('<storyId>', 'Story ID')
  .argument('<nodeId>', 'Node ID')
  .requiredOption('--content <content>', 'Message content (use @file: or pipe via stdin)')
  .option('--role <role>', 'Message role', 'assistant')
  .option('--after <messageId>', 'Insert after message ID')
  .action(
    withAction(
      async (storyId: string, nodeId: string, options: { content?: string; role?: string; after?: string }) => {
        let content = options.content ?? ''
        if (content.startsWith('@file:')) {
          const filePath = content.slice(6)
          content = await fs.promises.readFile(filePath, 'utf8')
        }
        if (!content) {
          const stdinContent = await readStdin()
          content = stdinContent.trim()
        }
        if (!content) {
          throw new Error('Message content cannot be empty')
        }
        await createMessage({
          storyId,
          nodeId,
          content,
          role: options.role,
          afterId: options.after,
        })
        console.log('OK')
      },
    ),
  )

program
  .command('messages:read')
  .description('Read the content of a single message')
  .argument('<storyId>', 'Story ID')
  .argument('<messageId>', 'Message ID')
  .action(
    withAction(async (storyId: string, messageId: string) => {
      const message = await prisma.message.findUnique({
        where: {
          storyId_id: {
            storyId,
            id: messageId,
          },
        },
        select: {
          content: true,
        },
      })

      if (!message) {
        throw new Error(`Message ${messageId} not found in story ${storyId}`)
      }

      process.stdout.write(message.content)
      if (!message.content.endsWith('\n')) {
        process.stdout.write('\n')
      }
    }),
  )

program
  .command('messages:update')
  .description('Update an existing message')
  .argument('<storyId>', 'Story ID')
  .argument('<messageId>', 'Message ID')
  .option('--content <content>', 'New message content')
  .option('--instruction <instruction>', 'New message instruction')
  .option('--node <nodeId>', 'Move message to a node')
  .action(
    withAction(
      async (
        storyId: string,
        messageId: string,
        options: { content?: string; instruction?: string; node?: string },
      ) => {
        let { content } = options
        if (content?.startsWith('@file:')) {
          const filePath = content.slice(6)
          content = await fs.promises.readFile(filePath, 'utf8')
        }
        if (content === undefined && options.instruction === undefined) {
          const stdinContent = await readStdin()
          if (stdinContent.trim()) {
            content = stdinContent
          }
        }
        await updateMessage({
          storyId,
          messageId,
          content,
          instruction: options.instruction,
          nodeId: options.node,
        })
        console.log('OK')
      },
    ),
  )

program
  .command('messages:delete')
  .description('Soft-delete a message')
  .argument('<storyId>', 'Story ID')
  .argument('<messageId>', 'Message ID')
  .action(
    withAction(async (storyId: string, messageId: string) => {
      await deleteMessage(storyId, messageId)
      printJSON({ ok: true })
    }),
  )

program
  .command('messages:replace')
  .description('Replace text within a message')
  .argument('<storyId>', 'Story ID')
  .argument('<messageId>', 'Message ID')
  .requiredOption('--search <text>', 'Substring to search for')
  .requiredOption('--replace <text>', 'Replacement text')
  .option('--expected <count>', 'Expected replacement count')
  .action(
    withAction(
      async (storyId: string, messageId: string, options: { search: string; replace: string; expected?: string }) => {
        const result = await replaceInMessage({
          storyId,
          messageId,
          searchText: options.search,
          replaceText: options.replace,
          expectedReplacements: parseOptionalInt(options.expected, 'expected'),
        })

        if (result.occurrences === 0) {
          throw new Error('No occurrences of search text found in message')
        }

        console.log(`OK (${result.occurrences} replacement${result.occurrences === 1 ? '' : 's'} made)`)
      },
    ),
  )

program
  .command('messages:search')
  .description('Search messages by regex')
  .argument('<storyId>', 'Story ID')
  .requiredOption('--query <pattern>', 'Regex pattern')
  .option('--node <nodeId>', 'Node ID to filter')
  .option('--context <count>', 'Number of context sentences (regex) or paragraphs (semantic)')
  .option('--max-results <count>', 'Maximum snippets to return')
  .option('--deleted', 'Search only soft-deleted messages')
  .option('--semantic', 'Use semantic embedding search')
  .option('--limit <count>', 'Maximum semantic results')
  .option('--min-score <score>', 'Minimum cosine similarity score (0-1)')
  .action(
    withAction(
      async (
        storyId: string,
        options: {
          query: string
          node?: string
          context?: string
          maxResults?: string
          deleted?: boolean
          semantic?: boolean
          limit?: string
          minScore?: string
        },
      ) => {
        const parsedContext = parseOptionalInt(options.context, 'context')
        if (options.semantic) {
          const limit = parseOptionalInt(options.limit, 'limit') ?? 10
          const minScore = options.minScore ? Number.parseFloat(options.minScore) : undefined
          if (minScore !== undefined && (Number.isNaN(minScore) || minScore < -1 || minScore > 1)) {
            throw new Error('min-score must be a number between -1 and 1')
          }

          const contextParagraphs = parsedContext ?? 2
          if (contextParagraphs < 0) {
            throw new Error('context must be a non-negative integer')
          }

          const results = await searchParagraphEmbeddings({
            storyId,
            query: options.query,
            limit,
            minScore,
            contextParagraphs,
          })

          printJSON({
            storyId,
            query: options.query,
            limit,
            minScore,
            results: results.map((result) => {
              return {
                messageId: result.messageId,
                paragraphIndex: result.paragraphIndex,
                matchingParagraph: result.matchingParagraph,
                score: result.score,
                context: result.context,
              }
            }),
          })
          return
        }

        const results = await searchMessages(storyId, options.query, {
          nodeId: options.node,
          context: parsedContext,
          maxResults: parseOptionalInt(options.maxResults, 'maxResults'),
          onlyDeleted: Boolean(options.deleted),
        })

        printJSON(results)
      },
    ),
  )

program
  .command('context-items:read')
  .description(
    'Display context items for a story, these make sense to read before discussing the story, as they give important background context.',
  )
  .argument('<storyId>', 'Story ID')
  .option('--ids <ids>', 'Comma-separated context item IDs to include')
  .action(
    withAction(async (storyId: string, options: { ids?: string }) => {
      const ids =
        options.ids
          ?.split(',')
          .map((id) => id.trim())
          .filter(Boolean) ?? []

      const items = await prisma.contextItem.findMany({
        where: {
          storyId,
          ...(ids.length > 0
            ? {
                id: {
                  in: ids,
                },
              }
            : {}),
        },
        orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      })

      if (items.length === 0) {
        console.log(ids.length > 0 ? 'No matching context items found.' : 'No context items found.')
        return
      }

      for (const item of items) {
        const title = item.name?.trim() || '(untitled)'
        const typeLabel = item.type ? `[${item.type}]` : ''
        const scopeLabel = item.isGlobal ? '[global]' : '[local]'
        const header = `== ${title} (${item.id}) ${[typeLabel, scopeLabel].filter(Boolean).join(' ')}`.trim()
        console.log(header)

        const description = item.description?.trim() ?? '(no description provided)'
        console.log(description)
        console.log('')
      }
    }),
  )

program
  .command('context-items:create')
  .description('Create a context item for a story')
  .argument('<storyId>', 'Story ID')
  .argument('<itemId>', 'Context item ID')
  .requiredOption('--name <name>', 'Context item name')
  .requiredOption('--type <type>', 'Context item type (e.g. theme, location)')
  .option('--description <description>', 'Context item description (use @file: or pipe via stdin)')
  .option('--global', 'Mark the context item as active for all chapters')
  .action(
    withAction(
      async (
        storyId: string,
        itemId: string,
        options: {
          name: string
          type: string
          description?: string
          global?: boolean
        },
      ) => {
        let description = options.description ?? ''
        if (description.startsWith('@file:')) {
          const filePath = description.slice(6)
          description = await fs.promises.readFile(filePath, 'utf8')
        }
        if (!description) {
          const stdinContent = await readStdin()
          description = stdinContent.trim()
        }
        if (!description) {
          throw new Error('Context item description cannot be empty')
        }

        const item = await prisma.contextItem.create({
          data: {
            id: itemId,
            storyId,
            name: options.name,
            type: options.type,
            description,
            isGlobal: options.global === true,
          },
        })

        printJSON(item)
      },
    ),
  )

program
  .command('context-items:update')
  .description('Update an existing context item')
  .argument('<storyId>', 'Story ID')
  .argument('<itemId>', 'Context item ID')
  .option('--name <name>', 'New context item name')
  .option('--type <type>', 'New context item type')
  .option('--description <description>', 'New description (use @file: or pipe via stdin)')
  .option('--global', 'Mark the context item as active for all chapters')
  .option('--local', 'Mark the context item as chapter-specific')
  .action(
    withAction(
      async (
        storyId: string,
        itemId: string,
        options: {
          name?: string
          type?: string
          description?: string
          global?: boolean
          local?: boolean
        },
      ) => {
        let { description } = options
        if (description?.startsWith('@file:')) {
          const filePath = description.slice(6)
          description = await fs.promises.readFile(filePath, 'utf8')
        }
        if (description === undefined) {
          const stdinContent = await readStdin()
          if (stdinContent.trim()) {
            description = stdinContent
          }
        }

        const updates: {
          name?: string
          type?: string
          description?: string
          isGlobal?: boolean
        } = {}

        if (options.name !== undefined) {
          updates.name = options.name
        }
        if (options.type !== undefined) {
          updates.type = options.type
        }
        if (description !== undefined) {
          updates.description = description
        }
        if (options.global === true) {
          updates.isGlobal = true
        }
        if (options.local === true) {
          updates.isGlobal = false
        }

        if (Object.keys(updates).length === 0) {
          throw new Error('Provide at least one field to update (name, type, description, --global, or --local)')
        }

        await prisma.contextItem.update({
          where: {
            storyId_id: {
              storyId,
              id: itemId,
            },
          },
          data: updates,
        })

        console.log('OK')
      },
    ),
  )

program
  .command('context-items:delete')
  .description('Delete a context item')
  .argument('<storyId>', 'Story ID')
  .argument('<itemId>', 'Context item ID')
  .action(
    withAction(async (storyId: string, itemId: string) => {
      await prisma.contextItem.delete({
        where: {
          storyId_id: {
            storyId,
            id: itemId,
          },
        },
      })

      printJSON({ ok: true })
    }),
  )

program
  .command('embeddings:rebuild')
  .description('Rebuild paragraph embeddings for messages')
  .option('--story <storyId>', 'Only rebuild embeddings for a specific story')
  .option('--progress-interval <count>', 'Report progress after processing this many messages')
  .option('--force', 'Regenerate embeddings even when cached data is up to date')
  .action(
    withAction(
      async (options: {
        story?: string
        progressInterval?: string
        force?: boolean
      }) => {
        const interval = parseOptionalInt(options.progressInterval, 'progress-interval') ?? 25

        let lastLoggedStory: string | undefined

        try {
          await rebuildParagraphEmbeddings({
            storyId: options.story,
            progressInterval: interval,
            force: Boolean(options.force),
            onProgress: ({ completed, total, storyId: story, messageId, progress }) => {
              const percent = total === 0 ? 100 : Math.min(100, Math.max(0, progress * 100))
              const percentLabel = percent.toFixed(1).padStart(6)
              const storyLabel = story !== lastLoggedStory ? ` (${story})` : ''
              console.log(`[${completed}/${total}] ${percentLabel}% processed message ${messageId}${storyLabel}`)
              lastLoggedStory = story
            },
          })

          console.log('Embeddings rebuilt successfully')
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          console.error(`Warning: failed to rebuild embeddings: ${message}`)
        }
      },
    ),
  )

program
  .command('characters:list')
  .description('List characters for a story')
  .argument('<storyId>', 'Story ID')
  .action(
    withAction(async (storyId: string) => {
      const characters = await getCharacters(storyId)
      printMarkdownTable(
        characters.map((character) => ({
          id: character.id,
          name: character.name,
          protagonist: character.isProtagonist ? 'Yes' : 'No',
        })),
      )
    }),
  )

program
  .command('characters:show')
  .description('Show character details')
  .argument('<storyId>', 'Story ID')
  .argument('<characterId>', 'Character ID')
  .action(
    withAction(async (storyId: string, characterId: string) => {
      const character = await getCharacter(storyId, characterId)
      printJSON(character)
    }),
  )

program
  .command('characters:at')
  .description('Evaluate characters at a specific message')
  .argument('<storyId>', 'Story ID')
  .argument('<messageId>', 'Message ID')
  .action(
    withAction(async (storyId: string, messageId: string) => {
      const characters = await getCharactersAtPoint(storyId, messageId)
      printJSON(characters)
    }),
  )

async function main() {
  await program.parseAsync(process.argv)

  // Give a brief moment for any pending Redis publishes to complete
  // before exiting. This ensures CLI events reach the server.
  await new Promise((resolve) => setTimeout(resolve, 100))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Fatal error: ${message}`)
    process.exit(1)
  })
