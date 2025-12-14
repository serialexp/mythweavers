import { Component, Show, Accessor, createMemo, createSignal } from "solid-js";
import { BsChevronLeft, BsChevronRight, BsZoomIn, BsZoomOut } from "solid-icons/bs";
import { Node } from "../../types/core";
import { CurrentStory } from "../../types/store";
import { calendarStore } from "../../stores/calendarStore";
import {
  getTimelineRange,
  calculateSliderSteps,
  storyTimeToSliderPosition,
  sliderPositionToStoryTime,
  getChapterAtStoryTime,
  getChapterMarkers
} from "../../utils/timelineUtils";
import styles from "../Maps.module.css";

interface MapTimelineProps {
  story: Accessor<CurrentStory>;
  nodes: Accessor<Node[]>;
  currentStoryTime: Accessor<number>;
  pendingStoryTime: Accessor<number | null>;
  storyTimesWithStates: Accessor<number[]>; // Story times that have landmark state changes
  fleetMovementTimes: Accessor<number[]>; // Story times for fleet movements (start/end times)
  onTimelineChange: (storyTime: number) => void;
  onStep: (direction: 'forward' | 'back') => void;
  onReset: () => void;
}

type ZoomLevel = 'full' | 'year' | 'month' | 'week';

/**
 * Timeline controls for navigating through story time and viewing map state at different points
 */
