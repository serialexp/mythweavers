import { Component, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
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
import { PhCaretLeftIcon, PhCaretRightIcon, PhMagnifyingGlassMinusIcon, PhMagnifyingGlassPlusIcon } from 'solidjs-phosphor'

/**
 * Timeline controls for navigating through story time and viewing map state at different points.
 * Reads all state directly from stores - no props needed.
 */
export const MapTimeline: Component = () => {
  const [zoomWindowStart, setZoomWindowStart] = createSignal<number | null>(null)
  const [zoomWindowEnd, setZoomWindowEnd] = createSignal<number | null>(null)
  const [hoveredMarkerId, setHoveredMarkerId] = createSignal<string | null>(null)
  let timelineSection: HTMLDivElement | undefined
  let timelineSliderContainer: HTMLDivElement | undefined
  // A range input updates itself on pointer-down, before its click handler runs.
  // Keep that native update from briefly selecting the raw pointer time when this
  // gesture is intended to select the closest chapter marker instead.
  let selectingClosestMarker = false

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

  // The viewport is either the full story range or an explicit window created
  // by continuous zooming. Keep an explicit window even when the selected time
  // sits outside it, so pointer-anchored zoom remains stable.
  const timelineRange = createMemo(() => {
    const full = fullTimelineRange()
    const start = zoomWindowStart()
    const end = zoomWindowEnd()
    if (start === null || end === null) return full
    return { start, end, granularity: full.granularity }
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

  // While the pointer is over the timeline, show the chapter that clicking
  // would select; otherwise show the chapter active at the current map time.
  const activeChapter = createMemo(() => {
    const hoveredId = hoveredMarkerId()
    if (hoveredId) return nodeStore.nodesArray.find((node) => node.id === hoveredId) ?? null

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

  const formatTimelineDuration = (span: number) => {
    const config = calendarStore.getEngine().config
    const duration = Math.max(0, span)
    const years = Math.floor(duration / config.minutesPerYear)
    const days = Math.floor((duration % config.minutesPerYear) / config.minutesPerDay)
    const hours = Math.floor((duration % config.minutesPerDay) / config.minutesPerHour)
    const minutes = duration % config.minutesPerHour
    return [
      years > 0 ? `${years}y` : '',
      days > 0 ? `${days}d` : '',
      hours > 0 ? `${hours}h` : '',
      minutes > 0 ? `${minutes}m` : '',
    ].filter(Boolean).join(' ') || '0m'
  }

  const visibleRangeSummary = createMemo(() => {
    const range = timelineRange()
    return {
      start: calendarStore.formatStoryTimeShort(range.start) || '',
      end: calendarStore.formatStoryTimeShort(range.end) || '',
      duration: formatTimelineDuration(range.end - range.start),
    }
  })

  const hoveredMarkerRangeSummary = createMemo(() => {
    const hoveredId = hoveredMarkerId()
    if (!hoveredId) return null

    const markers = chapterMarkers()
      .filter((marker) => marker.chapter.storyTime !== null && marker.chapter.storyTime !== undefined)
      .sort((a, b) => a.chapter.storyTime! - b.chapter.storyTime!)
    const index = markers.findIndex((marker) => marker.chapter.id === hoveredId)
    if (index === -1) return null

    const current = markers[index]
    const previous = markers[index - 1]
    const next = markers[index + 1]
    return {
      previousTitle: previous?.chapter.title ?? 'Start',
      previousGap: previous ? formatTimelineDuration(current.chapter.storyTime! - previous.chapter.storyTime!) : null,
      currentTitle: current.chapter.title,
      nextGap: next ? formatTimelineDuration(next.chapter.storyTime! - current.chapter.storyTime!) : null,
      nextTitle: next?.chapter.title ?? 'End',
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

  const getPointerFraction = (clientX: number) => {
    if (!timelineSliderContainer) return null
    const bounds = timelineSliderContainer.getBoundingClientRect()
    if (bounds.width === 0) return null
    return Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width))
  }

  const closestMarkerAtFraction = (fraction: number) => {
    const markers = chapterMarkers()
    if (markers.length === 0) return null

    const pointerPosition = fraction * 100
    return markers.reduce((closest, marker) =>
      Math.abs(marker.position - pointerPosition) < Math.abs(closest.position - pointerPosition) ? marker : closest,
    )
  }

  const selectMarker = (marker: ReturnType<typeof closestMarkerAtFraction>) => {
    if (!marker || marker.chapter.storyTime === null || marker.chapter.storyTime === undefined) return
    mapEditorStore.setPendingStoryTime(null)
    mapsStore.setCurrentStoryTime(marker.chapter.storyTime)
  }

  const handleTimelinePointerMove = (event: PointerEvent) => {
    const fraction = getPointerFraction(event.clientX)
    const marker = fraction === null ? null : closestMarkerAtFraction(fraction)
    setHoveredMarkerId(marker?.chapter.id ?? null)
  }

  const handleTimelinePointerDown = (event: PointerEvent) => {
    if (event.target instanceof HTMLInputElement) {
      // Prevent the range control from committing its raw pointer position. The
      // click handler below will commit the marker already highlighted here.
      selectingClosestMarker = true
      event.preventDefault()
    }
  }

  const handleTimelineClick = (event: MouseEvent) => {
    const fraction = getPointerFraction(event.clientX)
    if (fraction === null) return

    const marker = closestMarkerAtFraction(fraction)
    setHoveredMarkerId(marker?.chapter.id ?? null)
    selectMarker(marker)
    selectingClosestMarker = false
  }

  const handleSliderInput = (position: number) => {
    if (selectingClosestMarker) return
    const range = timelineRange()
    const newStoryTime = sliderPositionToStoryTime(position, range.start, range.granularity)
    mapEditorStore.setPendingStoryTime(newStoryTime)
  }

  const handleSliderChange = (position: number) => {
    if (selectingClosestMarker) return
    const range = timelineRange()
    const newStoryTime = sliderPositionToStoryTime(position, range.start, range.granularity)
    mapEditorStore.setPendingStoryTime(null)
    mapsStore.setCurrentStoryTime(newStoryTime)
  }

  const minimumZoomSpan = createMemo(() => (fullTimelineRange().granularity === 'hour' ? 60 : 1440))

  const setZoomedViewport = (factor: number, anchorFraction: number) => {
    const full = fullTimelineRange()
    const current = timelineRange()
    const fullSpan = full.end - full.start
    const minSpan = Math.min(minimumZoomSpan(), fullSpan)
    const nextSpan = Math.max(minSpan, Math.min(fullSpan, (current.end - current.start) * factor))
    const anchorTime = current.start + anchorFraction * (current.end - current.start)
    const maxStart = full.end - nextSpan
    const start = Math.max(full.start, Math.min(anchorTime - anchorFraction * nextSpan, maxStart))

    if (nextSpan === fullSpan) {
      setZoomWindowStart(null)
      setZoomWindowEnd(null)
      return
    }

    setZoomWindowStart(start)
    setZoomWindowEnd(start + nextSpan)
  }

  const zoomBy = (factor: number) => setZoomedViewport(factor, 0.5)

  const handleWheel = (event: WheelEvent) => {
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 400 : 1
    const deltaY = event.deltaY * unit
    if (deltaY === 0) return

    event.preventDefault()
    const fraction = getPointerFraction(event.clientX)
    if (fraction !== null) setZoomedViewport(deltaY > 0 ? 1.15 : 1 / 1.15, fraction)
  }

  onMount(() => {
    // The complete timeline section is the zoom target, including its controls
    // and readout. The slider still supplies the horizontal anchor when present.
    timelineSection?.addEventListener('wheel', handleWheel, { passive: false })
    onCleanup(() => timelineSection?.removeEventListener('wheel', handleWheel))
  })

  return (
    <Show when={hasValidTimeline()}>
      <div ref={timelineSection} class={styles.timelineSection}>
        {/* Row 1: Full-width timeline slider */}
        <div class={styles.timelineSliderRow}>
          <button
            class={styles.timelineStepButton}
            onClick={() => handleStep('back')}
            disabled={isAtStart()}
            title="Previous step"
          >
            <PhCaretLeftIcon />
          </button>

          <div
            ref={timelineSliderContainer}
            class={styles.timelineSliderContainer}
            onPointerMove={handleTimelinePointerMove}
            onPointerDown={handleTimelinePointerDown}
            onPointerLeave={() => setHoveredMarkerId(null)}
            onClick={handleTimelineClick}
          >
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
                  class={`${styles.chapterMarker} ${hoveredMarkerId() === marker.chapter.id ? styles.chapterMarkerHovered : ''}`}
                  style={{ left: `${marker.position}%` }}
                  title={`${marker.chapter.title}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectMarker(marker)
                  }}
                />
              ))}
            </div>
            <Show when={hoveredMarkerRangeSummary()}>
              {(gaps) => {
                const marker = chapterMarkers().find((item) => item.chapter.id === hoveredMarkerId())
                return (
                  <Show when={marker}>
                    <div class={styles.timelineHoverGaps} style={{ left: `${marker?.position ?? 0}%` }}>
                      <span>{gaps().previousGap ?? 'Start'}</span>
                      <span class={styles.timelineHoverCurrent}>{gaps().currentTitle}</span>
                      <span>{gaps().nextGap ?? 'End'}</span>
                    </div>
                  </Show>
                )
              }}
            </Show>
            {/* Range labels when zoomed */}
            <Show when={zoomWindowStart() !== null}>
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
            <PhCaretRightIcon />
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

          <div
            class={styles.timelineRangeSummary}
            title={`Visible timeline: ${visibleRangeSummary().start} to ${visibleRangeSummary().end} (${visibleRangeSummary().duration})`}
          >
            {visibleRangeSummary().start} – {visibleRangeSummary().end} · {visibleRangeSummary().duration}
          </div>

          <div class={styles.timelineSpacer} />

          <div class={styles.zoomControls}>
            <button class={styles.zoomButton} onClick={() => zoomBy(1.6)} title="Zoom out">
              <PhMagnifyingGlassMinusIcon />
            </button>
            <span class={styles.zoomLabel}>Zoom</span>
            <button class={styles.zoomButton} onClick={() => zoomBy(1 / 1.6)} title="Zoom in">
              <PhMagnifyingGlassPlusIcon />
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
