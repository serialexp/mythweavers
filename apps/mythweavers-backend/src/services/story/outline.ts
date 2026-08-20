/**
 * Story outline: a cheap, depth-limited view of the story tree.
 *
 * The only bulk read that existed before this was `GET /my/stories/:id/load-story`,
 * which returns every paragraph body in the story (2-12 MB for a novel). That is
 * right for the editor, which hydrates a client store once, and badly wrong for
 * anything that just wants to know what chapters exist. Walking the per-level
 * list endpoints instead costs 1 + books + arcs + chapters requests.
 *
 * This does it in at most four flat queries and assembles the tree in memory.
 */

import { prisma } from '../../lib/prisma.js'
import { badRequest } from './errors.js'
import { type ContainerKind, type NodeKind, requireNode, requireStory } from './resolve.js'

export type OutlineDepth = NodeKind

const DEPTH_ORDER: NodeKind[] = ['book', 'arc', 'chapter', 'scene']

export interface OutlineOptions {
  /** Limit the tree to a subtree rooted at this node. */
  rootId?: string
  /** Deepest kind to include. Defaults to 'chapter' — scenes are opt-in. */
  depth?: OutlineDepth
  /** Include the one-line/paragraph/full summaries on each node. */
  includeSummaries?: boolean
  /** Include scene POV, goal and context-inclusion flags. */
  includeSceneDetail?: boolean
}

export interface OutlineNode {
  kind: NodeKind
  id: string
  name: string
  sortOrder: number
  status?: string | null
  /**
   * Cached word count. Only chapters store one; book and arc totals are summed
   * from their chapters. Scenes are omitted — there is no cached per-scene
   * count and computing one means reading every paragraph body.
   */
  wordCount?: number
  summary?: string | null
  sentenceSummary?: string | null
  paragraphSummary?: string | null
  perspective?: string | null
  viewpointCharacterId?: string | null
  goal?: string | null
  includeInFull?: number
  /** True when a scene contains at least one current branch message. */
  hasBranches?: boolean
  publishedAt?: string | null
  children?: OutlineNode[]
}

export interface StoryOutline {
  storyId: string
  storyName: string
  root: { kind: ContainerKind; id: string; name: string }
  depth: OutlineDepth
  totalWords: number
  counts: Record<NodeKind, number>
  nodes: OutlineNode[]
}

/**
 * Build the outline for a story, optionally scoped to a subtree.
 *
 * `rootId` may name any node in the story; the returned tree starts at that
 * node's children. Requesting a depth shallower than the root's own kind is a
 * usage error rather than an empty result, since it almost always means the
 * caller mixed up the two.
 */
