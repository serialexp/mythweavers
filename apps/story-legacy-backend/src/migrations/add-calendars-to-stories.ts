/**
 * Data Migration: Add Calendars to Existing Stories
 *
 * This script creates a default calendar for each existing story
 * and sets it as the story's defaultCalendarId.
 *
 * Usage:
 *   pnpm exec tsx src/migrations/add-calendars-to-stories.ts [--dry-run]
 */

import { CORUSCANT_CALENDAR } from '@mythweavers/shared'
import { PrismaClient } from '../generated/prisma'
import { generateMessageId } from '../utils/id'

const prisma = new PrismaClient()

async function migrate(dryRun = false) {
  console.log('Starting calendar migration...')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`)

  try {
    // Get all stories without a default calendar
    const stories = await prisma.story.findMany({
      where: {
        defaultCalendarId: null,
      },
      select: {
        id: true,
        name: true,
        deleted: true,
      },
    })

    console.log(`Found ${stories.length} stories without calendars\n`)

    if (stories.length === 0) {
      console.log('No stories need migration. All done!')
      return
    }

    let created = 0
    let skipped = 0

    for (const story of stories) {
      const storyLabel = story.deleted ? `${story.name} (deleted)` : story.name
      console.log(`Processing: ${storyLabel} (${story.id})`)

      // Create calendar config JSON
      const calendarConfig = JSON.stringify(CORUSCANT_CALENDAR)
      const calendarId = generateMessageId()

      if (dryRun) {
        console.log(`  [DRY RUN] Would create calendar: ${calendarId}`)
        console.log(`  [DRY RUN] Would set as default for story: ${story.id}`)
        skipped++
      } else {
        // Create the calendar
        await prisma.calendar.create({
          data: {
            id: calendarId,
            storyId: story.id,
            config: calendarConfig,
          },
        })

        // Set as default calendar for the story
        await prisma.story.update({
          where: { id: story.id },
          data: { defaultCalendarId: calendarId },
        })

        console.log(`  ✓ Created calendar: ${calendarId}`)
        console.log('  ✓ Set as default for story')
        created++
      }
      console.log('')
    }

    console.log('Migration complete!')
    console.log(`  Created: ${created}`)
    if (dryRun) {
      console.log(`  Skipped (dry run): ${skipped}`)
    }
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Run migration
migrate(dryRun).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
