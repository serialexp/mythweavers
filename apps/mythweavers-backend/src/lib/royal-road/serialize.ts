import { prisma } from '../prisma.js'

/**
 * Serializes a chapter's current paragraph bodies into the HTML blob that
 * gets pasted into Royal Road's TinyMCE "Source code" dialog.
 *
 * Key differences from the legacy writer implementation
 * (apps/writer-legacy-backend/src/procedures/publish-to-royal-road.ts):
 *
 *   - The legacy schema stored paragraphs as either a ProseMirror contentSchema
 *     JSON blob OR a markdown body, so it invoked `contentSchemaToHtml` and
 *     ran `markdown-it` as a fallback. In the new schema paragraph bodies
 *     are already stored as HTML (see `recalculateChapterWordCount` for the
 *     query shape), so we can concatenate them directly.
 *
 *   - Scene separators are still rendered as the R2-hosted centered divider
 *     image to match the writer's look on RR. We detect separator paragraphs
 *     by stripping tags and matching known markers (`* * *`, all-asterisk,
 *     legacy `-----` forms). Between scenes we ALWAYS insert the divider
 *     even if the scene didn't end with one — that mirrors legacy behaviour.
 *
 *   - Every paragraph is wrapped in `<p>…</p>` if it isn't already a block
 *     element. Paragraph body HTML produced by the solid-editor is usually
 *     already a `<p>`, but a pathological empty string should still round-trip
 *     cleanly.
 */

const SCENE_DIVIDER_HTML =
  '<div style="text-align: center; margin: 2em auto;">' +
  '<img style="margin: 0 auto;" src="https://pub-43e7e0f137a34d1ca1ce3be7325ba046.r2.dev/Group.png" />' +
  '</div>'

const BLOCK_TAG_RE = /^\s*<(p|div|blockquote|ul|ol|li|h[1-6]|pre|figure|table|hr)[\s>]/i

/**
 * Strip HTML tags from a body so we can test it against the separator
 * markers. Kept deliberately cheap — we already have the same approach in
 * `chapterWordCount.countWordsInHtml`.
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns true when the paragraph body is a visual scene separator that
 * should be rendered as the Royal Road divider image instead of its own
 * text. Keep this list in sync with the editor's separator detection.
 */
export function isSeparatorParagraph(html: string): boolean {
  const text = stripTags(html)
  if (!text) return false
  // Pure asterisk runs (with or without spaces) — "*", "* * *", "***".
  if (/^\*(\s*\*)*$/.test(text)) return true
  // Legacy markdown-ish separator used in the old writer.
  if (text === '----- * * * -----') return true
  // Common alternative dash separators.
  if (/^-{3,}$/.test(text)) return true
  if (/^-{3,}\s*\*+\s*-{3,}$/.test(text)) return true
  return false
}

/**
 * Wrap a paragraph body in `<p>` unless it already leads with a block element.
 */
function ensureBlock(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''
  if (BLOCK_TAG_RE.test(trimmed)) return trimmed
  return `<p>${trimmed}</p>`
}

/**
 * Serialize the given paragraph HTML bodies (already in per-scene order) to
 * a Royal-Road-ready HTML blob. Exposed separately from the DB-walking
 * helper so unit tests can exercise the rendering logic without a database.
 */
export function serializeScenesToHtml(scenes: string[][]): string {
  const renderedScenes = scenes.map((paragraphs) =>
    paragraphs
      .map((body) => {
        if (isSeparatorParagraph(body)) return SCENE_DIVIDER_HTML
        return ensureBlock(body)
      })
      .filter((x) => x.length > 0)
      .join('\n'),
  )
  return renderedScenes.filter((x) => x.length > 0).join(`\n${SCENE_DIVIDER_HTML}\n`)
}

/**
 * Load the current paragraph bodies for a chapter in scene order and return
 * the HTML payload ready to paste into Royal Road's TinyMCE Source dialog.
 *
 * Pulls only the `current` message revision per message and the `current`
 * paragraph revision per paragraph, matching the reader-side visibility
 * model. Scenes and paragraphs are ordered by `sortOrder`. Deleted scenes
 * and messages are excluded.
 *
 * Returns an empty string if the chapter has no visible content (e.g. a
 * brand-new chapter with no scenes yet). Callers should treat that as "do
 * not publish" — we don't try to decide policy here.
 */
export async function buildRoyalRoadChapterHtml(chapterId: string): Promise<string> {
  const scenes = await prisma.scene.findMany({
    where: { chapterId, deleted: false },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      messages: {
        where: {
          deleted: false,
          currentMessageRevisionId: { not: null },
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          currentMessageRevision: {
            select: {
              paragraphs: {
                orderBy: { sortOrder: 'asc' },
                where: { currentParagraphRevisionId: { not: null } },
                select: {
                  currentParagraphRevision: { select: { body: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const sceneHtml: string[][] = scenes.map((scene) =>
    scene.messages.flatMap((message) => {
      const rev = message.currentMessageRevision
      if (!rev) return []
      return rev.paragraphs
        .map((p) => p.currentParagraphRevision?.body ?? '')
        .filter((body) => body.length > 0)
    }),
  )

  return serializeScenesToHtml(sceneHtml)
}