export async function getOutline(
  userId: number,
  storyIdOrRootId: string,
  options: OutlineOptions = {},
): Promise<StoryOutline> {
  const depth: OutlineDepth = options.depth ?? 'chapter'

  // Resolve the root first — it can be the story itself or any node inside it.
  let storyId: string
  let root: { kind: ContainerKind; id: string; name: string }
  let rootKind: ContainerKind

  if (options.rootId) {
    const resolved = await requireNode(userId, options.rootId)
    storyId = resolved.storyId
    root = { kind: resolved.kind, id: resolved.id, name: resolved.name }
    rootKind = resolved.kind
    if (storyIdOrRootId && storyIdOrRootId !== storyId && storyIdOrRootId !== resolved.id) {
      throw badRequest(`Node "${options.rootId}" belongs to story "${storyId}", not "${storyIdOrRootId}".`)
    }
  } else {
    const resolved = await requireNode(userId, storyIdOrRootId)
    storyId = resolved.storyId
    root = { kind: resolved.kind, id: resolved.id, name: resolved.name }
    rootKind = resolved.kind
  }

  const story = await requireStory(userId, storyId)

  if (rootKind !== 'story' && DEPTH_ORDER.indexOf(depth) <= DEPTH_ORDER.indexOf(rootKind as NodeKind)) {
    throw badRequest(
      `depth "${depth}" is at or above the root, which is a ${rootKind}. ` +
        `Pick a deeper level (${DEPTH_ORDER.slice(DEPTH_ORDER.indexOf(rootKind as NodeKind) + 1).join(', ') || 'none available — scenes have no child nodes'}).`,
    )
  }

  const wantSummaries = options.includeSummaries ?? false
  const wantSceneDetail = options.includeSceneDetail ?? false
  const maxDepth = DEPTH_ORDER.indexOf(depth)

  // Common column set. Summaries are large enough on a long story that pulling
  // them unconditionally would defeat the point of a lightweight outline.
  const summaryCols = wantSummaries ? { summary: true, sentenceSummary: true, paragraphSummary: true } : {}

  // Scope each level to the requested subtree. When the root is a node rather
  // than the story, we only need that node's descendants.
  const bookWhere: Record<string, unknown> = { storyId, deleted: false }
  const arcWhere: Record<string, unknown> = { book: { storyId }, deleted: false }
  const chapterWhere: Record<string, unknown> = { arc: { book: { storyId } }, deleted: false }
  const sceneWhere: Record<string, unknown> = {
    chapter: { arc: { book: { storyId } } },
    deleted: false,
  }

  if (rootKind === 'book') {
    bookWhere.id = root.id
    arcWhere.bookId = root.id
    chapterWhere.arc = { bookId: root.id }
    sceneWhere.chapter = { arc: { bookId: root.id } }
  } else if (rootKind === 'arc') {
    arcWhere.id = root.id
    chapterWhere.arcId = root.id
    sceneWhere.chapter = { arcId: root.id }
  } else if (rootKind === 'chapter') {
    chapterWhere.id = root.id
    sceneWhere.chapterId = root.id
  } else if (rootKind === 'scene') {
    sceneWhere.id = root.id
  }

  const [books, arcs, chapters, scenes] = await Promise.all([
    maxDepth >= 0 && rootKind === 'story'
      ? prisma.book.findMany({
          where: bookWhere,
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, sortOrder: true, storyId: true, ...summaryCols },
        })
      : Promise.resolve([]),
    maxDepth >= 1 && ['story', 'book'].includes(rootKind)
      ? prisma.arc.findMany({
          where: arcWhere,
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, sortOrder: true, bookId: true, ...summaryCols },
        })
      : Promise.resolve([]),
    maxDepth >= 2 && ['story', 'book', 'arc'].includes(rootKind)
      ? prisma.chapter.findMany({
          where: chapterWhere,
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            sortOrder: true,
            arcId: true,
            status: true,
            wordCount: true,
            publishedAt: true,
            ...summaryCols,
          },
        })
      : Promise.resolve([]),
    maxDepth >= 3
      ? prisma.scene.findMany({
          where: sceneWhere,
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            sortOrder: true,
            chapterId: true,
            status: true,
            ...(wantSceneDetail
              ? {
                  perspective: true,
                  viewpointCharacterId: true,
                  goal: true,
                  includeInFull: true,
                  _count: { select: { messages: { where: { deleted: false, type: 'branch' } } } },
                }
              : {}),
            ...summaryCols,
          },
        })
      : Promise.resolve([]),
  ])

  // Assemble bottom-up so each level can carry its children's word totals.
  const scenesByChapter = new Map<string, OutlineNode[]>()
  for (const scene of scenes as Array<Record<string, any>>) {
    const node: OutlineNode = {
      kind: 'scene',
      id: scene.id,
      name: scene.name,
      sortOrder: scene.sortOrder,
      status: scene.status,
      ...(wantSummaries
        ? {
            summary: scene.summary,
            sentenceSummary: scene.sentenceSummary,
            paragraphSummary: scene.paragraphSummary,
          }
        : {}),
      ...(wantSceneDetail
        ? {
            perspective: scene.perspective,
            viewpointCharacterId: scene.viewpointCharacterId,
            goal: scene.goal,
            includeInFull: scene.includeInFull,
            hasBranches: scene._count.messages > 0,
          }
        : {}),
    }
    const list = scenesByChapter.get(scene.chapterId)
    if (list) list.push(node)
    else scenesByChapter.set(scene.chapterId, [node])
  }

  const chaptersByArc = new Map<string, OutlineNode[]>()
  for (const chapter of chapters as Array<Record<string, any>>) {
    const node: OutlineNode = {
      kind: 'chapter',
      id: chapter.id,
      name: chapter.name,
      sortOrder: chapter.sortOrder,
      status: chapter.status,
      wordCount: chapter.wordCount,
      publishedAt: chapter.publishedAt ? chapter.publishedAt.toISOString() : null,
      ...(wantSummaries
        ? {
            summary: chapter.summary,
            sentenceSummary: chapter.sentenceSummary,
            paragraphSummary: chapter.paragraphSummary,
          }
        : {}),
      ...(maxDepth >= 3 ? { children: scenesByChapter.get(chapter.id) ?? [] } : {}),
    }
    const list = chaptersByArc.get(chapter.arcId)
    if (list) list.push(node)
    else chaptersByArc.set(chapter.arcId, [node])
  }

  const arcsByBook = new Map<string, OutlineNode[]>()
  for (const arc of arcs as Array<Record<string, any>>) {
    const children = chaptersByArc.get(arc.id) ?? []
    const node: OutlineNode = {
      kind: 'arc',
      id: arc.id,
      name: arc.name,
      sortOrder: arc.sortOrder,
      wordCount: sumWords(children),
      ...(wantSummaries
        ? { summary: arc.summary, sentenceSummary: arc.sentenceSummary, paragraphSummary: arc.paragraphSummary }
        : {}),
      ...(maxDepth >= 2 ? { children } : {}),
    }
    const list = arcsByBook.get(arc.bookId)
    if (list) list.push(node)
    else arcsByBook.set(arc.bookId, [node])
  }

  const bookNodes: OutlineNode[] = (books as Array<Record<string, any>>).map((book) => {
    const children = arcsByBook.get(book.id) ?? []
    return {
      kind: 'book',
      id: book.id,
      name: book.name,
      sortOrder: book.sortOrder,
      wordCount: sumWords(children),
      ...(wantSummaries
        ? {
            summary: book.summary,
            sentenceSummary: book.sentenceSummary,
            paragraphSummary: book.paragraphSummary,
          }
        : {}),
      ...(maxDepth >= 1 ? { children } : {}),
    }
  })

  // The returned top level depends on where the root sits.
  let nodes: OutlineNode[]
  switch (rootKind) {
    case 'story':
      nodes = bookNodes
      break
    case 'book':
      nodes = arcsByBook.get(root.id) ?? []
      break
    case 'arc':
      nodes = chaptersByArc.get(root.id) ?? []
      break
    case 'chapter':
      nodes = scenesByChapter.get(root.id) ?? []
      break
    default:
      nodes = []
  }

  return {
    storyId,
    storyName: story.name,
    root,
    depth,
    totalWords: (chapters as Array<Record<string, any>>).reduce((sum, c) => sum + (c.wordCount ?? 0), 0),
    counts: {
      book: books.length,
      arc: arcs.length,
      chapter: chapters.length,
      scene: scenes.length,
    },
    nodes,
  }
}

