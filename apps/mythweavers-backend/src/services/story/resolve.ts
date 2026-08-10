/**
 * Node resolution: turn a bare cuid into "what kind of thing is this, who owns
 * it, and where does it sit in the hierarchy".
 *
 * The story hierarchy lives in four sibling tables (Book/Arc/Chapter/Scene)
 * rather than one polymorphic table, so every caller that wants to act on "a
 * node" has to work out which table it came from. Until now that logic was
 * inlined per handler — routes/my/paragraphs.ts repeats the six-level
 * `messageRevision.message.scene.chapter.arc.book.story.ownerId` chain six
 * separate times. This module is the single place that knows the shape.
 *
 * It also underpins parent-derived node creation: given a parent id we can
 * derive the child kind from CHILD_KIND rather than making the caller state it.
 */

import { prisma } from '../../lib/prisma.js'
import { notFound } from './errors.js'

/** The four tables that make up the story tree. */
export type NodeKind = 'book' | 'arc' | 'chapter' | 'scene'

/** Anything that can contain nodes — the four kinds plus the story root. */
export type ContainerKind = 'story' | NodeKind

/**
 * What a node of each kind contains. Scenes hold messages/paragraphs rather
 * than child nodes, so they terminate the chain.
 */
export const CHILD_KIND: Record<ContainerKind, NodeKind | null> = {
  story: 'book',
  book: 'arc',
  arc: 'chapter',
  chapter: 'scene',
  scene: null,
}

export const NODE_KINDS: NodeKind[] = ['book', 'arc', 'chapter', 'scene']

/** Human-facing name for what a given container's children are called. */
export const CHILD_LABEL: Record<ContainerKind, string> = {
  story: 'book',
  book: 'arc',
  arc: 'chapter',
  chapter: 'scene',
  scene: 'nothing (scenes hold prose, not child nodes)',
}

export interface ResolvedNode {
  kind: ContainerKind
  id: string
  name: string
  /** The owning story. For kind === 'story' this equals `id`. */
  storyId: string
  /** Immediate parent id — null for a story. */
  parentId: string | null
  /** Every ancestor id that exists for this kind, keyed by kind. */
  ancestors: {
    storyId: string
    bookId?: string
    arcId?: string
    chapterId?: string
  }
  deleted: boolean
  /** The raw row, for callers that need more than the common fields. */
  record: Record<string, unknown>
}

export interface ResolveOptions {
  /**
   * Include soft-deleted nodes. Updates need this (you must be able to
   * un-delete something); creates and reads do not, since writing a child
   * into a deleted parent would silently orphan it.
   */
  includeDeleted?: boolean
}

/**
 * Resolve an id to its node kind, ownership-checked against `userId`.
 *
 * Issues one indexed primary-key lookup per candidate table in parallel. Ids
 * are cuids with no kind prefix, so there is no way to narrow this ahead of
 * time — but five PK lookups against an owner-scoped WHERE is cheap, and it
 * keeps the tool surface free of "and tell me what kind it is" parameters.
 *
 * Returns null rather than throwing so callers can produce their own message;
 * use `requireNode` when a miss is an error.
 */
