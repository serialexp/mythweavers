/**
 * Timeline Utilities
 *
 * Helpers for working with story-time-based timeline system
 */

import { Message, Node } from '../types/core'
import { CurrentStory } from '../types/store'

export type TimelineGranularity = 'hour' | 'day'

/**
 * Get granularity in minutes
 */
export function getGranularityMinutes(granularity: TimelineGranularity): number {
  switch (granularity) {
    case 'hour':
      return 60
    case 'day':
      return 1440 // 24 * 60
  }
}

/**
 * Auto-calculate timeline range from chapters with storyTime set
 * Returns null if no chapters have storyTime
 */
export function autoCalculateTimelineRange(nodes: Node[]): { start: number; end: number } | null {
  const chaptersWithTime = nodes
    .filter((n) => n.type === 'chapter' && n.storyTime !== null && n.storyTime !== undefined)
    .sort((a, b) => a.storyTime! - b.storyTime!)

  if (chaptersWithTime.length === 0) {
    return null
  }

  const earliestTime = chaptersWithTime[0].storyTime!
  const latestTime = chaptersWithTime[chaptersWithTime.length - 1].storyTime!

  // Add 7 days buffer on each side (7 * 24 * 60 = 10,080 minutes)
  const bufferMinutes = 7 * 1440

  return {
    start: earliestTime - bufferMinutes,
    end: latestTime + bufferMinutes,
  }
}

/**
 * Get timeline range from story settings or auto-calculate
 */
export function getTimelineRange(
  story: CurrentStory,
  nodes: Node[],
): { start: number; end: number; granularity: TimelineGranularity } {
  // Use story settings if available
  if (
    story.timelineStartTime !== null &&
    story.timelineStartTime !== undefined &&
    story.timelineEndTime !== null &&
    story.timelineEndTime !== undefined
  ) {
    return {
      start: story.timelineStartTime,
      end: story.timelineEndTime,
      granularity: story.timelineGranularity || 'hour',
    }
  }

  // Auto-calculate from chapters
  const autoRange = autoCalculateTimelineRange(nodes)
  if (autoRange) {
    return {
      ...autoRange,
      granularity: story.timelineGranularity || 'hour',
    }
  }

  // Fallback: default range around 22 BBY (start of Clone Wars)
  const defaultTime = -22 * 368 * 1440 // -22 years in minutes
  const defaultRange = 365 * 1440 // 1 year range in minutes

  return {
    start: defaultTime - defaultRange / 2,
    end: defaultTime + defaultRange / 2,
    granularity: story.timelineGranularity || 'hour',
  }
}

/**
 * Calculate number of slider steps for a timeline range
 */
export function calculateSliderSteps(start: number, end: number, granularity: TimelineGranularity): number {
  const granularityMinutes = getGranularityMinutes(granularity)
  return Math.ceil((end - start) / granularityMinutes)
}

/**
 * Convert slider position to story time
 */
export function sliderPositionToStoryTime(position: number, start: number, granularity: TimelineGranularity): number {
  const granularityMinutes = getGranularityMinutes(granularity)
  return start + position * granularityMinutes
}

/**
 * Convert story time to slider position
 */
export function storyTimeToSliderPosition(storyTime: number, start: number, granularity: TimelineGranularity): number {
  const granularityMinutes = getGranularityMinutes(granularity)
  return Math.floor((storyTime - start) / granularityMinutes)
}

/**
 * Find the chapter that is active at a given story time
 * Returns the latest chapter that starts at or before the given time
 */
export function getChapterAtStoryTime(storyTime: number, nodes: Node[]): Node | null {
  // Get chapters sorted by storyTime
  const chaptersWithTime = nodes
    .filter((n) => n.type === 'chapter' && n.storyTime !== null && n.storyTime !== undefined)
    .sort((a, b) => a.storyTime! - b.storyTime!)

  // Find the latest chapter that starts at or before this time
  let activeChapter: Node | null = null
  for (const chapter of chaptersWithTime) {
    if (chapter.storyTime! <= storyTime) {
      activeChapter = chapter
    } else {
      break
    }
  }

  return activeChapter
}

/**
 * Get story time for a message based on its chapter's storyTime
 */
export function getStoryTimeForMessage(messageId: string, messages: Message[], nodes: Node[]): number | null {
  const message = messages.find((m) => m.id === messageId)
  if (!message) return null

  // Find the chapter this message belongs to
  const chapter = nodes.find((n) => n.id === message.nodeId && n.type === 'chapter')
  if (!chapter) return null

  return chapter.storyTime ?? null
}

/**
 * Get chapter markers for timeline display
 * Returns chapters with their positions as percentages (0-100)
 */
export function getChapterMarkers(
  nodes: Node[],
  start: number,
  end: number,
): Array<{ chapter: Node; position: number }> {
  const chaptersWithTime = nodes.filter(
    (n) => n.type === 'chapter' && n.storyTime !== null && n.storyTime !== undefined,
  )

  const range = end - start

  return chaptersWithTime
    .map((chapter) => ({
      chapter,
      position: ((chapter.storyTime! - start) / range) * 100,
    }))
    .filter((marker) => marker.position >= 0 && marker.position <= 100)
}
