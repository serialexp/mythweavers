/**
 * Calendar Service
 *
 * Provides CalendarEngine instances for stories.
 * Handles loading calendar configurations from the database.
 */

import { CORUSCANT_CALENDAR, CalendarEngine } from '@mythweavers/shared'
import type { CalendarConfig } from '@mythweavers/shared'
import { prisma } from '../lib/prisma'

/**
 * Cache for CalendarEngine instances
 * Key: calendarId
 * Value: CalendarEngine instance
 */
const engineCache = new Map<string, CalendarEngine>()

/**
 * Get the default calendar for a story
 * @param storyId - Story ID
 * @returns CalendarEngine instance, or null if story has no default calendar
 */
export async function getStoryDefaultCalendar(storyId: string): Promise<CalendarEngine | null> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      defaultCalendarId: true,
    },
  })

  if (!story?.defaultCalendarId) {
    return null
  }

  return getCalendar(story.defaultCalendarId)
}

/**
 * Get a calendar by ID
 * @param calendarId - Calendar ID
 * @returns CalendarEngine instance, or null if not found
 */
export async function getCalendar(calendarId: string): Promise<CalendarEngine | null> {
  // Check cache first
  if (engineCache.has(calendarId)) {
    return engineCache.get(calendarId)!
  }

  // Load from database
  const calendar = await prisma.calendar.findUnique({
    where: { id: calendarId },
  })

  if (!calendar) {
    return null
  }

  // Parse config and create engine
  const config = JSON.parse(calendar.config) as CalendarConfig
  const engine = new CalendarEngine(config)

  // Cache for future use
  engineCache.set(calendarId, engine)

  return engine
}

/**
 * Create a new calendar for a story
 * @param storyId - Story ID
 * @param config - Calendar configuration
 * @returns Calendar ID
 */
export async function createCalendar(storyId: string, config: CalendarConfig): Promise<string> {
  const calendar = await prisma.calendar.create({
    data: {
      storyId,
      config: JSON.stringify(config),
    },
  })

  // Add to cache
  const engine = new CalendarEngine(config)
  engineCache.set(calendar.id, engine)

  return calendar.id
}

/**
 * Update a calendar's configuration
 * @param calendarId - Calendar ID
 * @param config - New calendar configuration
 */
export async function updateCalendar(calendarId: string, config: CalendarConfig): Promise<void> {
  await prisma.calendar.update({
    where: { id: calendarId },
    data: {
      config: JSON.stringify(config),
    },
  })

  // Invalidate cache
  engineCache.delete(calendarId)
}

/**
 * Delete a calendar
 * @param calendarId - Calendar ID
 */
export async function deleteCalendar(calendarId: string): Promise<void> {
  await prisma.calendar.delete({
    where: { id: calendarId },
  })

  // Remove from cache
  engineCache.delete(calendarId)
}

/**
 * Get all calendars for a story
 * @param storyId - Story ID
 * @returns Array of calendar IDs and names
 */
export async function getStoryCalendars(storyId: string): Promise<
  Array<{
    id: string
    name: string
    description: string
    isDefault: boolean
  }>
> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: {
      calendars: true,
    },
  })

  if (!story) {
    return []
  }

  return story.calendars.map((calendar) => {
    const config = JSON.parse(calendar.config) as CalendarConfig
    return {
      id: calendar.id,
      name: config.name,
      description: config.description,
      isDefault: calendar.id === story.defaultCalendarId,
    }
  })
}

/**
 * Set the default calendar for a story
 * @param storyId - Story ID
 * @param calendarId - Calendar ID
 */
export async function setStoryDefaultCalendar(storyId: string, calendarId: string): Promise<void> {
  await prisma.story.update({
    where: { id: storyId },
    data: { defaultCalendarId: calendarId },
  })
}

/**
 * Get or create default calendar for a story
 * If the story doesn't have a default calendar, creates one using Coruscant preset
 * @param storyId - Story ID
 * @returns CalendarEngine instance
 */
export async function getOrCreateStoryDefaultCalendar(storyId: string): Promise<CalendarEngine> {
  let engine = await getStoryDefaultCalendar(storyId)

  if (!engine) {
    // Create default calendar using Coruscant preset
    const calendarId = await createCalendar(storyId, CORUSCANT_CALENDAR)
    await setStoryDefaultCalendar(storyId, calendarId)
    engine = await getCalendar(calendarId)
  }

  return engine!
}

/**
 * Clear the engine cache
 * Useful for testing or when configurations change
 */
export function clearEngineCache(): void {
  engineCache.clear()
}
