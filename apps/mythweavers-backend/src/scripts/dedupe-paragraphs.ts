/**
 * Script to deduplicate paragraphs that were accidentally created twice.
 *
 * Run with: npx tsx src/scripts/dedupe-paragraphs.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  console.log(isDryRun ? '=== DRY RUN MODE ===' : '=== LIVE MODE ===')
  console.log('')

  // Find all message revisions that have paragraphs
  const revisionsWithParagraphs = await prisma.messageRevision.findMany({
    where: {
      paragraphs: {
        some: {}
      }
    },
    include: {
      paragraphs: {
        include: {
          currentParagraphRevision: true
        },
        orderBy: {
          sortOrder: 'asc'
        }
      },
      message: {
        select: {
          id: true,
          scene: {
            select: {
              name: true,
              chapter: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    }
  })

  let totalDuplicates = 0
  let totalDeleted = 0
  const affectedMessages: string[] = []

  for (const revision of revisionsWithParagraphs) {
    // Group paragraphs by their body content
    const contentMap = new Map<string, typeof revision.paragraphs>()

    for (const para of revision.paragraphs) {
      const body = para.currentParagraphRevision?.body ?? ''
      if (!contentMap.has(body)) {
        contentMap.set(body, [])
      }
      contentMap.get(body)!.push(para)
    }

    // Find duplicates (groups with more than one paragraph with same content)
    const duplicateGroups = Array.from(contentMap.entries())
      .filter(([_, paragraphs]) => paragraphs.length > 1)

    if (duplicateGroups.length > 0) {
      const sceneName = revision.message?.scene?.name ?? 'Unknown scene'
      const chapterName = revision.message?.scene?.chapter?.name ?? 'Unknown chapter'

      console.log(`\nMessage ${revision.messageId} (${chapterName} > ${sceneName}):`)
      affectedMessages.push(revision.messageId)

      for (const [body, paragraphs] of duplicateGroups) {
        const preview = body.length > 60 ? body.substring(0, 60) + '...' : body
        console.log(`  - "${preview}" appears ${paragraphs.length} times`)

        // Keep the first one (lowest sortOrder), delete the rest
        const [keep, ...toDelete] = paragraphs
        console.log(`    Keeping paragraph ${keep.id} (sortOrder: ${keep.sortOrder})`)

        for (const para of toDelete) {
          console.log(`    ${isDryRun ? 'Would delete' : 'Deleting'} paragraph ${para.id} (sortOrder: ${para.sortOrder})`)
          totalDuplicates++

          if (!isDryRun) {
            await prisma.paragraph.delete({
              where: { id: para.id }
            })
            totalDeleted++
          }
        }
      }
    }
  }

  console.log('')
  console.log('=== SUMMARY ===')
  console.log(`Messages affected: ${affectedMessages.length}`)
  console.log(`Duplicate paragraphs found: ${totalDuplicates}`)

  if (isDryRun) {
    console.log(`Would delete: ${totalDuplicates} paragraphs`)
    console.log('')
    console.log('Run without --dry-run to actually delete duplicates.')
  } else {
    console.log(`Deleted: ${totalDeleted} paragraphs`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
