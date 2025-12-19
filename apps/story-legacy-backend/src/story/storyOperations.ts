import { prisma } from '../lib/prisma'
import { saveMessageVersion } from '../routes/messages/saveMessageVersion'
import { splitIntoParagraphs } from '../services/paragraphEmbeddingService'
import { generateMessageId } from '../utils/id'
import { evaluateTemplate, executeScriptsUpToMessage } from '../utils/scriptEngine'
import {
  emitMessageCreatedAwait,
  emitMessageDeletedAwait,
  emitMessageUpdatedAwait,
  emitNodeCreated,
  emitNodeDeleted,
  emitNodeUpdated,
} from '../websocket'

type NodeType = 'book' | 'arc' | 'chapter'

interface StoryNodeRecord {
  id: string
  storyId: string
  parentId: string | null
  type: string
  title: string
  summary: string | null
  includeInFull: number | null
  status: string | null
  order: number
  expanded: boolean
  activeCharacterIds: string | null
  activeContextItemIds: string | null
  viewpointCharacterId: string | null
  storyTime: number | null
  createdAt: Date
  updatedAt: Date
}

interface MessageRecord {
  id: string
  storyId: string
  nodeId: string | null
  role: string
  content: string
  paragraphs: string[] | null
  instruction: string | null
  timestamp: Date
  order: number
  deleted: boolean
  type: string | null
  isQuery: boolean
  sentenceSummary: string | null
  summary: string | null
  paragraphSummary: string | null
  isCompacted: boolean
}

interface MessageWithNode extends MessageRecord {
  node: {
    id: string
    title: string
    parentId: string | null
    type: string
  } | null
}

const STORY_SETTINGS = [
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'scifi', label: 'Science Fiction' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'romance', label: 'Romance' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'horror', label: 'Horror' },
  { value: 'historical', label: 'Historical' },
  { value: 'contemporary', label: 'Contemporary' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'drama', label: 'Drama' },
  { value: 'other', label: 'Other' },
] as const

function buildStorySystemPrompt(
  storySetting: string,
  person?: string | null,
  tense?: string | null,
  protagonistName?: string | null,
  paragraphsPerTurn?: number | null,
): string {
  const selectedSetting = STORY_SETTINGS.find((s) => s.value === storySetting)
  const settingText = selectedSetting?.value
    ? `This is a ${selectedSetting.label.toLowerCase()} story. Write in the appropriate tone, style, and atmosphere for this genre. `
    : ''

  const personText = person === 'first' ? 'first person' : 'third person'
  const tenseText = tense === 'present' ? 'present tense' : 'past tense'
  const perspectiveText = person === 'first' && protagonistName ? ` from the perspective of ${protagonistName}` : ''

  const styleText = `Write in ${personText} ${tenseText}${perspectiveText}. `

  const paragraphGuidance =
    paragraphsPerTurn && paragraphsPerTurn > 0
      ? `Write approximately ${paragraphsPerTurn} paragraph${paragraphsPerTurn !== 1 ? 's' : ''} in your response. `
      : ''

  return `You are a creative story writer helping to create an engaging narrative. ${settingText}${styleText}${paragraphGuidance}Continue the story based on the user's direction, maintaining consistency with previous events and character development. Write in a natural, flowing style that draws the reader in. Focus on "show, don't tell" and include vivid descriptions, dialogue, and character thoughts where appropriate.

IMPORTANT:
- Write ONLY a single story continuation turn
- Write ONLY what the user's direction specifically asks for - do not add extra scenes, events, or content beyond what was requested
- If the user asks for a conversation, write only that conversation - do not add events before or after
- If the user asks for a specific action or scene, write only that action or scene - do not extend beyond it
- Use natural paragraph breaks to structure your writing
- Do not include chapter headers, separators, or section labels
- Do not add author notes or commentary
- Simply continue the story directly with proper paragraphs
- If you need to reason about the story, use <think>your reasoning here</think> tags`
}

function orderNodesDepthFirst(nodes: StoryNodeRecord[]): StoryNodeRecord[] {
  const childrenMap = new Map<string | null, StoryNodeRecord[]>()
  nodes.forEach((node) => {
    const parentId = node.parentId ?? null
    const current = childrenMap.get(parentId) ?? []
    current.push(node)
    childrenMap.set(parentId, current)
  })

  for (const [, children] of childrenMap.entries()) {
    children.sort((a, b) => a.order - b.order)
  }

  const ordered: StoryNodeRecord[] = []
  const traverse = (parentId: string | null) => {
    const children = childrenMap.get(parentId) ?? []
    for (const child of children) {
      ordered.push(child)
      traverse(child.id)
    }
  }

  traverse(null)
  return ordered
}

function getChapterNodesInOrder(nodes: StoryNodeRecord[]): StoryNodeRecord[] {
  return orderNodesDepthFirst(nodes).filter((node) => node.type === 'chapter')
}

