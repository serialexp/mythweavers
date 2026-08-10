/**
 * Unified node create/update/move.
 *
 * Book, Arc, Chapter and Scene are four tables with heavily overlapping
 * columns, and callers almost never care which one they're touching — they
 * care about "the thing under this parent". So the kind is *derived* from the
 * parent on create, and from the node itself on update, and never passed in.
 *
 * The cost of that convenience is that field sets differ per kind (a scene has
 * a POV character, a chapter does not; a scene has no `nodeType`). Rather than
 * silently dropping fields that don't apply, this rejects them by name and
 * lists what would have been valid — a wrong field becomes one recoverable
 * error rather than a change that appears to succeed and does nothing.
 */

import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from './errors.js'
import {
  CHILD_KIND,
  CHILD_LABEL,
  type ContainerKind,
  type NodeKind,
  PARENT_FK,
  type ResolveOptions,
  delegateFor,
  requireNode,
  resolveNode,
} from './resolve.js'

/** Fields every node kind accepts. */
const COMMON_FIELDS = ['name', 'summary', 'sentenceSummary', 'paragraphSummary'] as const

/**
 * Writable fields per kind. `sortOrder` is deliberately absent — ordering goes
 * through `position`/`moveNode`, which keeps siblings contiguous. `deleted` is
 * accepted on update only (see UPDATE_ONLY_FIELDS).
 */
export const NODE_FIELDS: Record<NodeKind, readonly string[]> = {
  book: [...COMMON_FIELDS, 'nodeType', 'pages'],
  arc: [...COMMON_FIELDS, 'nodeType'],
  chapter: [...COMMON_FIELDS, 'nodeType', 'status'],
  scene: [
    ...COMMON_FIELDS,
    'status',
    'includeInFull',
    'perspective',
    'viewpointCharacterId',
    'activeCharacterIds',
    'activeContextItemIds',
    'goal',
    'storyTime',
  ],
}

const UPDATE_ONLY_FIELDS = ['deleted'] as const

/**
 * Fields the first-party per-kind REST routes may write, but the agent-facing
 * surface (`/my/nodes`, the MCP tools) may not.
 *
 * These are all things a caller can only sensibly set if it already knows the
 * concrete kind and has state the agent doesn't: an explicit `sortOrder` from a
 * drag-and-drop reorder, a file id from an upload, publishing metadata owned by
 * the publishing flow. Exposing them on the derived-kind surface would mean an
 * agent could renumber siblings into collisions or set a Royal Road id, so they
 * are gated behind `trusted` rather than added to NODE_FIELDS.
 */
export const TRUSTED_NODE_FIELDS: Record<NodeKind, readonly string[]> = {
  book: ['sortOrder', 'coverArtFileId'],
  arc: ['sortOrder'],
  chapter: ['sortOrder', 'publishedOn', 'royalRoadId'],
  scene: ['sortOrder', 'summarySegments'],
}

export interface NodeWriteOptions {
  /**
   * Allow TRUSTED_NODE_FIELDS. Set only by the per-kind routes, which have
   * already validated these against their own strict Zod bodies. Never set by
   * /my/nodes or the MCP tools.
   */
  trusted?: boolean
  /**
   * Assert the derived kind. `/my/stories/:id/books` must create a *book*, so
   * if the caller passes an arc id as the story id we want a clear error rather
   * than a silently-created chapter.
   */
  expectKind?: NodeKind
}

/** Which kinds a field belongs to, for the "you probably meant" hint. */
const FIELD_OWNERS: Map<string, NodeKind[]> = (() => {
  const map = new Map<string, NodeKind[]>()
  for (const [kind, fields] of Object.entries(NODE_FIELDS) as Array<[NodeKind, readonly string[]]>) {
    for (const field of fields) {
      map.set(field, [...(map.get(field) ?? []), kind])
    }
  }
  return map
})()

export type Position = 'start' | 'end' | number

export interface CreateNodeInput {
  /** Story, book, arc or chapter. The child kind follows from this. */
  parentId: string
  name: string
  /** Optional client-supplied cuid, so callers can reference it immediately. */
  id?: string
  position?: Position
  [field: string]: unknown
}

export interface UpdateNodeInput {
  [field: string]: unknown
}

export interface NodeResult {
  kind: NodeKind
  id: string
  name: string
  parentId: string
  sortOrder: number
  storyId: string
}

