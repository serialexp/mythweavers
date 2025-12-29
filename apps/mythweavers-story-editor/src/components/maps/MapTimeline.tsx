import { BsChevronLeft, BsChevronRight, BsZoomIn, BsZoomOut } from 'solid-icons/bs'
import { Component, Show, createMemo, createSignal } from 'solid-js'
import { calendarStore } from '../../stores/calendarStore'
import { currentStoryStore } from '../../stores/currentStoryStore'
import { landmarkStatesStore } from '../../stores/landmarkStatesStore'
import { mapEditorStore } from '../../stores/mapEditorStore'
import { mapsStore } from '../../stores/mapsStore'
import { nodeStore } from '../../stores/nodeStore'
import {
  calculateSliderSteps,
  getChapterAtStoryTime,
  getChapterMarkers,
  getTimelineRange,
  sliderPositionToStoryTime,
  storyTimeToSliderPosition,
} from '../../utils/timelineUtils'
import * as styles from '../Maps.css'

type ZoomLevel = 'full' | 'year' | 'month' | 'week'

/**
 * Timeline controls for navigating through story time and viewing map state at different points.
 * Reads all state directly from stores - no props needed.
 */
export const MapTimeline: Component = () => {
  const [zoomLevel, setZoomLevel] = createSignal<ZoomLevel>('full')
  const [zoomWindowStart, setZoomWindowStart] = createSignal<number | null>(null)
  const [zoomWindowEnd, setZoomWindowEnd] = createSignal<number | null>(null)

  // Get current story time from mapsStore
  const currentStoryTime = () => mapsStore.currentStoryTime

  // Get pending story time from mapEditorStore
  const pendingStoryTime = () => mapEditorStore.pendingStoryTime

  // Get story times that have landmark state changes (for timeline indicators)
  const storyTimesWithStates = createMemo(() => {
    return landmarkStatesStore.storyTimesWithStates
  })

  // Get all fleet movement story times for timeline indicators
  const fleetMovementTimes = createMemo(() => {
    const map = mapsStore.selectedMap
    if (!map || !map.fleets) return []

    const times: number[] = []
    for (const fleet of map.fleets) {
      for (const movement of fleet.movements) {
        // Add both start and end times
        times.push(movement.startStoryTime)
        times.push(movement.endStoryTime)
      }
    }

    return times
  })

  // Get the full timeline range
  const fullTimelineRange = createMemo(() => {
    if (!currentStoryStore.isInitialized) return { start: 0, end: 0, granularity: 'day' as const }
    return getTimelineRange(currentStoryStore, nodeStore.nodesArray)
  })

  // Calculate window size based on zoom level
  const getWindowSize = (zoom: ZoomLevel): number | null => {
    switch (zoom) {
      case 'full':
        return null
      case 'year':
        return 368 * 1440 // 368 days
      case 'month':
        return 92 * 1440 // 1 quarter (92 days)
      case 'week':
        return 7 * 1440 // 7 days
    }
  }

  // Calculate zoomed timeline range
  const timelineRange = createMemo(() => {
    const full = fullTimelineRange()
    const zoom = zoomLevel()
    const curTime = currentStoryTime()

    if (zoom === 'full') {
      return full
    }

    // Check if we have a stored zoom window
    const storedStart = zoomWindowStart()
    const storedEnd = zoomWindowEnd()

    if (storedStart !== null && storedEnd !== null) {
      // Use stored window, but check if current time is outside it
      if (curTime !== null && (curTime < storedStart || curTime > storedEnd)) {
        // Current time is outside window, recenter
        const windowSize = getWindowSize(zoom)!
        const halfWindow = windowSize / 2
        let start = curTime - halfWindow
        let end = curTime + halfWindow

        // Clamp to full range
        if (start < full.start) {
          const shift = full.start - start
          start = full.start
          end = Math.min(end + shift, full.end)
        }
        if (end > full.end) {
          const shift = end - full.end
          end = full.end
          start = Math.max(start - shift, full.start)
        }

        // Update stored window
        setZoomWindowStart(start)
        setZoomWindowEnd(end)

        return { start, end, granularity: full.granularity }
      }

      // Use stored window
      return {
        start: storedStart,
        end: storedEnd,
        granularity: full.granularity,
      }
    }

    // No stored window, create new one centered on current time
    const centerTime = curTime ?? full.start
    const windowSize = getWindowSize(zoom)!
    const halfWindow = windowSize / 2
    let start = centerTime - halfWindow
    let end = centerTime + halfWindow

    // Clamp to full range
    if (start < full.start) {
      const shift = full.start - start
      start = full.start
      end = Math.min(end + shift, full.end)
    }
    if (end > full.end) {
      const shift = end - full.end
      end = full.end
      start = Math.max(start - shift, full.start)
    }

    // Store the window
    setZoomWindowStart(start)
    setZoomWindowEnd(end)

    return {
      start,
      end,
      granularity: full.granularity,
    }
  })

  // Calculate slider configuration
  const sliderSteps = createMemo(() => {
    const range = timelineRange()
    return calculateSliderSteps(range.start, range.end, range.granularity)
  })

  // Current slider position (derived from story time)
  const sliderPosition = createMemo(() => {
    const pending = pendingStoryTime()
    const current = currentStoryTime()
    const time = pending !== null ? pending : (current ?? 0)
    const range = timelineRange()
    return storyTimeToSliderPosition(time, range.start, range.granularity)
  })

  // Active chapter at current time
  const activeChapter = createMemo(() => {
    const time = currentStoryTime()
    if (time === null) return null
    return getChapterAtStoryTime(time, nodeStore.nodesArray)
  })

  // Chapter markers for display
  const chapterMarkers = createMemo(() => {
    const range = timelineRange()
    return getChapterMarkers(nodeStore.nodesArray, range.start, range.end)
  })

  // Timeline info display
  const timelineInfo = createMemo(() => {
    const pending = pendingStoryTime()
    const current = currentStoryTime()
    const time = pending !== null ? pending : (current ?? 0)
    const activeNode = activeChapter()
    const range = timelineRange()

    // Build the location string (Chapter - Scene format)
    let locationLabel = 'Before story'
    let locationTitle = 'No active chapter'

    if (activeNode) {
      if (activeNode.type === 'scene') {
        // Find parent chapter
        const parentChapter = nodeStore.nodesArray.find(
          (node) => node.id === activeNode.parentId && node.type === 'chapter',
        )
        if (parentChapter) {
          locationLabel = `${parentChapter.title} - ${activeNode.title}`
          locationTitle = `${parentChapter.title} - ${activeNode.title}`
        } else {
          locationLabel = activeNode.title
          locationTitle = activeNode.title
        }
      } else if (activeNode.type === 'chapter') {
        locationLabel = `Ch. ${activeNode.title}`
        locationTitle = activeNode.title
      } else {
        locationLabel = activeNode.title
        locationTitle = activeNode.title
      }
    }

    return {
      time: calendarStore.formatStoryTime(time) || '', // Include time of day with hour
      timeWithHour: calendarStore.formatStoryTime(time) || '', // Full time with hour for tooltip
      rawTime: time, // Raw story time number (minutes from 0 BBY)
      chapter: locationLabel,
      chapterTitle: locationTitle,
      rangeStart: calendarStore.formatStoryTimeShort(range.start) || '', // Start of visible range (no time)
      rangeEnd: calendarStore.formatStoryTimeShort(range.end) || '', // End of visible range (no time)
    }
  })

  // State change indicators (convert story times to percentages, similar to chapter markers)
  const stateIndicatorPositions = createMemo(() => {
    const range = timelineRange()
    const totalRange = range.end - range.start
    const storyTimes = storyTimesWithStates()

    return storyTimes
      .map((storyTime) => {
        // Calculate position as percentage (0-100)
        const position = ((storyTime - range.start) / totalRange) * 100
        // Only show indicators that are within the timeline range
        if (position < 0 || position > 100) return null
        return position
      })
      .filter((pos): pos is number => pos !== null)
  })

  // Fleet movement indicators (convert story times to percentages, similar to chapter markers)
  const fleetIndicatorPositions = createMemo(() => {
    const range = timelineRange()
    const totalRange = range.end - range.start
    const storyTimes = fleetMovementTimes()

    return storyTimes
      .map((storyTime) => {
        // Calculate position as percentage (0-100)
        const position = ((storyTime - range.start) / totalRange) * 100
        // Only show indicators that are within the timeline range
        if (position < 0 || position > 100) return null
        return position
      })
      .filter((pos): pos is number => pos !== null)
  })

  // Handle slider drag (for visual feedback)
  const handleSliderInput = (position: number) => {
    const range = timelineRange()
    const newStoryTime = sliderPositionToStoryTime(position, range.start, range.granularity)
    mapEditorStore.setPendingStoryTime(newStoryTime)
  }

  // Handle slider release (commit the change)
  const handleSliderChange = (position: number) => {
    const range = timelineRange()
    const newStoryTime = sliderPositionToStoryTime(position, range.start, range.granularity)
    // Clear any pending state
    mapEditorStore.setPendingStoryTime(null)
    // Update the actual story time
    mapsStore.setCurrentStoryTime(newStoryTime)
  }

  // Step forward/back in timeline (by granularity)
  const handleStep = (direction: 'forward' | 'back') => {
    const range = timelineRange()
    const granularityMinutes = range.granularity === 'hour' ? 60 : 1440
    const current = currentStoryTime() ?? range.start

    let newTime = current
    if (direction === 'forward') {
      newTime = Math.min(current + granularityMinutes, range.end)
    } else {
      newTime = Math.max(current - granularityMinutes, range.start)
    }

    // Clear any pending state and update time directly
    mapEditorStore.setPendingStoryTime(null)
    mapsStore.setCurrentStoryTime(newTime)
  }

  // Reset to latest (current time at end)
  const handleReset = () => {
    mapEditorStore.setPendingStoryTime(null)
    mapsStore.resetStoryTime()
  }

  // Check if we're at the end of timeline
  const isAtEnd = createMemo(() => {
    const pos = sliderPosition()
    const maxPos = sliderSteps()
    return pos >= maxPos
  })

  // Check if we're at the start of timeline
  const isAtStart = createMemo(() => {
    const pos = sliderPosition()
    return pos <= 0
  })

  // Show timeline only if we have a valid range
  const hasValidTimeline = createMemo(() => {
    const range = timelineRange()
    return range.end > range.start
  })

  // Zoom controls
  const handleZoomIn = () => {
    const current = zoomLevel()
    // Clear stored window so it recenters on current time
    setZoomWindowStart(null)
    setZoomWindowEnd(null)

    switch (current) {
      case 'full':
        setZoomLevel('year')
        break
      case 'year':
        setZoomLevel('month')
        break
      case 'month':
        setZoomLevel('week')
        break
      // Already at maximum zoom
    }
  }

  const handleZoomOut = () => {
    const current = zoomLevel()
    // Clear stored window so it recenters on current time
    setZoomWindowStart(null)
    setZoomWindowEnd(null)

    switch (current) {
      case 'week':
        setZoomLevel('month')
        break
      case 'month':
        setZoomLevel('year')
        break
      case 'year':
        setZoomLevel('full')
        break
      // Already at minimum zoom
    }
  }

  const zoomLabel = createMemo(() => {
    switch (zoomLevel()) {
      case 'full':
        return 'Full'
      case 'year':
        return '1 Year'
      case 'month':
        return '1 Quarter'
      case 'week':
        return '1 Week'
    }
  })

  return (
    <Show when={hasValidTimeline()}>
      <div class={styles.timelineSection}>
        {/* Row 1: Full-width timeline slider */}
        <div class={styles.timelineSliderRow}>
          <button
            class={styles.timelineStepButton}
            onClick={() => handleStep('back')}
            disabled={isAtStart()}
            title="Previous step"
          >
            <BsChevronLeft />
          </button>

          <div class={styles.timelineSliderContainer}>
            <input
              type="range"
              class={styles.timelineSlider}
              min="0"
              max={sliderSteps()}
              value={sliderPosition()}
              onInput={(e) => handleSliderInput(Number.parseInt(e.target.value))}
              onChange={(e) => handleSliderChange(Number.parseInt(e.target.value))}
            />
            {/* State change indicators */}
            <div class={styles.timelineIndicators}>
              {stateIndicatorPositions().map((position) => (
                <div class={styles.timelineIndicator} style={{ left: `${position}%` }} title="Landmark state change" />
              ))}
            </div>
            {/* Fleet movement indicators */}
            <div class={styles.timelineIndicators}>
              {fleetIndicatorPositions().map((position) => (
                <div class={styles.fleetIndicator} style={{ left: `${position}%` }} title="Fleet movement" />
              ))}
            </div>
            {/* Chapter markers */}
            <div class={styles.chapterMarkers}>
              {chapterMarkers().map((marker) => (
                <div
                  class={styles.chapterMarker}
                  style={{ left: `${marker.position}%` }}
                  title={`${marker.chapter.title}`}
                  onClick={() => {
                    if (marker.chapter.storyTime) {
                      mapEditorStore.setPendingStoryTime(null)
                      mapsStore.setCurrentStoryTime(marker.chapter.storyTime)
                    }
                  }}
                />
              ))}
            </div>
            {/* Range labels when zoomed */}
            <Show when={zoomLevel() !== 'full'}>
              <div class={styles.timelineRangeLabels}>
                <span class={styles.rangeLabel}>{timelineInfo().rangeStart}</span>
                <span class={styles.rangeLabel}>{timelineInfo().rangeEnd}</span>
              </div>
            </Show>
          </div>

          <button
            class={styles.timelineStepButton}
            onClick={() => handleStep('forward')}
            disabled={isAtEnd()}
            title="Next step"
          >
            <BsChevronRight />
          </button>
        </div>

        {/* Row 2: Time info, chapter, zoom, reset */}
        <div class={styles.timelineInfoRow}>
          <div
            class={styles.timelinePosition}
            title={`${timelineInfo().timeWithHour} (Raw: ${timelineInfo().rawTime})`}
          >
            {timelineInfo().time}
          </div>

          <Show when={timelineInfo().chapter}>
            <div class={styles.timelineChapter} title={timelineInfo().chapterTitle}>
              {timelineInfo().chapter}
            </div>
          </Show>

          <div class={styles.timelineSpacer} />

          <div class={styles.zoomControls}>
            <button
              class={styles.zoomButton}
              onClick={handleZoomOut}
              disabled={zoomLevel() === 'full'}
              title="Zoom out"
            >
              <BsZoomOut />
            </button>
            <span class={styles.zoomLabel}>{zoomLabel()}</span>
            <button
              class={styles.zoomButton}
              onClick={handleZoomIn}
              disabled={zoomLevel() === 'week'}
              title="Zoom in"
            >
              <BsZoomIn />
            </button>
          </div>

          <button
            class={styles.resetTimelineButton}
            onClick={handleReset}
            disabled={pendingStoryTime() === null && isAtEnd()}
          >
            Latest
          </button>
        </div>
      </div>
    </Show>
  )
}
