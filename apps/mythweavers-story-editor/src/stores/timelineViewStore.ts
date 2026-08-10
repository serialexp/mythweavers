import { createStore } from 'solid-js/store'
import { Viewport } from '../utils/timelineLayout'

/**
 * State for the timeline editor panel.
 *
 * Only the things with more than one observer live here. `showTimeline` is read
 * by StoryHeader to mount the OverlayPanel and written by the header button;
 * `viewport` is kept so closing and reopening the panel does not throw away the
 * zoom the author had set up. Selection, drag offsets and undo are per-gesture
 * and stay as local signals inside the view.
 */
const [timelineState, setTimelineState] = createStore({
  showTimeline: false,
  /** null means "derive from the scenes on next open". */
  viewport: null as Viewport | null,
})

export const timelineViewStore = {
  get showTimeline() {
    return timelineState.showTimeline
  },
  get viewport() {
    return timelineState.viewport
  },

  setShowTimeline: (show: boolean) => setTimelineState('showTimeline', show),
  toggleTimeline: () => setTimelineState('showTimeline', !timelineState.showTimeline),

  setViewport: (viewport: Viewport | null) => setTimelineState('viewport', viewport),

  /** Drop the remembered zoom, e.g. when switching stories. */
  reset: () => setTimelineState({ showTimeline: false, viewport: null }),
}
