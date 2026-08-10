/**
 * Batched prose editing.
 *
 * All edits in one call run inside a single transaction: either every edit
 * lands or none does. A half-applied rewrite is much worse than a rejected
 * one, because the caller has no way to tell which half succeeded.
 *
 * Concurrency note: the backend enforces no optimistic concurrency anywhere —
 * `saveService` on the client tracks `lastKnownUpdatedAt` and has full 409
 * handling, but no endpoint has ever returned a 409, so that path is dead. An
 * open editor tab holds its own copy of the story and will PATCH from it. To
 * stop an agent silently overwriting an edit made in the last few seconds,
 * `replace` requires an `expect` prefix of the text it believes it is
 * replacing. The caller has just read the paragraph, so this costs nothing,
 * and it turns a silent clobber into a recoverable error.
 */

import type { ParagraphState } from '@prisma/client'
import { recalculateChapterWordCount } from '../../lib/chapterWordCount.js'
import { createParagraphsBulk } from '../../lib/paragraphHelpers.js'
import { prisma } from '../../lib/prisma.js'
import { badRequest, conflict, notFound } from './errors.js'

export type ProseEdit =
  | { op: 'replace'; paragraphId: string; text: string; expect: string; state?: string }
  | { op: 'insert_after'; paragraphId: string; text: string; state?: string }
  | { op: 'insert_before'; paragraphId: string; text: string; state?: string }
  | { op: 'append'; sceneId: string; text: string; state?: string }
  | { op: 'delete'; paragraphId: string; expect?: string }

export interface ProseEditResult {
  applied: number
  created: string[]
  updated: string[]
  deleted: string[]
  chaptersRecounted: string[]
}

/** How many characters of `expect` must match before we accept a replace. */
const EXPECT_MIN_CHARS = 8

export async function applyProseEdits(userId: number, edits: ProseEdit[]): Promise<ProseEditResult> {
  if (!Array.isArray(edits) || edits.length === 0) {
    throw badRequest('Provide at least one edit.')
  }

  // Resolve and ownership-check everything up front so a bad id fails before
  // any write happens, and the error can name the offending edit.
  const paragraphIds = new Set<string>()
  const sceneIds = new Set<string>()
  for (const edit of edits) {
    if ('paragraphId' in edit) paragraphIds.add(edit.paragraphId)
    if ('sceneId' in edit) sceneIds.add(edit.sceneId)
  }

  const [paragraphs, scenes] = await Promise.all([
    paragraphIds.size
      ? prisma.paragraph.findMany({
          where: {
            id: { in: [...paragraphIds] },
            messageRevision: {
              message: { scene: { chapter: { arc: { book: { story: { ownerId: userId } } } } } },
            },
          },
          select: {
            id: true,
            sortOrder: true,
            messageRevisionId: true,
            currentParagraphRevision: { select: { body: true, version: true, state: true } },
            messageRevision: {
              select: {
                id: true,
                message: { select: { id: true, sceneId: true, scene: { select: { chapterId: true } } } },
              },
            },
          },
        })
      : Promise.resolve([]),
    sceneIds.size
      ? prisma.scene.findMany({
          where: {
            id: { in: [...sceneIds] },
            deleted: false,
            chapter: { arc: { book: { story: { ownerId: userId } } } },
          },
          select: { id: true, chapterId: true },
        })
      : Promise.resolve([]),
  ])

  const paragraphById = new Map(paragraphs.map((p) => [p.id, p]))
  const sceneById = new Map(scenes.map((s) => [s.id, s]))

  edits.forEach((edit, index) => {
    if ('paragraphId' in edit && !paragraphById.has(edit.paragraphId)) {
      throw notFound(`Edit ${index} (${edit.op}): no paragraph "${edit.paragraphId}" in a story you own.`)
    }
    if ('sceneId' in edit && !sceneById.has(edit.sceneId)) {
      throw notFound(`Edit ${index} (${edit.op}): no scene "${edit.sceneId}" in a story you own.`)
    }
    if (edit.op === 'replace') {
      if (typeof edit.expect !== 'string' || edit.expect.trim().length === 0) {
        throw badRequest(
          `Edit ${index} (replace): "expect" is required — pass the opening words of the paragraph you read, so the edit fails instead of overwriting a change made since.`,
        )
      }
      const current = paragraphById.get(edit.paragraphId)?.currentParagraphRevision?.body ?? ''
      assertExpectMatches(index, edit.expect, current, edit.paragraphId)
    }
    if (edit.op === 'delete' && edit.expect) {
      const current = paragraphById.get(edit.paragraphId)?.currentParagraphRevision?.body ?? ''
      assertExpectMatches(index, edit.expect, current, edit.paragraphId)
    }
    if (edit.op !== 'delete' && (typeof edit.text !== 'string' || edit.text.trim().length === 0)) {
      throw badRequest(`Edit ${index} (${edit.op}): "text" must be a non-empty string.`)
    }
  })

  const created: string[] = []
  const updated: string[] = []
  const deleted: string[] = []
  const touchedChapters = new Set<string>()

  await prisma.$transaction(async (tx) => {
    for (const [index, edit] of edits.entries()) {
      switch (edit.op) {
        case 'replace': {
          const paragraph = paragraphById.get(edit.paragraphId)!
          const bodies = splitParagraphs(edit.text)
          if (bodies.length === 0) {
            throw badRequest(`Edit ${index} (replace): text is empty after trimming.`)
          }

          // The first block replaces in place; any extra blocks become new
          // paragraphs after it, so "split this into two" works naturally.
          const nextVersion = (paragraph.currentParagraphRevision?.version ?? 0) + 1
          const revision = await tx.paragraphRevision.create({
            data: {
              paragraphId: edit.paragraphId,
              version: nextVersion,
              body: bodies[0],
              state: (edit.state as ParagraphState) ?? paragraph.currentParagraphRevision?.state ?? null,
            },
          })
          await tx.paragraph.update({
            where: { id: edit.paragraphId },
            data: { currentParagraphRevisionId: revision.id },
          })
          updated.push(edit.paragraphId)

          if (bodies.length > 1) {
            const ids = await insertParagraphs(
              tx,
              paragraph.messageRevisionId,
              paragraph.sortOrder,
              bodies.slice(1),
              edit.state,
            )
            created.push(...ids)
          }

          touchedChapters.add(paragraph.messageRevision.message.scene.chapterId)
          break
        }

        case 'insert_after':
        case 'insert_before': {
          const paragraph = paragraphById.get(edit.paragraphId)!
          const bodies = splitParagraphs(edit.text)
          const anchor = edit.op === 'insert_after' ? paragraph.sortOrder : paragraph.sortOrder - 1
          const ids = await insertParagraphs(tx, paragraph.messageRevisionId, anchor, bodies, edit.state)
          created.push(...ids)
          touchedChapters.add(paragraph.messageRevision.message.scene.chapterId)
          break
        }

        case 'append': {
          const scene = sceneById.get(edit.sceneId)!
          const bodies = splitParagraphs(edit.text)

          const lastMessage = await tx.message.findFirst({
            where: { sceneId: edit.sceneId, deleted: false },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          })

          const message = await tx.message.create({
            data: {
              sceneId: edit.sceneId,
              sortOrder: lastMessage ? lastMessage.sortOrder + 1 : 0,
            },
          })
          const revision = await tx.messageRevision.create({
            data: { messageId: message.id, version: 1, versionType: 'cli_edit' },
          })
          await tx.message.update({
            where: { id: message.id },
            data: { currentMessageRevisionId: revision.id },
          })

          const ids = await createParagraphsBulk(
            tx,
            revision.id,
            bodies.map((body, order) => ({ body, sortOrder: order, state: edit.state ?? null })),
          )
          created.push(...ids)
          touchedChapters.add(scene.chapterId)
          break
        }

        case 'delete': {
          const paragraph = paragraphById.get(edit.paragraphId)!
          // Paragraph has no soft-delete column, so this is a real delete.
          // Revisions cascade; the prose itself survives in the message's
          // earlier revisions.
          await tx.paragraph.delete({ where: { id: edit.paragraphId } })
          deleted.push(edit.paragraphId)
          touchedChapters.add(paragraph.messageRevision.message.scene.chapterId)
          break
        }

        default: {
          const unknown = edit as { op?: string }
          throw badRequest(
            `Edit ${index}: unknown op "${unknown.op}". Valid ops: replace, insert_after, insert_before, append, delete.`,
          )
        }
      }
    }
  })

  // Word counts are a cached approximation maintained outside the transaction,
  // matching how the existing paragraph routes do it.
  for (const chapterId of touchedChapters) {
    await recalculateChapterWordCount(chapterId)
  }

  return {
    applied: edits.length,
    created,
    updated,
    deleted,
    chaptersRecounted: [...touchedChapters],
  }
}

