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
 * Auto-calculate timeline range from nodes (chapters or scenes) with storyTime set
 * Returns null if no nodes have storyTime
 */
export function autoCalculateTimelineRange(nodes: Node[]): { start: number; end: number } | null {
  const nodesWithTime = nodes
    .filter((n) => (n.type === 'chapter' || n.type === 'scene') && n.storyTime !== null && n.storyTime !== undefined)
    .sort((a, b) => a.storyTime! - b.storyTime!)

  if (nodesWithTime.length === 0) {
    return null
  }

  const earliestTime = nodesWithTime[0].storyTime!
  const latestTime = nodesWithTime[nodesWithTime.length - 1].storyTime!

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

  // Auto-calculate from nodes with storyTime
  const autoRange = autoCalculateTimelineRange(nodes)
  if (autoRange) {
    return {
      ...autoRange,
      granularity: story.timelineGranularity || 'hour',
    }
  }

  // Fallback: default range around year 0
  const defaultTime = 0
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
 * Find the node (chapter or scene) that is active at a given story time
 * Returns the latest node that starts at or before the given time
 */
export function getChapterAtStoryTime(storyTime: number, nodes: Node[]): Node | null {
  // Get chapters/scenes sorted by storyTime
  const nodesWithTime = nodes
    .filter((n) => (n.type === 'chapter' || n.type === 'scene') && n.storyTime !== null && n.storyTime !== undefined)
    .sort((a, b) => a.storyTime! - b.storyTime!)

  // Find the latest node that starts at or before this time
  let activeNode: Node | null = null
  for (const node of nodesWithTime) {
    if (node.storyTime! <= storyTime) {
      activeNode = node
    } else {
      break
    }
  }

  return activeNode
}

/**
 * Get story time for a message based on its node's (chapter or scene) storyTime
 */
export function getStoryTimeForMessage(messageId: string, messages: Message[], nodes: Node[]): number | null {
  const message = messages.find((m) => m.id === messageId)
  if (!message) return null

  // Find the node (chapter or scene) this message belongs to
  const node = nodes.find((n) => n.id === message.sceneId && (n.type === 'chapter' || n.type === 'scene'))
  if (!node) return null

  return node.storyTime ?? null
}

/**
 * Get node markers (chapters/scenes) for timeline display
 * Returns nodes with their positions as percentages (0-100)
 */
export function getChapterMarkers(
  nodes: Node[],
  start: number,
  end: number,
): Array<{ chapter: Node; position: number }> {
  const nodesWithTime = nodes.filter(
    (n) => (n.type === 'chapter' || n.type === 'scene') && n.storyTime !== null && n.storyTime !== undefined,
  )

  const range = end - start

  return nodesWithTime
    .map((node) => ({
      chapter: node, // Keep property name for backwards compatibility
      position: ((node.storyTime! - start) / range) * 100,
    }))
    .filter((marker) => marker.position >= 0 && marker.position <= 100)
}
