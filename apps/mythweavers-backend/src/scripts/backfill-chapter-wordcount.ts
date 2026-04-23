/**
 * Rebuild the cached `Chapter.wordCount` column from scratch by walking
 * every chapter's current paragraph revisions. Safe to re-run; it's
 * idempotent.
 *
 * Run with:
 *   pnpm --filter @mythweavers/backend tsx src/scripts/backfill-chapter-wordcount.ts [--dry-run]
 *
 * This is the recovery script if the in-flight recompute hooks in
 * routes/my/paragraphs.ts ever drift from reality.
 */

import { prisma } from '../lib/prisma.js'
import { countWordsInHtml } from '../lib/chapterWordCount.js'

async function main() {
  const isDryRun = process.argv.includes('--dry-run')
  console.log(isDryRun ? '=== DRY RUN MODE ===' : '=== LIVE MODE ===')

  const chapters = await prisma.chapter.findMany({
    where: { deleted: false },
    select: { id: true, name: true, wordCount: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Processing ${chapters.length} chapters...`)

  let updated = 0
  let unchanged = 0

  for (const chapter of chapters) {
    // Walk the same path as recalculateChapterWordCount, inline here to
    // avoid a round-trip per chapter when we have thousands of them.
    const paragraphs = await prisma.paragraph.findMany({
      where: {
        messageRevision: {
          currentRevisionFor: {
            some: {
              deleted: false,
              scene: {
                deleted: false,
                chapterId: chapter.id,
              },
            },
          },
        },
        currentParagraphRevisionId: { not: null },
      },
      select: { currentParagraphRevision: { select: { body: true } } },
    })

    let total = 0
    for (const p of paragraphs) {
      total += countWordsInHtml(p.currentParagraphRevision?.body)
    }

    if (total === chapter.wordCount) {
      unchanged++
      continue
    }

    console.log(`  [${chapter.id}] ${chapter.name || '<unnamed>'}: ${chapter.wordCount} → ${total}`)
    if (!isDryRun) {
      await prisma.chapter.update({
        where: { id: chapter.id },
        data: { wordCount: total },
      })
    }
    updated++
  }

  console.log('')
  console.log(`Done. ${updated} updated, ${unchanged} already correct.`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