/**
 * Insert paragraphs into a message revision immediately after `afterSortOrder`,
 * shifting everything below them down.
 */
async function insertParagraphs(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  messageRevisionId: string,
  afterSortOrder: number,
  bodies: string[],
  state?: string,
): Promise<string[]> {
  if (bodies.length === 0) return []

  await tx.paragraph.updateMany({
    where: { messageRevisionId, sortOrder: { gt: afterSortOrder } },
    data: { sortOrder: { increment: bodies.length } },
  })

  return createParagraphsBulk(
    tx,
    messageRevisionId,
    bodies.map((body, offset) => ({
      body,
      sortOrder: afterSortOrder + 1 + offset,
      state: state ?? null,
    })),
  )
}

/**
 * Split incoming text into paragraph bodies on blank lines, so a caller can
 * write several paragraphs in one edit without knowing how they're stored.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
}

/**
 * Verify the caller is editing the text it thinks it is.
 *
 * Compares tag-stripped, whitespace-collapsed text so a formatting-only
 * difference doesn't trip the guard — the point is catching "someone rewrote
 * this paragraph since you read it", not byte-level equality.
 */
function assertExpectMatches(index: number, expect: string, current: string, paragraphId: string): void {
  const normalizedExpect = normalize(expect)
  const normalizedCurrent = normalize(current)

  if (normalizedExpect.length < EXPECT_MIN_CHARS && normalizedExpect.length < normalizedCurrent.length) {
    throw badRequest(
      `Edit ${index}: "expect" is too short to be a meaningful guard — ` +
        `give at least ${EXPECT_MIN_CHARS} characters of the paragraph you read.`,
    )
  }

  if (!normalizedCurrent.startsWith(normalizedExpect)) {
    throw conflict(
      `Edit ${index}: paragraph "${paragraphId}" does not start with the expected text, so it changed since you read it. Re-read the scene and retry.\n  expected: ${truncate(normalizedExpect)}\n  actual:   ${truncate(normalizedCurrent)}`,
    )
  }
}

function normalize(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value: string, length = 80): string {
  return value.length > length ? `${value.slice(0, length)}…` : value
}