function sumWords(nodes: OutlineNode[]): number {
  return nodes.reduce((sum, node) => sum + (node.wordCount ?? 0), 0)
}

export interface FlatOutlineNode extends Omit<OutlineNode, 'children'> {
  parentId: string | null
  depth: number
}

/**
 * Depth-first flattening of an outline tree.
 *
 * The nested shape is what you want for rendering; the flat shape is what you
 * want over the wire, because a recursive Zod schema either breaks OpenAPI
 * generation or degrades to `any` in the generated client. Callers that want
 * the tree back can rebuild it from `parentId` in a few lines.
 */
export function flattenOutline(nodes: OutlineNode[], parentId: string | null = null, depth = 0): FlatOutlineNode[] {
  const out: FlatOutlineNode[] = []
  for (const node of nodes) {
    const { children, ...rest } = node
    out.push({ ...rest, parentId, depth })
    if (children?.length) {
      out.push(...flattenOutline(children, node.id, depth + 1))
    }
  }
  return out
}

/** Stories the user owns, for the "which story?" case. */
export async function listStories(userId: number) {
  const stories = await prisma.story.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      summary: true,
      status: true,
      type: true,
      updatedAt: true,
    },
  })
  return stories.map((story) => ({
    ...story,
    updatedAt: story.updatedAt.toISOString(),
  }))
}