export async function resolveNode(
  userId: number,
  id: string,
  options: ResolveOptions = {},
): Promise<ResolvedNode | null> {
  const includeDeleted = options.includeDeleted ?? false
  const deletedFilter = includeDeleted ? {} : { deleted: false }

  const [story, book, arc, chapter, scene] = await Promise.all([
    prisma.story.findFirst({
      where: { id, ownerId: userId },
    }),
    prisma.book.findFirst({
      where: { id, ...deletedFilter, story: { ownerId: userId } },
    }),
    prisma.arc.findFirst({
      where: { id, ...deletedFilter, book: { story: { ownerId: userId } } },
      include: { book: { select: { storyId: true } } },
    }),
    prisma.chapter.findFirst({
      where: { id, ...deletedFilter, arc: { book: { story: { ownerId: userId } } } },
      include: { arc: { select: { bookId: true, book: { select: { storyId: true } } } } },
    }),
    prisma.scene.findFirst({
      where: { id, ...deletedFilter, chapter: { arc: { book: { story: { ownerId: userId } } } } },
      include: {
        chapter: {
          select: { arcId: true, arc: { select: { bookId: true, book: { select: { storyId: true } } } } },
        },
      },
    }),
  ])

  if (story) {
    return {
      kind: 'story',
      id: story.id,
      name: story.name,
      storyId: story.id,
      parentId: null,
      ancestors: { storyId: story.id },
      deleted: false,
      record: story as unknown as Record<string, unknown>,
    }
  }

  if (book) {
    return {
      kind: 'book',
      id: book.id,
      name: book.name,
      storyId: book.storyId,
      parentId: book.storyId,
      ancestors: { storyId: book.storyId },
      deleted: book.deleted,
      record: book as unknown as Record<string, unknown>,
    }
  }

  if (arc) {
    const storyId = arc.book.storyId
    return {
      kind: 'arc',
      id: arc.id,
      name: arc.name,
      storyId,
      parentId: arc.bookId,
      ancestors: { storyId, bookId: arc.bookId },
      deleted: arc.deleted,
      record: arc as unknown as Record<string, unknown>,
    }
  }

  if (chapter) {
    const bookId = chapter.arc.bookId
    const storyId = chapter.arc.book.storyId
    return {
      kind: 'chapter',
      id: chapter.id,
      name: chapter.name,
      storyId,
      parentId: chapter.arcId,
      ancestors: { storyId, bookId, arcId: chapter.arcId },
      deleted: chapter.deleted,
      record: chapter as unknown as Record<string, unknown>,
    }
  }

  if (scene) {
    const arcId = scene.chapter.arcId
    const bookId = scene.chapter.arc.bookId
    const storyId = scene.chapter.arc.book.storyId
    return {
      kind: 'scene',
      id: scene.id,
      name: scene.name,
      storyId,
      parentId: scene.chapterId,
      ancestors: { storyId, bookId, arcId, chapterId: scene.chapterId },
      deleted: scene.deleted,
      record: scene as unknown as Record<string, unknown>,
    }
  }

  return null
}

/** resolveNode, but throws a 404 when the id is unknown or not owned. */
export async function requireNode(userId: number, id: string, options: ResolveOptions = {}): Promise<ResolvedNode> {
  const resolved = await resolveNode(userId, id, options)
  if (!resolved) {
    throw notFound(`No story, book, arc, chapter or scene found with id "${id}".`)
  }
  return resolved
}

/**
 * Resolve a node and require it to be one of `kinds`. The error names what was
 * actually found, since "wrong kind" is a mistake an agent can correct on the
 * next call given the right information.
 */
export async function requireNodeOfKind<K extends ContainerKind>(
  userId: number,
  id: string,
  kinds: readonly K[],
  options: ResolveOptions = {},
): Promise<ResolvedNode & { kind: K }> {
  const resolved = await requireNode(userId, id, options)
  if (!(kinds as readonly ContainerKind[]).includes(resolved.kind)) {
    throw notFound(`Expected ${kinds.join(' or ')} but "${id}" is a ${resolved.kind} ("${resolved.name}").`)
  }
  return resolved as ResolvedNode & { kind: K }
}

/** Throw unless `storyId` names a story owned by `userId`. */
export async function requireStory(userId: number, storyId: string) {
  const story = await prisma.story.findFirst({ where: { id: storyId, ownerId: userId } })
  if (!story) {
    throw notFound(`No story found with id "${storyId}".`)
  }
  return story
}

/**
 * Prisma `where` fragment matching nodes of `kind` belonging to `storyId`.
 * Each table sits at a different depth, so the join path differs per kind.
 */
export function storyScopeFilter(kind: NodeKind, storyId: string): Record<string, unknown> {
  switch (kind) {
    case 'book':
      return { storyId }
    case 'arc':
      return { book: { storyId } }
    case 'chapter':
      return { arc: { book: { storyId } } }
    case 'scene':
      return { chapter: { arc: { book: { storyId } } } }
  }
}

/** Prisma `where` fragment matching nodes of `kind` owned by `userId`. */
export function ownerScopeFilter(kind: NodeKind, userId: number): Record<string, unknown> {
  switch (kind) {
    case 'book':
      return { story: { ownerId: userId } }
    case 'arc':
      return { book: { story: { ownerId: userId } } }
    case 'chapter':
      return { arc: { book: { story: { ownerId: userId } } } }
    case 'scene':
      return { chapter: { arc: { book: { story: { ownerId: userId } } } } }
  }
}

/** The Prisma delegate for a node kind, so callers can stay kind-generic. */
export function delegateFor(kind: NodeKind) {
  switch (kind) {
    case 'book':
      return prisma.book
    case 'arc':
      return prisma.arc
    case 'chapter':
      return prisma.chapter
    case 'scene':
      return prisma.scene
  }
}

/** Name of the foreign key column linking a node kind to its parent. */
export const PARENT_FK: Record<NodeKind, 'storyId' | 'bookId' | 'arcId' | 'chapterId'> = {
  book: 'storyId',
  arc: 'bookId',
  chapter: 'arcId',
  scene: 'chapterId',
}