function getChapterNodesBeforeNode(nodes: StoryNodeRecord[], currentNodeId: string): StoryNodeRecord[] {
  const ordered = getChapterNodesInOrder(nodes)
  const index = ordered.findIndex((node) => node.id === currentNodeId)
  return index <= 0 ? [] : ordered.slice(0, index)
}

function applySummarization(message: MessageRecord, position: number, total: number): string {
  if (message.isCompacted) {
    return message.content
  }

  const turnsFromEnd = total - position
  if (turnsFromEnd > 14 && message.sentenceSummary) {
    return message.sentenceSummary
  }
  if (turnsFromEnd > 14 && message.summary) {
    return message.summary
  }

  if (turnsFromEnd > 7 && message.paragraphSummary) {
    return message.paragraphSummary
  }

  return message.content
}

function parseIdArray(value: string | null | undefined): string[] {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch (error) {
    console.warn('Failed to parse ID array:', error)
    return []
  }
}

function ensureNodeBelongsToStory(
  node: StoryNodeRecord | null,
  storyId: string,
  nodeId: string,
): asserts node is StoryNodeRecord {
  if (!node || node.storyId !== storyId) {
    throw new Error(`Node ${nodeId} does not belong to story ${storyId}`)
  }
}

function ensureNodeHierarchy(type: NodeType, parent: StoryNodeRecord | null): void {
  if (type === 'book') {
    if (parent) {
      throw new Error('Book nodes cannot have a parent node')
    }
    return
  }

  if (!parent) {
    throw new Error(`${type} nodes require a parent`)
  }

  if (type === 'arc' && parent.type !== 'book') {
    throw new Error('Arc nodes must have a book as their parent')
  }

  if (type === 'chapter' && parent.type !== 'arc') {
    throw new Error('Chapter nodes must have an arc as their parent')
  }
}

function ensureParentForExistingNode(node: StoryNodeRecord, parent: StoryNodeRecord | null): void {
  if (node.type === 'book') {
    if (parent) {
      throw new Error('Book nodes cannot be re-parented')
    }
    return
  }

  if (!parent) {
    throw new Error(`${node.type} nodes require a parent`)
  }

  if (node.type === 'arc' && parent.type !== 'book') {
    throw new Error('Arc nodes must be children of books')
  }

  if (node.type === 'chapter' && parent.type !== 'arc') {
    throw new Error('Chapter nodes must be children of arcs')
  }
}

export interface ListStoriesOptions {
  includeDeleted?: boolean
}