export const MapTimeline: Component<MapTimelineProps> = (props) => {
  const [zoomLevel, setZoomLevel] = createSignal<ZoomLevel>('full');
  const [zoomWindowStart, setZoomWindowStart] = createSignal<number | null>(null);
  const [zoomWindowEnd, setZoomWindowEnd] = createSignal<number | null>(null);

  // Get the full timeline range
  const fullTimelineRange = createMemo(() => getTimelineRange(props.story(), props.nodes()));

  // Calculate window size based on zoom level
  const getWindowSize = (zoom: ZoomLevel): number | null => {
    switch (zoom) {
      case 'full': return null;
      case 'year': return 368 * 1440; // 368 days
      case 'month': return 92 * 1440; // 1 quarter (92 days)
      case 'week': return 7 * 1440; // 7 days
    }
  };

  // Calculate zoomed timeline range
  const timelineRange = createMemo(() => {
    const full = fullTimelineRange();
    const zoom = zoomLevel();
    const currentTime = props.currentStoryTime();

    if (zoom === 'full') {
      return full;
    }

    // Check if we have a stored zoom window
    const storedStart = zoomWindowStart();
    const storedEnd = zoomWindowEnd();

    if (storedStart !== null && storedEnd !== null) {
      // Use stored window, but check if current time is outside it
      if (currentTime < storedStart || currentTime > storedEnd) {
        // Current time is outside window, recenter
        const windowSize = getWindowSize(zoom)!;
        const halfWindow = windowSize / 2;
        let start = currentTime - halfWindow;
        let end = currentTime + halfWindow;

        // Clamp to full range
        if (start < full.start) {
          const shift = full.start - start;
          start = full.start;
          end = Math.min(end + shift, full.end);
        }
        if (end > full.end) {
          const shift = end - full.end;
          end = full.end;
          start = Math.max(start - shift, full.start);
        }

        // Update stored window
        setZoomWindowStart(start);
        setZoomWindowEnd(end);

        return { start, end, granularity: full.granularity };
      }

      // Use stored window
      return {
        start: storedStart,
        end: storedEnd,
        granularity: full.granularity
      };
    }

    // No stored window, create new one centered on current time
    const windowSize = getWindowSize(zoom)!;
    const halfWindow = windowSize / 2;
    let start = currentTime - halfWindow;
    let end = currentTime + halfWindow;

    // Clamp to full range
    if (start < full.start) {
      const shift = full.start - start;
      start = full.start;
      end = Math.min(end + shift, full.end);
    }
    if (end > full.end) {
      const shift = end - full.end;
      end = full.end;
      start = Math.max(start - shift, full.start);
    }

    // Store the window
    setZoomWindowStart(start);
    setZoomWindowEnd(end);

    return {
      start,
      end,
      granularity: full.granularity
    };
  });

  // Calculate slider configuration
  const sliderSteps = createMemo(() => {
    const range = timelineRange();
    return calculateSliderSteps(range.start, range.end, range.granularity);
  });

  // Current slider position (derived from story time)
  const sliderPosition = createMemo(() => {
    const time = props.pendingStoryTime() !== null ? props.pendingStoryTime()! : props.currentStoryTime();
    const range = timelineRange();
    return storyTimeToSliderPosition(time, range.start, range.granularity);
  });

  // Active chapter at current time
  const activeChapter = createMemo(() => {
    const time = props.currentStoryTime();
    return getChapterAtStoryTime(time, props.nodes());
  });

  // Chapter markers for display
  const chapterMarkers = createMemo(() => {
    const range = timelineRange();
    return getChapterMarkers(props.nodes(), range.start, range.end);
  });

  // Timeline info display
  const timelineInfo = createMemo(() => {
    const time = props.pendingStoryTime() !== null ? props.pendingStoryTime()! : props.currentStoryTime();
    const chapter = activeChapter();
    const range = timelineRange();

    return {
      time: calendarStore.formatStoryTime(time) || '', // Include time of day with hour
      timeWithHour: calendarStore.formatStoryTime(time) || '', // Full time with hour for tooltip
      rawTime: time, // Raw story time number (minutes from 0 BBY)
      chapter: chapter ? `Ch. ${chapter.title}` : 'Before story',
      chapterTitle: chapter?.title || 'No active chapter',
      rangeStart: calendarStore.formatStoryTimeShort(range.start) || '', // Start of visible range (no time)
      rangeEnd: calendarStore.formatStoryTimeShort(range.end) || '' // End of visible range (no time)
    };
  });

  // State change indicators (convert story times to percentages, similar to chapter markers)
  const stateIndicatorPositions = createMemo(() => {
    const range = timelineRange();
    const totalRange = range.end - range.start;
    const storyTimes = props.storyTimesWithStates();

    return storyTimes
      .map(storyTime => {
        // Calculate position as percentage (0-100)
        const position = ((storyTime - range.start) / totalRange) * 100;
        // Only show indicators that are within the timeline range
        if (position < 0 || position > 100) return null;
        return position;
      })
      .filter((pos): pos is number => pos !== null);
  });

  // Fleet movement indicators (convert story times to percentages, similar to chapter markers)
  const fleetIndicatorPositions = createMemo(() => {
    const range = timelineRange();
    const totalRange = range.end - range.start;
    const storyTimes = props.fleetMovementTimes();

    return storyTimes
      .map(storyTime => {
        // Calculate position as percentage (0-100)
        const position = ((storyTime - range.start) / totalRange) * 100;
        // Only show indicators that are within the timeline range
        if (position < 0 || position > 100) return null;
        return position;
      })
      .filter((pos): pos is number => pos !== null);
  });

  // Handle slider input
  const handleSliderInput = (position: number) => {
    const range = timelineRange();
    const newStoryTime = sliderPositionToStoryTime(position, range.start, range.granularity);
    props.onTimelineChange(newStoryTime);
  };

  // Check if we're at the end of timeline
  const isAtEnd = createMemo(() => {
    const pos = sliderPosition();
    const maxPos = sliderSteps();
    return pos >= maxPos;
  });

  // Check if we're at the start of timeline
  const isAtStart = createMemo(() => {
    const pos = sliderPosition();
    return pos <= 0;
  });

  // Show timeline only if we have a valid range
  const hasValidTimeline = createMemo(() => {
    const range = timelineRange();
    return range.end > range.start;
  });

  // Zoom controls
  const handleZoomIn = () => {
    const current = zoomLevel();
    // Clear stored window so it recenters on current time
    setZoomWindowStart(null);
    setZoomWindowEnd(null);

    switch (current) {
      case 'full':
        setZoomLevel('year');
        break;
      case 'year':
        setZoomLevel('month');
        break;
      case 'month':
        setZoomLevel('week');
        break;
      // Already at maximum zoom
    }
  };

  const handleZoomOut = () => {
    const current = zoomLevel();
    // Clear stored window so it recenters on current time
    setZoomWindowStart(null);
    setZoomWindowEnd(null);

    switch (current) {
      case 'week':
        setZoomLevel('month');
        break;
      case 'month':
        setZoomLevel('year');
        break;
      case 'year':
        setZoomLevel('full');
        break;
      // Already at minimum zoom
    }
  };

  const zoomLabel = createMemo(() => {
    switch (zoomLevel()) {
      case 'full': return 'Full';
      case 'year': return '1 Year';
      case 'month': return '1 Quarter';
      case 'week': return '1 Week';
    }
  });

  return (
    <Show when={hasValidTimeline()}>
      <div class={styles.timelineSection}>
        <div class={styles.timelineHeader}>
          <div class={styles.timelineInfo}>
            <div class={styles.timelinePosition} title={`${timelineInfo().timeWithHour} (Raw: ${timelineInfo().rawTime})`}>
              {timelineInfo().time}
            </div>
            <div class={styles.timelineRawTime}>
              Raw: {timelineInfo().rawTime}
            </div>
            <Show when={timelineInfo().chapter}>
              <div class={styles.timelineChapter} title={timelineInfo().chapterTitle}>
                {timelineInfo().chapter}
              </div>
            </Show>
          </div>
          <div class={styles.timelineActions}>
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
              onClick={props.onReset}
              disabled={props.pendingStoryTime() === null && isAtEnd()}
            >
              Latest
            </button>
          </div>
        </div>
        <div class={styles.timelineControls}>
          <button
            class={styles.timelineStepButton}
            onClick={() => props.onStep('back')}
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
              onInput={(e) => handleSliderInput(parseInt(e.target.value))}
            />
            {/* State change indicators */}
            <div class={styles.timelineIndicators}>
              {stateIndicatorPositions().map((position) => (
                <div
                  class={styles.timelineIndicator}
                  style={{ left: `${position}%` }}
                  title="Landmark state change"
                />
              ))}
            </div>
            {/* Fleet movement indicators */}
            <div class={styles.timelineIndicators}>
              {fleetIndicatorPositions().map((position) => (
                <div
                  class={styles.fleetIndicator}
                  style={{ left: `${position}%` }}
                  title="Fleet movement"
                />
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
                      props.onTimelineChange(marker.chapter.storyTime);
                    }
                  }}
                />
              ))}
            </div>
          </div>
          <button
            class={styles.timelineStepButton}
            onClick={() => props.onStep('forward')}
            disabled={isAtEnd()}
            title="Next step"
          >
            <BsChevronRight />
          </button>
        </div>
        <Show when={zoomLevel() !== 'full'}>
          <div class={styles.timelineRangeLabels}>
            <span class={styles.rangeLabel}>{timelineInfo().rangeStart}</span>
            <span class={styles.rangeLabel}>{timelineInfo().rangeEnd}</span>
          </div>
        </Show>
      </div>
    </Show>
  );
};
