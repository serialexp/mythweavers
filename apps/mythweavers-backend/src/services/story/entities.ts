/**
 * Characters and context items — the story "bible" entities.
 *
 * Both are flat, story-scoped records with a name and a pile of optional text
 * fields, so they share one create/update path. Unlike nodes there is no
 * hierarchy to derive anything from, so the kind is explicit.
 *
 * Neither table has a soft-delete column, so removal here is a real delete.
 */

import { prisma } from '../../lib/prisma.js'
import { badRequest, notFound } from './errors.js'
import { requireStory } from './resolve.js'

export type EntityKind = 'character' | 'contextItem'

export const ENTITY_KINDS: EntityKind[] = ['character', 'contextItem']

const CHARACTER_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'nickname',
  'description',
  'background',
  'personality',
  'personalityQuirks',
  'likes',
  'dislikes',
  'age',
  'gender',
  'sexualOrientation',
  'height',
  'hairColor',
  'eyeColor',
  'distinguishingFeatures',
  'writingStyle',
  'isMainCharacter',
  'laterVersionOfId',
  'birthdate',
] as const

const CONTEXT_ITEM_FIELDS = ['type', 'name', 'description', 'isGlobal'] as const

export const ENTITY_FIELDS: Record<EntityKind, readonly string[]> = {
  character: CHARACTER_FIELDS,
  contextItem: CONTEXT_ITEM_FIELDS,
}

const CONTEXT_ITEM_TYPES = ['theme', 'location', 'plot'] as const

export interface UpsertEntityInput {
  storyId: string
  kind: EntityKind
  /** Omit to create; supply to update an existing entity. */
  id?: string
  [field: string]: unknown
}

export interface EntityResult {
  kind: EntityKind
  id: string
  name: string
  created: boolean
}

export async function upsertEntity(userId: number, input: UpsertEntityInput): Promise<EntityResult> {
  const { storyId, kind, id, ...fields } = input

  if (!ENTITY_KINDS.includes(kind)) {
    throw badRequest(`kind must be one of: ${ENTITY_KINDS.join(', ')}.`)
  }
  await requireStory(userId, storyId)

  const valid = new Set<string>(ENTITY_FIELDS[kind])
  const unknownFields = Object.keys(fields).filter((field) => !valid.has(field))
  if (unknownFields.length > 0) {
    const other = kind === 'character' ? 'contextItem' : 'character'
    const belongsElsewhere = unknownFields.filter((field) =>
      (ENTITY_FIELDS[other] as readonly string[]).includes(field),
    )
    throw badRequest(
      `Unknown field(s) for ${kind}: ${unknownFields.join(', ')}.${belongsElsewhere.length ? ` ${belongsElsewhere.join(', ')} belong(s) to ${other}.` : ''} Valid fields: ${[...valid].join(', ')}.`,
    )
  }

  return kind === 'character' ? upsertCharacter(userId, storyId, id, fields) : upsertContextItem(storyId, id, fields)
}

async function upsertCharacter(
  userId: number,
  storyId: string,
  id: string | undefined,
  fields: Record<string, unknown>,
): Promise<EntityResult> {
  const data = normalizeCharacter(fields)
  await assertLaterVersionInStory(storyId, data.laterVersionOfId)

  if (!id) {
    if (typeof data.firstName !== 'string' || data.firstName.trim().length === 0) {
      throw badRequest('firstName is required when creating a character.')
    }
    const created = await prisma.character.create({
      data: { ...data, storyId } as Parameters<typeof prisma.character.create>[0]['data'],
    })
    return { kind: 'character', id: created.id, name: displayName(created), created: true }
  }

  const existing = await prisma.character.findFirst({
    where: { id, story: { id: storyId, ownerId: userId } },
  })
  if (!existing) {
    throw notFound(`No character "${id}" in story "${storyId}".`)
  }
  if (Object.keys(data).length === 0) {
    throw badRequest(`Nothing to update. Valid fields: ${CHARACTER_FIELDS.join(', ')}.`)
  }

  const updated = await prisma.character.update({ where: { id }, data })
  return { kind: 'character', id: updated.id, name: displayName(updated), created: false }
}