export async function listStories(options: ListStoriesOptions = {}) {
  const { includeDeleted = false } = options
  return prisma.story.findMany({
    where: includeDeleted ? {} : { deleted: false },
    select: {
      id: true,
      name: true,
      storySetting: true,
      savedAt: true,
      updatedAt: true,
      deleted: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getStory(storyId: string) {
  if (!storyId) {
    throw new Error('storyId is required')
  }

  const story = await prisma.story.findUnique({
    where: { id: storyId },
  })

  if (!story) {
    throw new Error(`Story with ID ${storyId} not found`)
  }

  return story
}

export interface CreateStoryInput {
  name: string
  storySetting?: string
}

export async function createStory(input: CreateStoryInput) {
  if (!input.name) {
    throw new Error('name is required')
  }

  return prisma.story.create({
    data: {
      id: generateMessageId(),
      name: input.name,
      storySetting: input.storySetting || '',
    },
  })
}

export async function searchStories(query: string) {
  if (!query) {
    throw new Error('query is required')
  }

  return prisma.story.findMany({
    where: {
      AND: [
        { deleted: false },
        {
          OR: [{ name: { contains: query } }, { storySetting: { contains: query } }],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      storySetting: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export interface UpdateStoryInput {
  storyId: string
  name?: string
  storySetting?: string
  input?: string
  person?: string
  tense?: string
  globalScript?: string | null
  selectedNodeId?: string | null
}

export async function updateStory(input: UpdateStoryInput) {
  if (!input.storyId) {
    throw new Error('storyId is required')
  }

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) {
    data.name = input.name
  }
  if (input.storySetting !== undefined) {
    data.storySetting = input.storySetting
  }
  if (input.input !== undefined) {
    data.input = input.input
  }
  if (input.person !== undefined) {
    data.person = input.person
  }
  if (input.tense !== undefined) {
    data.tense = input.tense
  }
  if (input.globalScript !== undefined) {
    data.globalScript = input.globalScript
  }
  if (input.selectedNodeId !== undefined) {
    data.selectedNodeId = input.selectedNodeId
  }

  if (Object.keys(data).length === 0) {
    throw new Error('No update fields provided')
  }

  return prisma.story.update({
    where: { id: input.storyId },
    data,
  })
}

export interface GetNodesOptions {
  includeWordCounts?: boolean
}

export async function getNodes(storyId: string, options: GetNodesOptions = {}) {
  if (!storyId) {
    throw new Error('storyId is required')
  }

  const nodes = await prisma.node.findMany({
    where: { storyId },
    orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
  })

  if (!options.includeWordCounts) {
    return nodes
  }

  const chapterIds = nodes.filter((node) => node.type === 'chapter').map((node) => node.id)
  if (chapterIds.length === 0) {
    return nodes.map((node) => ({ ...node, wordCount: 0 }))
  }

  const messages = await prisma.message.findMany({
    where: {
      storyId,
      nodeId: { in: chapterIds },
      deleted: false,
      isQuery: false,
    },
    select: { nodeId: true, content: true },
  })

  const counts = new Map<string, number>()
  for (const message of messages) {
    if (!message.nodeId) {
      continue
    }
    const words = message.content.split(/\s+/).filter(Boolean).length
    counts.set(message.nodeId, (counts.get(message.nodeId) ?? 0) + words)
  }

  return nodes.map((node) => ({
    ...node,
    wordCount: counts.get(node.id) ?? 0,
  }))
}

export interface CreateNodeInput {
  storyId: string
  type: NodeType
  title?: string
  parentId?: string | null
  order?: number
}

export async function createNode(input: CreateNodeInput) {
  if (!input.storyId || !input.type) {
    throw new Error('storyId and type are required')
  }

  const parent = input.parentId
    ? await prisma.node.findFirst({
        where: { id: input.parentId, storyId: input.storyId },
      })
    : null

  ensureNodeHierarchy(input.type, parent)

  const siblingCount = await prisma.node.count({
    where: {
      storyId: input.storyId,
      parentId: parent ? parent.id : null,
    },
  })

  const node = await prisma.node.create({
    data: {
      id: generateMessageId(),
      storyId: input.storyId,
      parentId: parent ? parent.id : null,
      type: input.type,
      title: input.title?.trim() || `New ${input.type}`,
      order: input.order ?? siblingCount,
      expanded: true,
      includeInFull: 1,
    },
  })

  emitNodeCreated(input.storyId, node)

  return node
}

export interface UpdateNodeInput {
  storyId: string
  nodeId: string
  title?: string | null
  summary?: string | null
  includeInFull?: number | null
  status?: string | null
  order?: number | null
  parentId?: string | null
  expanded?: boolean | null
  storyTime?: number | null
  activeCharacterIds?: string[] | string | null
  activeContextItemIds?: string[] | string | null
  viewpointCharacterId?: string | null
}

export async function updateNode(input: UpdateNodeInput) {
  if (!input.storyId || !input.nodeId) {
    throw new Error('storyId and nodeId are required')
  }

  const node = await prisma.node.findFirst({
    where: { id: input.nodeId, storyId: input.storyId },
  })

  if (!node) {
    throw new Error(`Node ${input.nodeId} not found in story ${input.storyId}`)
  }

  let parent = node.parentId
    ? await prisma.node.findFirst({
        where: { id: node.parentId, storyId: input.storyId },
      })
    : null

  if (input.parentId !== undefined) {
    parent = input.parentId
      ? await prisma.node.findFirst({
          where: { id: input.parentId, storyId: input.storyId },
        })
      : null
  }

  ensureParentForExistingNode(node, parent)

  const data: Record<string, unknown> = {}

  if (input.title !== undefined) data.title = input.title
  if (input.summary !== undefined) data.summary = input.summary
  if (input.includeInFull !== undefined) data.includeInFull = input.includeInFull
  if (input.status !== undefined) data.status = input.status
  if (input.order !== undefined) data.order = input.order
  if (input.expanded !== undefined) data.expanded = input.expanded
  if (input.storyTime !== undefined) data.storyTime = input.storyTime
  if (input.viewpointCharacterId !== undefined) data.viewpointCharacterId = input.viewpointCharacterId
  if (input.parentId !== undefined) data.parentId = parent ? parent.id : null

  if (input.activeCharacterIds !== undefined) {
    if (Array.isArray(input.activeCharacterIds)) {
      data.activeCharacterIds = JSON.stringify(input.activeCharacterIds)
    } else {
      data.activeCharacterIds = input.activeCharacterIds
    }
  }

  if (input.activeContextItemIds !== undefined) {
    if (Array.isArray(input.activeContextItemIds)) {
      data.activeContextItemIds = JSON.stringify(input.activeContextItemIds)
    } else {
      data.activeContextItemIds = input.activeContextItemIds
    }
  }

  if (Object.keys(data).length === 0) {
    throw new Error('No update fields provided for node')
  }

  const updated = await prisma.node.update({
    where: { id: input.nodeId },
    data,
  })

  emitNodeUpdated(input.storyId, updated)

  return updated
}

export async function deleteNode(storyId: string, nodeId: string) {
  if (!storyId || !nodeId) {
    throw new Error('storyId and nodeId are required')
  }

  const node = await prisma.node.findFirst({
    where: { id: nodeId, storyId },
  })

  if (!node) {
    throw new Error(`Node ${nodeId} not found in story ${storyId}`)
  }

  await prisma.node.delete({ where: { id: nodeId } })

  if (node.type === 'chapter') {
    await prisma.message.updateMany({
      where: { storyId, nodeId },
      data: { nodeId: null },
    })
  }

  emitNodeDeleted(storyId, nodeId)

  return { success: true }
}

export interface SearchMessagesOptions {
  includeDeleted?: boolean
  onlyDeleted?: boolean
  nodeId?: string
  context?: number
  maxResults?: number
  includeIncomplete?: boolean
}

interface MessageSearchResultSnippet {
  sentenceIndex: number
  text: string
  isIncomplete?: boolean
}

interface MessageSearchResult {
  messageId: string
  nodeId: string | null
  nodeTitle: string | null
  timestamp: Date
  order: number
  deleted: boolean
  snippets: MessageSearchResultSnippet[]
  matchCount: number
  totalSentences: number
  type: 'message' | 'meta_instruction'
  isIncomplete?: boolean
}

export async function searchMessages(storyId: string, query: string, options: SearchMessagesOptions = {}) {
  if (!storyId || !query) {
    throw new Error('storyId and query are required')
  }

  const whereClause: {
    storyId: string
    deleted?: boolean
    nodeId?: string
  } = {
    storyId,
  }

  if (options.onlyDeleted) {
    whereClause.deleted = true
  } else if (!options.includeDeleted) {
    whereClause.deleted = false
  }

  if (options.nodeId) {
    whereClause.nodeId = options.nodeId
  }

  const messages = (await prisma.message.findMany({
    where: whereClause,
    orderBy: { order: 'asc' },
    select: {
      id: true,
      storyId: true,
      nodeId: true,
      role: true,
      content: true,
      paragraphs: true,
      instruction: true,
      timestamp: true,
      order: true,
      deleted: true,
      type: true,
      isQuery: true,
      summary: true,
      sentenceSummary: true,
      paragraphSummary: true,
      isCompacted: true,
      node: {
        select: {
          id: true,
          title: true,
          type: true,
          parentId: true,
        },
      },
    },
  })) as unknown as MessageWithNode[]

  const isIncompleteMessage = (content: string): boolean => {
    if (!content || content.trim().length === 0) {
      return true
    }

    const trimmedContent = content.trim()
    if (trimmedContent.length < 50) {
      return true
    }

    const metaInstructionPattern =
      /^\s*\[(continue|expand|todo|write|edit|add|fix|improve|update|revise|rewrite|extend|develop|elaborate|detail|finish|complete|draft|outline|placeholder|notes?|reminder|tbd|pending|wip|work.?in.?progress)\]\s*$/i
    if (metaInstructionPattern.test(trimmedContent)) {
      return true
    }

    const placeholderPatterns = [
      /^\s*\.\.\.\s*$/,
      /^\s*TODO:?\s*$/i,
      /^\s*TBD:?\s*$/i,
      /^\s*\(to be (written|continued|expanded|added)\)\s*$/i,
      /^\s*\[placeholder\]\s*$/i,
      /^\s*\[coming soon\]\s*$/i,
      /^\s*\[needs work\]\s*$/i,
      /^\s*\[draft\]\s*$/i,
    ]

    return placeholderPatterns.some((pattern) => pattern.test(trimmedContent))
  }

  let regex: RegExp
  try {
    regex = new RegExp(query, 'gi')
  } catch {
    throw new Error(`Invalid regex pattern: ${query}`)
  }

  const contextSize = options.context ?? 2
  const maxResults = options.maxResults ?? 10
  const includeIncomplete = options.includeIncomplete === true

  const results: MessageSearchResult[] = []
  let totalSnippetsAdded = 0
  let _totalMatchesFound = 0
  let additionalMatches = 0
  const additionalNodes = new Set<string>()

  for (const message of messages) {
    const incomplete = isIncompleteMessage(message.content)

    if (includeIncomplete) {
      if (!incomplete) {
        continue
      }
    } else {
      const hasRegexMatch = regex.test(message.content)
      regex.lastIndex = 0
      if (!hasRegexMatch) {
        continue
      }
    }

    if (totalSnippetsAdded >= maxResults) {
      additionalMatches += 1
      if (message.node?.title) {
        additionalNodes.add(message.node.title)
      }
      continue
    }

    const snippets: MessageSearchResultSnippet[] = []
    let matchCount = 0

    if (includeIncomplete) {
      snippets.push({
        sentenceIndex: 0,
        text: message.content.trim() || '[Empty message]',
        isIncomplete: true,
      })
      totalSnippetsAdded += 1
      matchCount = 1
    } else {
      const sentenceRegex = /[^.!?\n]+[.!?]+|\n\n+|[^.!?\n]+$/g
      const sentences = message.content.match(sentenceRegex) || []
      const matchingSentenceIndices: Set<number> = new Set()

      sentences.forEach((sentence, index) => {
        if (regex.test(sentence)) {
          matchingSentenceIndices.add(index)
          const sentenceMatches = sentence.match(regex) || []
          matchCount += sentenceMatches.length
        }
        regex.lastIndex = 0
      })

      for (const sentenceIndex of matchingSentenceIndices) {
        const start = Math.max(0, sentenceIndex - contextSize)
        const end = Math.min(sentences.length - 1, sentenceIndex + contextSize)
        const snippetSentences = sentences.slice(start, end + 1)
        snippets.push({
          sentenceIndex,
          text: snippetSentences.join(' ').trim(),
        })
      }

      totalSnippetsAdded += snippets.length
      _totalMatchesFound += matchCount
    }

    const result: MessageSearchResult = {
      messageId: message.id,
      nodeId: message.node?.id ?? null,
      nodeTitle: message.node?.title ?? null,
      timestamp: message.timestamp,
      order: message.order,
      deleted: message.deleted,
      snippets,
      matchCount,
      totalSentences: snippets.length,
      type: incomplete ? 'meta_instruction' : 'message',
    }

    if (includeIncomplete) {
      result.isIncomplete = true
    }

    results.push(result)
  }

  const incompleteMessages = results.filter((r) => r.isIncomplete)

  const response: {
    query: string
    contextSentences: number
    totalSnippets: number
    totalMessages: number
    includeIncomplete: boolean
    incompleteMessagesFound: number
    additionalMatches?: {
      count: number
      inNodes: number
      nodeTitles: string[]
    }
    results: MessageSearchResult[]
  } = {
    query,
    contextSentences: contextSize,
    totalSnippets: totalSnippetsAdded,
    totalMessages: results.length,
    includeIncomplete,
    incompleteMessagesFound: incompleteMessages.length,
    results,
  }

  if (additionalMatches > 0) {
    response.additionalMatches = {
      count: additionalMatches,
      inNodes: additionalNodes.size,
      nodeTitles: Array.from(additionalNodes),
    }
  }

  return response
}

export interface GetMessagesOptions {
  includeDeleted?: boolean
}

export async function getMessages(storyId: string, nodeId: string, options: GetMessagesOptions = {}) {
  if (!storyId || !nodeId) {
    throw new Error('storyId and nodeId are required')
  }

  const node = await prisma.node.findFirst({
    where: { id: nodeId, storyId },
  })

  ensureNodeBelongsToStory(node, storyId, nodeId)

  return prisma.message.findMany({
    where: {
      storyId,
      nodeId,
      deleted: options.includeDeleted ? undefined : false,
      isQuery: false,
    },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      content: true,
      paragraphs: true,
      role: true,
      timestamp: true,
      order: true,
      deleted: true,
      instruction: true,
      sentenceSummary: true,
      summary: true,
      paragraphSummary: true,
      type: true,
      options: true,
    },
  })
}

export interface CreateMessageInput {
  storyId: string
  nodeId: string
  content: string
  role?: string
  afterId?: string
}

export async function createMessage(input: CreateMessageInput) {
  if (!input.storyId || !input.nodeId || !input.content) {
    throw new Error('storyId, nodeId, and content are required')
  }

  const paragraphs = splitIntoParagraphs(input.content)

  const node = await prisma.node.findFirst({
    where: { id: input.nodeId, storyId: input.storyId },
  })

  ensureNodeBelongsToStory(node, input.storyId, input.nodeId)
  if (node.type !== 'chapter') {
    throw new Error('Messages can only be added to chapter nodes')
  }

  const timestamp = new Date()
  const messageId = generateMessageId()
  const buildMessageData = (order: number) => ({
    id: messageId,
    storyId: input.storyId,
    nodeId: input.nodeId,
    content: input.content,
    role: input.role || 'assistant',
    order,
    timestamp,
    paragraphs,
  })

  const message = await (async () => {
    if (input.afterId) {
      const afterMessage = await prisma.message.findUnique({
        where: {
          storyId_id: {
            storyId: input.storyId,
            id: input.afterId,
          },
        },
        select: { order: true },
      })

      if (!afterMessage) {
        throw new Error(`Message with ID ${input.afterId} not found`)
      }

      const nextMessage = await prisma.message.findFirst({
        where: {
          storyId: input.storyId,
          order: { gt: afterMessage.order },
        },
        orderBy: { order: 'asc' },
        select: { order: true },
      })

      if (nextMessage && nextMessage.order - afterMessage.order <= 1) {
        return prisma.$transaction(async (tx) => {
          await tx.message.updateMany({
            where: {
              storyId: input.storyId,
              order: { gt: afterMessage.order },
            },
            data: {
              order: { increment: 1 },
            },
          })

          return tx.message.create({
            data: buildMessageData(afterMessage.order + 1),
          })
        })
      }

      const order = nextMessage ? Math.floor((afterMessage.order + nextMessage.order) / 2) : afterMessage.order + 1

      return prisma.message.create({
        data: buildMessageData(order),
      })
    }

    const lastMessage = await prisma.message.findFirst({
      where: { storyId: input.storyId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const order = lastMessage ? lastMessage.order + 1 : 1

    return prisma.message.create({
      data: buildMessageData(order),
    })
  })()

  await prisma.story.update({
    where: { id: input.storyId },
    data: {},
  })

  await emitMessageCreatedAwait(input.storyId, message, input.afterId || null)

  return message
}

export interface UpdateMessageInput {
  storyId: string
  messageId: string
  content?: string
  instruction?: string
  nodeId?: string | null
}

export async function updateMessage(input: UpdateMessageInput) {
  if (!input.storyId || !input.messageId) {
    throw new Error('storyId and messageId are required')
  }

  if (input.content === undefined && input.instruction === undefined && input.nodeId === undefined) {
    throw new Error('Provide at least one field to update')
  }

  const existing = await prisma.message.findUnique({
    where: {
      storyId_id: {
        storyId: input.storyId,
        id: input.messageId,
      },
    },
    select: {
      type: true,
      content: true,
      instruction: true,
      model: true,
    },
  })

  if (!existing) {
    throw new Error(`Message ${input.messageId} not found`)
  }

  if (existing.type === 'chapter') {
    throw new Error('Chapter marker messages are no longer supported')
  }

  if (input.nodeId) {
    const node = await prisma.node.findFirst({
      where: { id: input.nodeId, storyId: input.storyId },
    })
    ensureNodeBelongsToStory(node, input.storyId, input.nodeId)
    if (node.type !== 'chapter') {
      throw new Error('Messages can only belong to chapter nodes')
    }
  }

  const data: Record<string, unknown> = {
    timestamp: new Date(),
  }

  if (input.content !== undefined) data.content = input.content
  if (input.instruction !== undefined) data.instruction = input.instruction
  if (input.nodeId !== undefined) data.nodeId = input.nodeId

  const shouldSaveVersion =
    input.content !== undefined && typeof existing.content === 'string' && input.content !== existing.content

  if (shouldSaveVersion) {
    await saveMessageVersion(
      input.storyId,
      input.messageId,
      'cli_edit',
      existing.content,
      existing.instruction,
      existing.model,
    )
  }

  const updated = await prisma.message.update({
    where: {
      storyId_id: {
        storyId: input.storyId,
        id: input.messageId,
      },
    },
    data,
  })

  await prisma.story.update({
    where: { id: input.storyId },
    data: {},
  })

  await emitMessageUpdatedAwait(input.storyId, updated)
  return updated
}

export async function deleteMessage(storyId: string, messageId: string) {
  if (!storyId || !messageId) {
    throw new Error('storyId and messageId are required')
  }

  await prisma.message.update({
    where: {
      storyId_id: {
        storyId,
        id: messageId,
      },
    },
    data: { deleted: true },
  })

  await prisma.story.update({
    where: { id: storyId },
    data: {},
  })

  await emitMessageDeletedAwait(storyId, messageId)
}

export interface ReplaceInMessageInput {
  storyId: string
  messageId: string
  searchText: string
  replaceText: string
  expectedReplacements?: number
}

export async function replaceInMessage(input: ReplaceInMessageInput) {
  if (!input.storyId || !input.messageId || !input.searchText || !input.replaceText) {
    throw new Error('storyId, messageId, searchText, and replaceText are required')
  }

  const expectedReplacements = input.expectedReplacements ?? 1

  const message = await prisma.message.findUnique({
    where: {
      storyId_id: {
        storyId: input.storyId,
        id: input.messageId,
      },
    },
    select: { content: true },
  })

  if (!message) {
    throw new Error(`Message ${input.messageId} not found`)
  }

  const occurrences =
    message.content.match(new RegExp(input.searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length || 0

  if (occurrences !== expectedReplacements) {
    throw new Error(
      `Expected ${expectedReplacements} replacement(s), but found ${occurrences} occurrence(s) of the search text`,
    )
  }

  let newContent = message.content
  if (expectedReplacements === 1) {
    newContent = message.content.replace(input.searchText, input.replaceText)
  } else {
    newContent = message.content.split(input.searchText).join(input.replaceText)
  }

  const updatedMessage = await prisma.message.update({
    where: {
      storyId_id: {
        storyId: input.storyId,
        id: input.messageId,
      },
    },
    data: {
      content: newContent,
      timestamp: new Date(),
    },
  })

  await prisma.story.update({
    where: { id: input.storyId },
    data: {},
  })

  await emitMessageUpdatedAwait(input.storyId, updatedMessage)

  return {
    occurrences,
    message: updatedMessage,
  }
}

export async function getCharacter(storyId: string, characterId: string) {
  if (!storyId || !characterId) {
    throw new Error('storyId and characterId are required')
  }

  const character = await prisma.character.findUnique({
    where: { storyId_id: { storyId, id: characterId } },
  })

  if (!character) {
    throw new Error(`Character with ID ${characterId} not found in story ${storyId}`)
  }

  return character
}

export async function getCharacters(storyId: string) {
  if (!storyId) {
    throw new Error('storyId is required')
  }

  return prisma.character.findMany({
    where: { storyId },
    orderBy: [{ isProtagonist: 'desc' }, { name: 'asc' }],
  })
}

export async function getCharactersAtPoint(storyId: string, messageId: string) {
  if (!storyId || !messageId) {
    throw new Error('storyId and messageId are required')
  }

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { globalScript: true },
  })

  if (!story) {
    throw new Error(`Story with ID ${storyId} not found`)
  }

  const targetMessage = await prisma.message.findUnique({
    where: {
      storyId_id: {
        storyId,
        id: messageId,
      },
    },
    select: { order: true },
  })

  if (!targetMessage) {
    throw new Error(`Message with ID ${messageId} not found`)
  }

  const messages = await prisma.message.findMany({
    where: {
      storyId,
      deleted: false,
      order: { lte: targetMessage.order },
    },
    orderBy: { order: 'asc' },
  })

  const characters = await prisma.character.findMany({
    where: { storyId },
    orderBy: [{ isProtagonist: 'desc' }, { name: 'asc' }],
  })

  const scriptData = executeScriptsUpToMessage(messages, messageId, story.globalScript || undefined)

  return characters.map((character) => ({
    ...character,
    evaluatedName: evaluateTemplate(character.name, scriptData),
    evaluatedDescription: evaluateTemplate(character.description, scriptData),
    scriptData,
  }))
}

export interface GenerationContextOptions {
  forceMissingSummaries?: boolean
  includeChaptersInFull?: string[]
  paragraphsPerTurn?: number | null
}

export async function getGenerationContext(
  storyId: string,
  messageId: string,
  inputText: string,
  options: GenerationContextOptions = {},
) {
  if (!storyId || !messageId || !inputText) {
    throw new Error('storyId, messageId, and inputText are required')
  }

  const { forceMissingSummaries = false, includeChaptersInFull = [], paragraphsPerTurn } = options

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      storySetting: true,
      globalScript: true,
      person: true,
      tense: true,
      branchChoices: true,
    },
  })

  if (!story) {
    throw new Error(`Story with ID ${storyId} not found`)
  }

  const targetMessage = await prisma.message.findUnique({
    where: {
      storyId_id: {
        storyId,
        id: messageId,
      },
    },
    select: {
      order: true,
      nodeId: true,
    },
  })

  if (!targetMessage) {
    throw new Error(`Message with ID ${messageId} not found`)
  }

  const messages = (await prisma.message.findMany({
    where: {
      storyId,
      deleted: false,
      order: { lte: targetMessage.order },
    },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      storyId: true,
      nodeId: true,
      role: true,
      content: true,
      paragraphs: true,
      instruction: true,
      timestamp: true,
      order: true,
      deleted: true,
      type: true,
      isQuery: true,
      sentenceSummary: true,
      summary: true,
      paragraphSummary: true,
      isCompacted: true,
    },
  })) as unknown as MessageRecord[]

  const nodes: StoryNodeRecord[] = await prisma.node.findMany({
    where: { storyId },
    orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
  })

  const characters = await prisma.character.findMany({
    where: { storyId },
    orderBy: [{ isProtagonist: 'desc' }, { name: 'asc' }],
  })

  const contextItems = await prisma.contextItem.findMany({
    where: { storyId },
  })

  const currentNodeId = targetMessage.nodeId
  const chapterNodesInOrder = getChapterNodesInOrder(nodes)

  const currentNode = currentNodeId ? chapterNodesInOrder.find((node) => node.id === currentNodeId) : undefined

  if (!currentNode && chapterNodesInOrder.length > 0) {
    console.warn('Target message is not associated with a chapter node; falling back to story order')
  }

  const previousNodes = currentNodeId ? getChapterNodesBeforeNode(nodes, currentNodeId) : []

  if (!forceMissingSummaries) {
    const missingSummaries = previousNodes.filter((node) => {
      const includeSetting = node.includeInFull ?? 1
      if (includeSetting === 0 || includeSetting === 2) {
        return false
      }

      const nodeMessages = messages.filter((msg) => msg.nodeId === node.id && msg.role === 'assistant' && !msg.isQuery)

      return nodeMessages.length > 0 && !node.summary
    })

    if (missingSummaries.length > 0) {
      const missingTitles = missingSummaries.map((node) => node.title).join(', ')
      throw new Error(
        `Cannot generate story continuation. The following previous nodes need summaries first: ${missingTitles}`,
      )
    }
  }

  const scriptData = executeScriptsUpToMessage(messages, messageId, story.globalScript || undefined)

  const protagonistName = characters.find((char) => char.isProtagonist)?.name || null
  const systemPrompt = buildStorySystemPrompt(
    story.storySetting || '',
    story.person,
    story.tense,
    protagonistName,
    paragraphsPerTurn ?? null,
  )

  const chatMessages: Array<{
    role: 'system' | 'assistant' | 'user'
    content: string
  }> = [{ role: 'system', content: systemPrompt }]

  const includeFullIds = new Set(includeChaptersInFull)

  for (const node of previousNodes) {
    const includeSetting = node.includeInFull ?? 1
    if (includeSetting === 0 && !includeFullIds.has(node.id)) {
      continue
    }

    const nodeMessages = messages.filter((msg) => msg.nodeId === node.id && msg.role === 'assistant' && !msg.isQuery)

    const shouldIncludeFull = includeSetting === 2 || includeFullIds.has(node.id)

    if (shouldIncludeFull && nodeMessages.length > 0) {
      chatMessages.push({
        role: 'assistant',
        content: `[Chapter: ${node.title} - Full Content]`,
      })

      for (const msg of nodeMessages) {
        chatMessages.push({
          role: 'assistant',
          content: msg.content,
        })
      }
    } else if (node.summary) {
      chatMessages.push({
        role: 'assistant',
        content: `[Chapter: ${node.title}]\n${node.summary}`,
      })
    }
  }

  if (currentNode) {
    const currentMessages = messages.filter(
      (msg) => msg.nodeId === currentNode.id && msg.role === 'assistant' && !msg.isQuery,
    )

    currentMessages.forEach((msg, index) => {
      const content = applySummarization(msg, index + 1, currentMessages.length)
      if (content.trim()) {
        chatMessages.push({
          role: 'assistant',
          content,
        })
      }
    })
  } else {
    const storyMessages = messages.filter((msg) => msg.role === 'assistant' && !msg.isQuery)

    storyMessages.forEach((msg, index) => {
      const content = applySummarization(msg, index + 1, storyMessages.length)
      if (content.trim()) {
        chatMessages.push({
          role: 'assistant',
          content,
        })
      }
    })
  }

  const activeCharacterIds = currentNode ? parseIdArray(currentNode.activeCharacterIds) : []
  const activeContextItemIds = currentNode ? parseIdArray(currentNode.activeContextItemIds) : []

  const characterPool =
    activeCharacterIds.length > 0 ? characters.filter((char) => activeCharacterIds.includes(char.id)) : characters

  const characterContext = characterPool
    .map((char) => {
      const description = char.description ? evaluateTemplate(char.description, scriptData) : char.description
      return `${char.name}: ${description || 'No description'}`
    })
    .join('\n')

  const contextItemsText = contextItems
    .filter((item) => item.isGlobal || activeContextItemIds.includes(item.id))
    .map((item) => {
      const description = item.description ? evaluateTemplate(item.description, scriptData) : item.description
      return `${item.name}: ${description || 'No description'}`
    })
    .join('\n')

  const combinedContext = [characterContext, contextItemsText].filter(Boolean).join('\n')

  if (combinedContext) {
    chatMessages.push({
      role: 'user',
      content: `Active story context:\n${combinedContext}`,
    })
  }

  const continueOrBegin =
    messages.filter((msg) => msg.role === 'assistant' && !msg.isQuery).length === 0 ? 'Begin' : 'Continue'

  chatMessages.push({
    role: 'user',
    content: `User direction: ${inputText}\n\n${continueOrBegin} the story directly below (no labels or formatting):`,
  })

  return {
    messages: chatMessages,
    metadata: {
      messageCount: chatMessages.length,
      currentNode: currentNode?.title,
      charactersIncluded: characterPool.length,
      contextItemsIncluded: contextItems.filter((item) => item.isGlobal || activeContextItemIds.includes(item.id))
        .length,
      chaptersIncludedInFull: Array.from(includeFullIds),
      branchChoices: story.branchChoices,
    },
  }
}

export const storyOperations = {
  listStories,
  getStory,
  createStory,
  searchStories,
  updateStory,
  getNodes,
  createNode,
  updateNode,
  deleteNode,
  searchMessages,
  getMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  replaceInMessage,
  getCharacter,
  getCharacters,
  getCharactersAtPoint,
  getGenerationContext,
}