/**
 * Create a node under `parentId`. The kind is whatever that parent contains:
 * story→book, book→arc, arc→chapter, chapter→scene.
 */
export async function createNode(
  userId: number,
  input: CreateNodeInput,
  options: NodeWriteOptions = {},
): Promise<NodeResult> {
  const { parentId, name, id, position, ...fields } = input

  if (!parentId) {
    throw badRequest('parentId is required — the node kind is derived from what the parent contains.')
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw badRequest('name is required and must be a non-empty string.')
  }

  // With expectKind the caller is a per-kind route, so the parent kind is known
  // up front and "Story not found" beats the resolver's generic message.
  const parent = options.expectKind
    ? await requireNodeLabelled(userId, parentId, PARENT_KIND[options.expectKind])
    : await requireNode(userId, parentId)
  const kind = CHILD_KIND[parent.kind]

  if (!kind) {
    throw badRequest(
      `A scene cannot contain child nodes — it holds prose. To add text to scene "${parent.name}" use the prose editing tool instead.`,
    )
  }

  if (options.expectKind && kind !== options.expectKind) {
    throw notFound(
      `Expected a parent containing ${options.expectKind}s, but "${parentId}" is ${article(parent.kind)} ` +
        `("${parent.name}"), which contains ${CHILD_LABEL[parent.kind]}s.`,
    )
  }

  assertFieldsValid(kind, fields, parent, { trusted: options.trusted })

  // Always append, then move if a specific position was asked for. Inserting
  // directly would need the same sibling renumber that moveNode already does.
  // A trusted caller may pin sortOrder outright, which is how the per-kind
  // routes replay an explicit ordering from the editor.
  const sortOrder = fields.sortOrder === undefined ? await nextSortOrder(kind, parentId) : Number(fields.sortOrder)

  const data: Record<string, unknown> = {
    ...(id ? { id } : {}),
    name: name.trim(),
    sortOrder,
    [PARENT_FK[kind]]: parentId,
    ...normalizeFields(fields),
  }

  // The four delegates have structurally different generated types, so a
  // kind-generic call needs the cast. Field validity is enforced above.
  const delegate = delegateFor(kind) as unknown as {
    create: (args: { data: unknown }) => Promise<Record<string, unknown>>
  }
  const created = await delegate.create({ data })

  if (position !== undefined && position !== 'end') {
    return moveNode(userId, created.id as string, { position: position as Position })
  }

  return {
    kind,
    id: created.id as string,
    name: created.name as string,
    parentId,
    sortOrder: created.sortOrder as number,
    storyId: parent.storyId,
  }
}

/**
 * Patch an existing node. Set `deleted: true` to soft-delete — the schema is
 * soft-delete throughout, so there is no separate delete operation.
 */
export async function updateNode(
  userId: number,
  nodeId: string,
  input: UpdateNodeInput,
  options: NodeWriteOptions = {},
): Promise<NodeResult> {
  const { position, ...fields } = input

  // includeDeleted so a soft-deleted node can be restored.
  const node = options.expectKind
    ? await requireNodeLabelled(userId, nodeId, options.expectKind, { includeDeleted: true })
    : await requireNode(userId, nodeId, { includeDeleted: true })

  if (node.kind === 'story') {
    throw badRequest('This updates books, arcs, chapters and scenes. Use the story endpoints to edit a story.')
  }

  if (options.expectKind && node.kind !== options.expectKind) {
    throw notFound(`Expected ${options.expectKind} "${nodeId}" but it is ${article(node.kind)} ("${node.name}").`)
  }

  const kind = node.kind as NodeKind
  assertFieldsValid(kind, fields, null, { allowUpdateOnly: true, trusted: options.trusted })

  const data: Record<string, unknown> = normalizeFields(fields)

  // Keep deletedAt consistent with the flag rather than making callers set both.
  if ('deleted' in fields) {
    data.deleted = Boolean(fields.deleted)
    data.deletedAt = fields.deleted ? new Date() : null
  }

  if (Object.keys(data).length === 0 && position === undefined) {
    throw badRequest(
      `Nothing to update. Valid fields for ${article(kind)}: ${[...NODE_FIELDS[kind], ...UPDATE_ONLY_FIELDS].join(', ')}.`,
    )
  }

  const delegate = delegateFor(kind) as unknown as {
    update: (args: { where: { id: string }; data: unknown }) => Promise<Record<string, unknown>>
  }

  const updated =
    Object.keys(data).length > 0
      ? await delegate.update({ where: { id: nodeId }, data })
      : (node.record as Record<string, unknown>)

  if (position !== undefined) {
    await moveNode(userId, nodeId, { position: position as Position })
  }

  const fresh = await requireNode(userId, nodeId, { includeDeleted: true })

  return {
    kind,
    id: nodeId,
    name: (updated.name as string) ?? fresh.name,
    parentId: fresh.parentId as string,
    sortOrder: (fresh.record.sortOrder as number) ?? 0,
    storyId: fresh.storyId,
  }
}