async function upsertContextItem(
  storyId: string,
  id: string | undefined,
  fields: Record<string, unknown>,
): Promise<EntityResult> {
  const data = normalizeContextItem(fields)

  if (!id) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw badRequest('name is required when creating a context item.')
    }
    if (typeof data.description !== 'string' || data.description.trim().length === 0) {
      throw badRequest('description is required when creating a context item.')
    }
    if (typeof data.type !== 'string') {
      throw badRequest(`type is required when creating a context item (${CONTEXT_ITEM_TYPES.join(', ')}).`)
    }
    const created = await prisma.contextItem.create({
      data: {
        storyId,
        type: data.type as string,
        name: data.name as string,
        description: data.description as string,
        isGlobal: (data.isGlobal as boolean) ?? false,
      },
    })
    return { kind: 'contextItem', id: created.id, name: created.name, created: true }
  }

  const existing = await prisma.contextItem.findFirst({ where: { id, storyId } })
  if (!existing) {
    throw notFound(`No context item "${id}" in story "${storyId}".`)
  }
  if (Object.keys(data).length === 0) {
    throw badRequest(`Nothing to update. Valid fields: ${CONTEXT_ITEM_FIELDS.join(', ')}.`)
  }

  const updated = await prisma.contextItem.update({ where: { id }, data })
  return { kind: 'contextItem', id: updated.id, name: updated.name, created: false }
}

export async function listEntities(userId: number, storyId: string, kind?: EntityKind) {
  await requireStory(userId, storyId)

  const [characters, contextItems] = await Promise.all([
    !kind || kind === 'character'
      ? prisma.character.findMany({
          where: { storyId },
          orderBy: [{ isMainCharacter: 'desc' }, { firstName: 'asc' }],
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            nickname: true,
            description: true,
            isMainCharacter: true,
            age: true,
            gender: true,
          },
        })
      : Promise.resolve([]),
    !kind || kind === 'contextItem'
      ? prisma.contextItem.findMany({
          where: { storyId },
          orderBy: [{ type: 'asc' }, { name: 'asc' }],
          select: { id: true, type: true, name: true, description: true, isGlobal: true },
        })
      : Promise.resolve([]),
  ])

  return { characters, contextItems }
}

export async function deleteEntity(userId: number, storyId: string, kind: EntityKind, id: string) {
  await requireStory(userId, storyId)

  if (kind === 'character') {
    const existing = await prisma.character.findFirst({ where: { id, storyId } })
    if (!existing) throw notFound(`No character "${id}" in story "${storyId}".`)
    await prisma.character.delete({ where: { id } })
    return { kind, id, name: displayName(existing) }
  }

  const existing = await prisma.contextItem.findFirst({ where: { id, storyId } })
  if (!existing) throw notFound(`No context item "${id}" in story "${storyId}".`)
  await prisma.contextItem.delete({ where: { id } })
  return { kind, id, name: existing.name }
}

/**
 * `laterVersionOfId` is a self-referencing FK, so the database will happily
 * accept a character from a *different* story — including one belonging to
 * another user. The per-kind REST route has always checked this; the service
 * has to as well, or the agent-facing surface is the way around it.
 */
async function assertLaterVersionInStory(storyId: string, laterVersionOfId: unknown): Promise<void> {
  if (laterVersionOfId === undefined || laterVersionOfId === null) return

  const previous = await prisma.character.findFirst({
    where: { id: String(laterVersionOfId), storyId },
    select: { id: true },
  })
  if (!previous) {
    throw badRequest('Previous character version not found in this story')
  }
}

function normalizeCharacter(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (key === 'height' || key === 'birthdate') {
      if (value === null) {
        out[key] = null
        continue
      }
      const numeric = Number(value)
      if (Number.isNaN(numeric)) throw badRequest(`${key} must be a number.`)
      out[key] = Math.trunc(numeric)
      continue
    }
    if (key === 'isMainCharacter') {
      out[key] = Boolean(value)
      continue
    }
    // `age` is a string column on purpose ("late thirties", "unknown").
    out[key] = value === '' ? null : value
  }
  return out
}

function normalizeContextItem(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (key === 'type') {
      if (!CONTEXT_ITEM_TYPES.includes(value as (typeof CONTEXT_ITEM_TYPES)[number])) {
        throw badRequest(`type must be one of: ${CONTEXT_ITEM_TYPES.join(', ')} (got "${String(value)}").`)
      }
      out.type = value
      continue
    }
    if (key === 'isGlobal') {
      out.isGlobal = Boolean(value)
      continue
    }
    out[key] = value
  }
  return out
}

function displayName(character: { firstName: string; lastName?: string | null; nickname?: string | null }): string {
  return (
    [character.firstName, character.lastName].filter(Boolean).join(' ') || character.nickname || character.firstName
  )
}
