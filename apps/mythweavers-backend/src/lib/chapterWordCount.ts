import { prisma } from './prisma.js'

/**
 * Strips HTML tags from a paragraph body and counts whitespace-separated
 * tokens. Paragraph bodies are stored as HTML (the editor serializes
 * ProseMirror to HTML), so we need to strip tags before counting.
 *
 * Cheap and good-enough: this is a cached approximation, not the source
 * of truth. If a user really cares about an exact figure they can run
 * the backfill script, or we can switch this to a proper tokenizer
 * later.
 */
export function countWordsInHtml(html: string | null | undefined): number {
  if (!html) return 0
  // Strip tags, collapse entities we care about, then split on whitespace.
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Recompute and persist the cached word count for a single chapter.
 * Walks every non-deleted scene → message → currentMessageRevision →
 * paragraph → currentParagraphRevision, summing words across their
 * bodies.
 *
 * Called from paragraph mutation endpoints so the cached value stays
 * close to reality; if it drifts, rebuild with the backfill script.
 * Silently returns 0 if the chapter doesn't exist.
 */
export async function recalculateChapterWordCount(chapterId: string): Promise<number> {
  // Pull every "current" paragraph revision body for this chapter in a
  // single query. We filter on the Paragraph join chain rather than
  // using ParagraphRevision.paragraphId because many historical
  // revisions exist per paragraph and we only want the live one.
  const paragraphs = await prisma.paragraph.findMany({
    where: {
      messageRevision: {
        // Only the paragraphs attached to the currently-selected
        // MessageRevision count — old revisions are history.
        currentRevisionFor: {
          some: {
            deleted: false,
            scene: {
              deleted: false,
              chapterId,
            },
          },
        },
      },
      currentParagraphRevisionId: { not: null },
    },
    select: {
      currentParagraphRevision: {
        select: { body: true },
      },
    },
  })

  let total = 0
  for (const p of paragraphs) {
    total += countWordsInHtml(p.currentParagraphRevision?.body)
  }

  await prisma.chapter.update({
    where: { id: chapterId },
    data: { wordCount: total },
  })

  return total
}

/**
 * Resolve chapterId for a given paragraph id. Returns null if the
 * paragraph has been deleted or doesn't exist. Used by mutation
 * endpoints that only know the paragraph id (e.g. PATCH /paragraphs/:id).
 */
export async function chapterIdForParagraph(paragraphId: string): Promise<string | null> {
  const row = await prisma.paragraph.findUnique({
    where: { id: paragraphId },
    select: {
      messageRevision: {
        select: {
          message: {
            select: { scene: { select: { chapterId: true } } },
          },
        },
      },
    },
  })
  return row?.messageRevision.message.scene.chapterId ?? null
}

/**
 * Resolve chapterId for a given messageRevision id. Used by bulk
 * paragraph creation and by the POST /paragraphs handler, which both
 * only know the parent messageRevision.
 */
export async function chapterIdForMessageRevision(messageRevisionId: string): Promise<string | null> {
  const row = await prisma.messageRevision.findUnique({
    where: { id: messageRevisionId },
    select: {
      message: {
        select: { scene: { select: { chapterId: true } } },
      },
    },
  })
  return row?.message.scene.chapterId ?? null
}