export interface MoveNodeInput {
  /** New parent. Must contain the same kind as the node's current parent. */
  parentId?: string
  position?: Position
}

/**
 * Move and/or reorder a node.
 *
 * `sortOrder` is a bare Int with no gap strategy, no uniqueness constraint and
 * nothing server-side that closes gaps — so a move has to renumber the whole
 * sibling list, exactly as the editor does. Both sides run in one transaction
 * so a partial renumber can't leave the tree with duplicate positions.
 */
export async function moveNode(userId: number, nodeId: string, input: MoveNodeInput): Promise<NodeResult> {
  const node = await requireNode(userId, nodeId, { includeDeleted: true })

  if (node.kind === 'story') {
    throw badRequest('A story has no parent to move it within.')
  }

  const kind = node.kind as NodeKind
  const currentParentId = node.parentId as string
  let targetParentId = currentParentId

  if (input.parentId && input.parentId !== currentParentId) {
    const newParent = await requireNode(userId, input.parentId)
    const accepts = CHILD_KIND[newParent.kind]
    if (accepts !== kind) {
      throw badRequest(
        `"${input.parentId}" is a ${newParent.kind}, which contains ${CHILD_LABEL[newParent.kind]}s, not ${kind}s.`,
      )
    }
    if (newParent.storyId !== node.storyId) {
      throw badRequest('Cannot move a node into a different story.')
    }
    targetParentId = input.parentId
  }

  const delegate = delegateFor(kind) as unknown as {
    findMany: (args: unknown) => Promise<Array<{ id: string; sortOrder: number }>>
    update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>
  }

  const siblings = await delegate.findMany({
    where: { [PARENT_FK[kind]]: targetParentId, deleted: false, NOT: { id: nodeId } },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  })

  const index = clampPosition(input.position ?? 'end', siblings.length)
  const ordered = [...siblings.map((s) => s.id)]
  ordered.splice(index, 0, nodeId)

  await prisma.$transaction(
    ordered.map((id, position) =>
      delegate.update({
        where: { id },
        data: id === nodeId ? { sortOrder: position, [PARENT_FK[kind]]: targetParentId } : { sortOrder: position },
      }),
    ) as never,
  )

  return {
    kind,
    id: nodeId,
    name: node.name,
    parentId: targetParentId,
    sortOrder: ordered.indexOf(nodeId),
    storyId: node.storyId,
  }
}

// ============================================================================
// Field validation
// ============================================================================

/**
 * Reject fields that don't exist on the derived kind, naming where they *do*
 * belong. This is the main feedback channel for a caller that guessed wrong.
 */
function assertFieldsValid(
  kind: NodeKind,
  fields: Record<string, unknown>,
  parent: { kind: ContainerKind; id: string; name: string } | null,
  options: { allowUpdateOnly?: boolean; trusted?: boolean } = {},
): void {
  const valid = new Set<string>(NODE_FIELDS[kind])
  if (options.allowUpdateOnly) {
    for (const field of UPDATE_ONLY_FIELDS) valid.add(field)
  }
  if (options.trusted) {
    for (const field of TRUSTED_NODE_FIELDS[kind]) valid.add(field)
  }

  const unknownFields = Object.keys(fields).filter((field) => !valid.has(field))
  if (unknownFields.length === 0) return

  const details = unknownFields.map((field) => {
    const owners = FIELD_OWNERS.get(field)
    if (owners && owners.length > 0) {
      return `"${field}" is only valid on ${owners.join('/')} nodes`
    }
    if ((UPDATE_ONLY_FIELDS as readonly string[]).includes(field)) {
      return `"${field}" can only be set when updating an existing node`
    }
    return `"${field}" is not a node field`
  })

  const context = parent
    ? ` You are creating ${article(kind)} under ${parent.kind} "${parent.name}" (${parent.id}).`
    : ` This node is ${article(kind)}.`

  throw badRequest(`${details.join('; ')}.${context} Valid fields for ${article(kind)}: ${[...valid].join(', ')}.`)
}

/** Which container holds a given kind — the inverse of CHILD_KIND. */
const PARENT_KIND: Record<NodeKind, ContainerKind> = {
  book: 'story',
  arc: 'book',
  chapter: 'arc',
  scene: 'chapter',
}

/**
 * requireNode with a caller-supplied noun in the 404.
 *
 * The generic resolver can't know which of the five tables the caller meant, so
 * it lists all of them. A per-kind route does know, and "Book not found" is
 * both clearer and the message its clients already handle.
 */
async function requireNodeLabelled(userId: number, id: string, expected: ContainerKind, options: ResolveOptions = {}) {
  const resolved = await resolveNode(userId, id, options)
  if (!resolved) {
    throw notFound(`${expected.charAt(0).toUpperCase()}${expected.slice(1)} not found`)
  }
  return resolved
}

/** "an arc" / "a chapter" — the messages read as prose to whoever gets them. */
function article(kind: ContainerKind): string {
  return `${'aeiou'.includes(kind[0]) ? 'an' : 'a'} ${kind}`
}

/**
 * Coerce the handful of fields whose stored representation differs from the
 * obvious input, and normalise empty strings to null so clearing a field works.
 */
function normalizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (key === 'deleted') continue // handled by the caller alongside deletedAt

    if (key === 'name' && typeof value === 'string') {
      out.name = value.trim()
      continue
    }

    if (key === 'perspective' && typeof value === 'string') {
      const upper = value.toUpperCase()
      if (!['FIRST', 'SECOND', 'THIRD'].includes(upper)) {
        throw badRequest(`perspective must be FIRST, SECOND or THIRD (got "${value}").`)
      }
      out.perspective = upper
      continue
    }

    if (key === 'includeInFull') {
      const numeric = Number(value)
      if (![0, 1, 2].includes(numeric)) {
        throw badRequest('includeInFull must be 0 (excluded), 1 (summary only) or 2 (full content).')
      }
      out.includeInFull = numeric
      continue
    }

    if (key === 'nodeType' && typeof value === 'string') {
      if (!['story', 'non-story', 'context'].includes(value)) {
        throw badRequest(`nodeType must be "story", "non-story" or "context" (got "${value}").`)
      }
      out.nodeType = value
      continue
    }

    // Trusted-only, but normalised here so the chapter route doesn't have to.
    if (key === 'publishedOn' && typeof value === 'string') {
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) {
        throw badRequest(`publishedOn must be a valid date (got "${value}").`)
      }
      out.publishedOn = parsed
      continue
    }

    if ((key === 'activeCharacterIds' || key === 'activeContextItemIds') && value !== null) {
      if (!Array.isArray(value)) {
        throw badRequest(`${key} must be an array of ids.`)
      }
      out[key] = value
      continue
    }

    out[key] = value === '' ? null : value
  }

  return out
}

/**
 * Next free sortOrder within a parent. Matches what the existing per-kind
 * create routes do (max + 1, or 0 when the parent is empty).
 */
async function nextSortOrder(kind: NodeKind, parentId: string): Promise<number> {
  const delegate = delegateFor(kind) as {
    findFirst: (args: unknown) => Promise<{ sortOrder: number } | null>
  }

  const last = await delegate.findFirst({
    where: { [PARENT_FK[kind]]: parentId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  return last ? last.sortOrder + 1 : 0
}

function clampPosition(position: Position, length: number): number {
  if (position === 'start') return 0
  if (position === 'end') return length
  const numeric = Math.trunc(Number(position))
  if (Number.isNaN(numeric)) {
    throw badRequest('position must be "start", "end" or a 0-based index.')
  }
  return Math.min(Math.max(numeric, 0), length)
}

/** Look up a node for callers that only need to confirm it exists. */
export async function getNode(userId: number, nodeId: string) {
  const node = await requireNode(userId, nodeId, { includeDeleted: true })
  if (node.kind === 'story') {
    throw notFound(`"${nodeId}" is a story, not a node.`)
  }
  return node
}
