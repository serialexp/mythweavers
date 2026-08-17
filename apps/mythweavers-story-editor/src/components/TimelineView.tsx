import { Button } from '@mythweavers/ui'
import { Component, For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import {
  PhArrowCounterClockwiseIcon,
  PhMagnifyingGlassMinusIcon,
  PhMagnifyingGlassPlusIcon,
  PhWarningIcon,
} from 'solidjs-phosphor'
import { saveService } from '../services/saveService'
import { calendarStore } from '../stores/calendarStore'
import { charactersStore } from '../stores/charactersStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { nodeStore } from '../stores/nodeStore'
import { timelineViewStore } from '../stores/timelineViewStore'
import { Node } from '../types/core'
import { getCharacterDisplayName } from '../utils/character'
import { getScenesInStoryOrder } from '../utils/nodeTraversal'
import { measureTextWidth } from '../utils/textWidth'
import {
  ResolvedSceneTime,
  Viewport,
  assignStackLanes,
  buildUnitLadder,
  exceedsDragThreshold,
  generateTicks,
  hasStoryTime,
  panViewport,
  pickLabelledItems,
  pickSnapStep,
  pixelDeltaToMinutes,
  rectFromPoints,
  rectsIntersect,
  resolveSceneTimes,
  sceneTimeExtent,
  snapTime,
  timeToFraction,
  zoomViewport,
} from '../utils/timelineLayout'
import * as styles from './TimelineView.css'

const GUTTER_PX = 170
/**
 * On a 375px phone the full gutter eats 45% of the screen. The label still has
 * to name the POV character, so it shrinks rather than disappears.
 */
const GUTTER_COMPACT_PX = 96
const COMPACT_WIDTH_PX = 640
/**
 * Clear space demanded between one chip's label and the next chip. The label's
 * own width is measured, so this is only the breathing room around it.
 */
const LABEL_GAP_PX = 12
/**
 * Chip chrome that sits around the text: horizontal padding plus borders. Added
 * to the measured label so the *chip* is what gets spaced, not just its text.
 */
const CHIP_CHROME_PX = 18
/** `chipLabel` ellipsises past this, so a longer title costs no more room. */
const CHIP_LABEL_MAX_PX = 220
/** Matches `chipLabel`: `tokens.font.size.xs` on the app's default family. */
const CHIP_LABEL_FONT_SIZE_PX = 12
const CHIP_LABEL_FONT = `${CHIP_LABEL_FONT_SIZE_PX}px system-ui, -apple-system, sans-serif`
/** Chip height plus enough breathing room for its expanded hit target. */
const STACK_ROW_HEIGHT_PX = 44
/** Keep a little DOM either side of the viewport so panning doesn't flicker. */
const CULL_MARGIN = 0.25
/**
 * Touch only: how long a finger rests on a chip before it lifts for dragging.
 * A mouse drags immediately -- making a mouse wait would be a regression, and
 * `pointerType` lets a touchscreen laptop have both behaviours at once.
 */
const LONG_PRESS_MS = 450
/** Finger jitter allowed while the long press counts down. */
const LONG_PRESS_SLOP_PX = 10

interface TimelineViewProps {
  /** Called after a scene is opened in the editor, so the panel can close. */
  onSelectScene?: () => void
}

interface DragState {
  /**
   * `pending` is a touch press that has not yet resolved: holding still turns
   * it into a `scene` lift or a `marquee`, moving turns it into a `pan`, and
   * releasing makes it a tap.
   */
  kind: 'scene' | 'marquee' | 'pan' | 'pending'
  pointerId: number
  startClientX: number
  startClientY: number
  /** Set once the pointer has moved beyond the click threshold. */
  active: boolean
  /** The chip under the initial press, if any. Drives what `pending` becomes. */
  sceneId?: string
}

export const TimelineView: Component<TimelineViewProps> = (props) => {
  let surfaceRef: HTMLDivElement | undefined

  const [surfaceWidth, setSurfaceWidth] = createSignal(1)
  const gutterPx = () => (surfaceWidth() < COMPACT_WIDTH_PX ? GUTTER_COMPACT_PX : GUTTER_PX)
  const trackWidth = () => Math.max(1, surfaceWidth() - gutterPx())
  const [selection, setSelection] = createSignal<Set<string>>(new Set())
  const [dragDeltaMinutes, setDragDeltaMinutes] = createSignal(0)
  const [marqueeRect, setMarqueeRect] = createSignal<{ x: number; y: number; w: number; h: number } | null>(null)
  const [undoStack, setUndoStack] = createSignal<Array<Array<{ id: string; previous: number | null }>>>([])
  const [isPanning, setIsPanning] = createSignal(false)
  /** True between a long-press lift and the release that ends it. */
  const [lifted, setLifted] = createSignal(false)

  /**
   * Inferred positions are frozen for the duration of a drag. Left live, moving
   * one scene would shift every untimed neighbour out from under the cursor.
   */
  const [frozenTimes, setFrozenTimes] = createSignal<Map<string, ResolvedSceneTime> | null>(null)

  let drag: DragState | null = null
  let viewportAtDragStart: Viewport | null = null
  let longPressTimer: ReturnType<typeof setTimeout> | undefined

  /** Every pointer currently down, in press order. Two of them means a pinch. */
  const activePointers = new Map<number, { x: number; y: number }>()

  interface PinchState {
    /**
     * The exact two pointers being measured. Pinned rather than re-derived each
     * frame: with a third finger down, lifting one of the original pair would
     * otherwise silently swap in the spare and jump the view, because
     * startDistance still describes the pair that began the gesture.
     */
    ids: [number, number]
    startDistance: number
    startMidX: number
    startViewport: Viewport
    /** Held fixed so the content under the initial midpoint stays put. */
    anchorFraction: number
  }
  let pinch: PinchState | null = null

  // --- Calendar-derived units ------------------------------------------------

  const calendarConfig = () => calendarStore.getEngine().config

  const unitLadder = createMemo(() => {
    const cfg = calendarConfig()
    return buildUnitLadder(cfg.minutesPerHour, cfg.minutesPerDay, cfg.daysPerYear)
  })

  /** Step used to space scenes that have no timed neighbour to interpolate from. */
  const fallbackStep = () => calendarConfig().minutesPerDay || 1440

  // --- Scenes ----------------------------------------------------------------

  // Returns store proxies, so <For> keeps row identity across recomputes.
  const scenesInNarrativeOrder = createMemo(() => getScenesInStoryOrder(nodeStore.nodesArray))

  /**
   * `getScenesInStoryOrder` walks down from the roots, so a scene whose ancestor
   * chain is broken (partial load, or a chapter deleted before its scenes
   * arrive) is silently skipped. Count them rather than let them vanish.
   */
  const orphanCount = createMemo(() => {
    const total = nodeStore.nodesArray.filter((n) => n.type === 'scene').length
    return Math.max(0, total - scenesInNarrativeOrder().length)
  })

  const resolvedTimes = createMemo(() => resolveSceneTimes(scenesInNarrativeOrder(), fallbackStep()))

  /** Frozen during a drag, live otherwise. */
  const effectiveTimes = () => frozenTimes() ?? resolvedTimes()

  const conflictCount = createMemo(() => {
    let count = 0
    for (const entry of resolvedTimes().values()) {
      if (entry.confidence === 'unknown') count++
    }
    return count
  })

  const anyTimed = createMemo(() => scenesInNarrativeOrder().some(hasStoryTime))

  // --- Lanes -----------------------------------------------------------------

  const protagonistId = createMemo(() => charactersStore.characters.find((c) => c.isMainCharacter)?.id)

  /**
   * A scene with no explicit viewpoint already displays as the protagonist's
   * everywhere else in the app (see NodeHeader), so lanes follow the same rule.
   */
  const laneKeyFor = (scene: Node): string => scene.viewpointCharacterId || protagonistId() || ''

  const laneIds = createMemo(() => {
    const seen = new Set<string>()
    const ids: string[] = []
    for (const scene of scenesInNarrativeOrder()) {
      const key = laneKeyFor(scene)
      if (!seen.has(key)) {
        seen.add(key)
        ids.push(key)
      }
    }
    // Keep the "no POV" lane last so named characters read first.
    ids.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : 0))
    return ids
  })

  const scenesByLane = createMemo(() => {
    const map = new Map<string, Node[]>()
    for (const scene of scenesInNarrativeOrder()) {
      const key = laneKeyFor(scene)
      const list = map.get(key)
      if (list) list.push(scene)
      else map.set(key, [scene])
    }
    return map
  })

  const laneLabel = (laneId: string): string => {
    if (!laneId) return 'No viewpoint'
    const character = charactersStore.characters.find((c) => c.id === laneId)
    return character ? getCharacterDisplayName(character) : 'Unknown character'
  }

  /** Stable per-character hue, since Character carries no colour of its own. */
  const laneColor = (laneId: string): string => {
    if (!laneId) return styles.neutralLaneColor
    let hash = 0
    for (let i = 0; i < laneId.length; i++) {
      hash = (hash * 31 + laneId.charCodeAt(i)) >>> 0
    }
    return `hsl(${hash % 360} 65% 55%)`
  }

  // --- Viewport --------------------------------------------------------------

  const defaultViewport = (): Viewport => {
    const extent = sceneTimeExtent(scenesInNarrativeOrder(), fallbackStep())
    if (extent) return extent
    const day = fallbackStep()
    return { start: -180 * day, end: 180 * day }
  }

  const viewport = (): Viewport => timelineViewStore.viewport ?? defaultViewport()
  const setViewport = (next: Viewport) => timelineViewStore.setViewport(next)

  const snapStep = createMemo(() => pickSnapStep(viewport(), trackWidth(), unitLadder()))

  // --- Tick labels -----------------------------------------------------------

  // formatDate compiles an EJS template on every call, so labels are cached by
  // tick time. The date no longer depends on the step, but dropping the cache
  // when the step changes still bounds it -- otherwise panning across a long
  // story accumulates an entry per tick visited, forever.
  let labelCache = new Map<number, string>()
  let labelCacheStep = -1

  const formatTickDate = (time: number, step: number): string => {
    if (step !== labelCacheStep) {
      labelCache = new Map()
      labelCacheStep = step
    }
    const cached = labelCache.get(time)
    if (cached !== undefined) return cached
    const label = calendarStore.formatStoryTimeShort(time) ?? ''
    labelCache.set(time, label)
    return label
  }

  /**
   * Widen the tick spacing until labels have room to breathe.
   *
   * This must precede every eager memo that reads it. Solid evaluates a
   * `createMemo` body while registering the memo, so declaring this accessor
   * later would access its `const` binding while it is still in the temporal
   * dead zone when the timeline mounts.
   */
  const tickMultiple = () => {
    const stepPx = (snapStep() / (viewport().end - viewport().start)) * trackWidth()
    if (stepPx <= 0) return 1
    return Math.max(1, Math.ceil(110 / stepPx))
  }

  const ticks = createMemo(() => generateTicks(viewport(), snapStep() * tickMultiple()))

  /** True once ticks are finer than a day, when the time of day starts mattering. */
  const rulerShowsTime = () => snapStep() * tickMultiple() < (calendarConfig().minutesPerDay || 1440)

  /**
   * One row per tick: the date, whether to print it, and the time of day.
   *
   * The date is printed only when it differs from the previous tick. Zoomed in
   * past a day, every tick used to repeat the full date *and* the time on one
   * nowrap line -- roughly 44 characters where the spacing budget allows about
   * 17 -- so each label ran straight over its neighbour. Splitting the two
   * across lines also separates the collision: dates only ever contend with
   * other dates, which are now a day apart.
   */
  const tickRows = createMemo(() => {
    const step = snapStep() * tickMultiple()
    const withTime = rulerShowsTime()
    let previousDate: string | null = null

    return ticks().map((time) => {
      const date = formatTickDate(time, step)
      const showDate = date !== previousDate
      previousDate = date
      return {
        time,
        date,
        showDate,
        timeOfDay: withTime ? (calendarStore.formatTimeOfDay(time) ?? '') : '',
      }
    })
  })

  /** Legacy chapter story times, drawn as orientation marks only. */
  /**
   * Scene id to the title of its nearest chapter ancestor.
   *
   * Scene titles are frequently autogenerated, and a chapter that holds exactly
   * one scene reads as an unrecognisable label without its chapter for context.
   * Walks upwards rather than reading `parentId` directly, since a scene can sit
   * under an arc or book that only later resolves to a chapter.
   */
  const chapterTitleByScene = createMemo(() => {
    const byId = new Map(nodeStore.nodesArray.map((node) => [node.id, node]))
    const titles = new Map<string, string>()

    for (const scene of scenesInNarrativeOrder()) {
      const seen = new Set<string>([scene.id])
      let current = scene.parentId ? byId.get(scene.parentId) : undefined

      // `seen` guards against a parent cycle from a bad drag-and-drop write:
      // an unbounded walk would hang the whole panel.
      while (current && !seen.has(current.id)) {
        seen.add(current.id)
        if (current.type === 'chapter') {
          const title = current.title?.trim()
          if (title) titles.set(scene.id, title)
          break
        }
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
    }

    return titles
  })

  /** The chapter part of a chip label, or null when it would add nothing. */
  const chapterPrefixFor = (scene: Node): string | null => {
    const chapterTitle = chapterTitleByScene().get(scene.id)
    if (!chapterTitle) return null
    // A scene named after its chapter would otherwise read "Arrival · Arrival".
    if (chapterTitle.toLowerCase() === scene.title?.trim().toLowerCase()) return null
    return chapterTitle
  }

  /** Full "Chapter · Scene" text, for tooltips and for chips collapsed to dots. */
  const fullSceneLabel = (scene: Node): string => {
    const prefix = chapterPrefixFor(scene)
    return prefix ? `${prefix} · ${scene.title}` : scene.title
  }

  /**
   * How much horizontal room a chip needs once labelled: its text, clamped to
   * the CSS ellipsis width, plus the chip's own padding and borders.
   */
  const chipWidthPx = (scene: Node): number => {
    const text = measureTextWidth(fullSceneLabel(scene), CHIP_LABEL_FONT, CHIP_LABEL_FONT_SIZE_PX)
    return Math.min(text, CHIP_LABEL_MAX_PX) + CHIP_CHROME_PX
  }

  const chapterMarks = createMemo(() =>
    nodeStore.nodesArray.filter((n) => n.type === 'chapter' && hasStoryTime(n)).map((n) => n.storyTime as number),
  )

  // --- Stacking and label density --------------------------------------------

  /**
   * Chips in the same POV lane get vertically stacked whenever their maximum
   * label/hit footprints would collide. This makes equal or near-equal story
   * times individually visible and targetable without moving their time axis.
   */
  const stackLayouts = createMemo(() => {
    const times = effectiveTimes()
    const vp = viewport()
    const width = trackWidth()
    const layouts = new Map<string, ReturnType<typeof assignStackLanes>>()
    for (const [laneId, scenes] of scenesByLane()) {
      // Only the scenes currently in view can require a stack row. Off-screen
      // scenes must not leave empty vertical space after zooming into one moment.
      const visibleScenes = scenes.filter((scene) => {
        const time = times.get(scene.id)?.time ?? 0
        const fraction = timeToFraction(time, vp)
        return fraction >= -CULL_MARGIN && fraction <= 1 + CULL_MARGIN
      })
      layouts.set(
        laneId,
        assignStackLanes(
          visibleScenes.map((scene) => ({
            id: scene.id,
            time: times.get(scene.id)?.time ?? 0,
            // Include the horizontal hit expansion on both sides as well.
            widthPx: chipWidthPx(scene) + 16,
          })),
          vp,
          width,
        ),
      )
    }
    return layouts
  })

  /**
   * Ids of scenes with enough clear space to show their title. Recomputed on
   * committed times only, never mid-drag.
   */
  const labelledScenes = createMemo(() => {
    const times = resolvedTimes()
    const vp = viewport()
    const width = trackWidth()
    const span = vp.end - vp.start
    if (span <= 0 || width <= 0) return new Set<string>()

    // Each lane is packed independently: chips only ever collide with others on
    // their own row.
    const allowed = new Set<string>()
    for (const [, scenes] of scenesByLane()) {
      const candidates = scenes.map((scene) => ({
        id: scene.id,
        time: times.get(scene.id)?.time ?? 0,
        widthPx: chipWidthPx(scene),
      }))
      for (const id of pickLabelledItems(candidates, vp, width, LABEL_GAP_PX)) {
        allowed.add(id)
      }
    }
    return allowed
  })

  // --- Commit ----------------------------------------------------------------

  /**
   * The single write path for scene times. Everything funnels through here so
   * the scene-only guard and the integer rounding cannot be bypassed.
   */
  const commitStoryTimes = (entries: Array<{ id: string; time: number | null }>) => {
    const storyId = currentStoryStore.id
    const undoEntry: Array<{ id: string; previous: number | null }> = []
    const changed: Node[] = []

    for (const entry of entries) {
      const node = nodeStore.getNode(entry.id)
      if (!node) continue

      // Only scenes persist storyTime: both the scene PATCH and the bulk-update
      // route drop it for other node types, which would leave the UI showing a
      // move the database never took.
      if (node.type !== 'scene') {
        console.error('[TimelineView] refusing to set storyTime on a non-scene node', node.id, node.type)
        continue
      }

      // The API validates storyTime as z.number().int(), and the bulk route
      // validates the whole array -- one float rejects every scene in the drag.
      const next = entry.time === null ? null : Math.round(entry.time)
      const previous = node.storyTime ?? null
      if (previous === next) continue

      undoEntry.push({ id: node.id, previous })
      nodeStore.updateNodeNoSave(node.id, { storyTime: next })

      // Re-read after the write so the payload carries the freshest values for
      // every other field, not a snapshot taken when the drag began.
      const updated = nodeStore.getNode(node.id)
      if (updated) changed.push(updated)
    }

    if (changed.length === 0) return
    if (storyId) saveService.saveNodesBulk(storyId, changed)
    setUndoStack((stack) => [...stack.slice(-19), undoEntry])
  }

  const undo = () => {
    const stack = undoStack()
    const last = stack[stack.length - 1]
    setUndoStack(stack.slice(0, -1))
    if (!last) return
    // Restoring is just another commit, so it re-checks that each node still
    // exists and is still a scene.
    commitStoryTimes(last.map((e) => ({ id: e.id, time: e.previous })))
    // The restore pushed its own undo entry; drop it so undo doesn't ping-pong.
    setUndoStack((s) => s.slice(0, -1))
  }

  // --- Selection -------------------------------------------------------------

  const selectOnly = (id: string) => setSelection(new Set([id]))

  const toggleSelected = (id: string) =>
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const clearSelection = () => setSelection(new Set<string>())

  // --- Pointer interaction ---------------------------------------------------

  const measure = () => {
    if (surfaceRef) setSurfaceWidth(Math.max(1, surfaceRef.clientWidth))
  }

  /** Client X to a 0..1 position along the track, excluding the label gutter. */
  const trackFraction = (clientX: number, bounds: DOMRect): number =>
    Math.min(1, Math.max(0, (clientX - bounds.left - gutterPx()) / trackWidth()))

  const beginPinch = () => {
    const ids = [...activePointers.keys()].slice(0, 2) as [number, number]
    const a = activePointers.get(ids[0])
    const b = activePointers.get(ids[1])
    if (!a || !b || !surfaceRef) return
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    if (distance < 1) return

    // A second finger means the user switched to zooming. Abandon whatever the
    // first finger was doing rather than committing a move they stopped aiming.
    drag = null
    clearLongPress()
    resetTransient()

    const midX = (a.x + b.x) / 2
    pinch = {
      ids,
      startDistance: distance,
      startMidX: midX,
      startViewport: viewport(),
      anchorFraction: trackFraction(midX, surfaceRef.getBoundingClientRect()),
    }
  }

  const updatePinch = () => {
    if (!pinch) return
    const a = activePointers.get(pinch.ids[0])
    const b = activePointers.get(pinch.ids[1])
    if (!a || !b) return
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    if (distance < 1) return

    // Recomputed from the pinch-start viewport every frame rather than from the
    // last one, so repeated rounding can't drift the view out from under them.
    // Spreading fingers (distance up) must zoom in, which is a factor below 1.
    const zoomed = zoomViewport(pinch.startViewport, pinch.startDistance / distance, pinch.anchorFraction)
    const midX = (a.x + b.x) / 2
    setViewport(panViewport(zoomed, -pixelDeltaToMinutes(midX - pinch.startMidX, zoomed, trackWidth())))
  }

  /**
   * Ends the pinch when a finger leaves. The survivor is deliberately not
   * promoted into a drag: the view would lurch from wherever it happens to sit.
   */
  const forgetPointer = (pointerId: number) => {
    activePointers.delete(pointerId)
    if (pinch?.ids.includes(pointerId)) pinch = null
  }

  const clearLongPress = () => {
    if (longPressTimer !== undefined) {
      clearTimeout(longPressTimer)
      longPressTimer = undefined
    }
  }

  /**
   * The long press elapsed without the finger wandering, so commit to the
   * gesture it was reaching for.
   */
  const liftForDrag = () => {
    longPressTimer = undefined
    if (!drag || drag.kind !== 'pending') return

    if (drag.sceneId) {
      drag.kind = 'scene'
      // Add rather than replace: long-pressing one chip of an existing
      // multi-selection must pick up the whole set, not collapse it to one.
      if (!selection().has(drag.sceneId)) selectOnly(drag.sceneId)
      setFrozenTimes(new Map(resolvedTimes()))
      setLifted(true)
    } else {
      drag.kind = 'marquee'
    }
    // A finger gets no cursor change, so the buzz is the only feedback that
    // the press registered. Absent on iOS Safari; the visual lift covers it.
    navigator.vibrate?.(12)
  }

  /**
   * A middle press on a scrollable element starts the browser's own autoscroll,
   * which then fights the pan for the same pointer. Pointer events can't cancel
   * it -- only the compatibility mousedown can -- so it is suppressed natively.
   */
  const suppressMiddleClickAutoscroll = (event: MouseEvent) => {
    if (event.button === 1) event.preventDefault()
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    // Capture on the surface, not the chip: chips live inside <For> and can be
    // recreated or unmounted mid-drag (a websocket node update is enough), which
    // would silently drop the capture and freeze the gesture. Every pointer is
    // captured, not just the first, so a pinch keeps reporting both fingers even
    // if one strays outside the surface.
    surfaceRef?.setPointerCapture(event.pointerId)
    if (activePointers.size === 2) {
      beginPinch()
      return
    }
    // Three-plus fingers, or a stray press during a pinch, are noise.
    if (activePointers.size > 2 || pinch) return

    const target = event.target as HTMLElement
    const chipEl = target.closest<HTMLElement>('[data-scene-id]')
    const sceneId = chipEl?.dataset.sceneId

    const base = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      active: false,
      sceneId,
    }

    // Middle button or alt-drag pans; everything else selects or drags.
    const wantsPan = event.button === 1 || event.altKey

    if (event.pointerType === 'touch' && !wantsPan) {
      // Touch defers every decision. A plain drag pans -- the only horizontal
      // navigation a finger can express -- so picking a scene up has to be
      // gated behind something a pan can't be mistaken for.
      drag = { ...base, kind: 'pending' }
      clearLongPress()
      longPressTimer = setTimeout(liftForDrag, LONG_PRESS_MS)
    } else if (wantsPan) {
      drag = { ...base, kind: 'pan' }
    } else if (sceneId) {
      if (event.ctrlKey || event.metaKey) {
        toggleSelected(sceneId)
      } else if (!selection().has(sceneId)) {
        selectOnly(sceneId)
      }
      drag = { ...base, kind: 'scene' }
    } else {
      if (!event.ctrlKey && !event.metaKey) clearSelection()
      drag = { ...base, kind: 'marquee' }
    }

    viewportAtDragStart = viewport()
  }

  const handlePointerMove = (event: PointerEvent) => {
    const tracked = activePointers.get(event.pointerId)
    if (tracked) {
      tracked.x = event.clientX
      tracked.y = event.clientY
    }
    if (pinch) {
      updatePinch()
      return
    }

    if (!drag || event.pointerId !== drag.pointerId) return
    const dx = event.clientX - drag.startClientX
    const dy = event.clientY - drag.startClientY

    if (drag.kind === 'pending') {
      // The finger moved before the press elapsed, so this is a pan. Give up on
      // the pickup rather than fighting a gesture already in motion.
      if (!exceedsDragThreshold(dx, dy, LONG_PRESS_SLOP_PX)) return
      clearLongPress()
      drag.kind = 'pan'
    }

    if (!drag.active) {
      if (!exceedsDragThreshold(dx, dy)) return
      drag.active = true
      if (drag.kind === 'scene' && !frozenTimes()) {
        // Snapshot inferred positions so untimed neighbours hold still.
        // Already taken if a long press lifted this drag.
        setFrozenTimes(new Map(resolvedTimes()))
      }
      if (drag.kind === 'pan') setIsPanning(true)
    }

    if (drag.kind === 'scene') {
      const raw = pixelDeltaToMinutes(dx, viewport(), trackWidth())
      setDragDeltaMinutes(raw)
      return
    }

    if (drag.kind === 'pan') {
      const base = viewportAtDragStart ?? viewport()
      setViewport(panViewport(base, -pixelDeltaToMinutes(dx, base, trackWidth())))
      return
    }

    // Marquee: rect in surface-local coordinates.
    const bounds = surfaceRef?.getBoundingClientRect()
    if (!bounds) return
    const x1 = drag.startClientX - bounds.left
    const y1 = drag.startClientY - bounds.top + (surfaceRef?.scrollTop ?? 0)
    const x2 = event.clientX - bounds.left
    const y2 = event.clientY - bounds.top + (surfaceRef?.scrollTop ?? 0)
    setMarqueeRect({
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    })
  }

  const finishDrag = (event: PointerEvent) => {
    forgetPointer(event.pointerId)
    // `beginPinch` nulls the drag, so a pinch never reaches the commit below.
    if (!drag || event.pointerId !== drag.pointerId) return
    const current = drag
    drag = null
    clearLongPress()
    surfaceRef?.releasePointerCapture?.(event.pointerId)

    if (!current.active) {
      // Below threshold. On mouse the click was already handled on pointerdown;
      // on touch the selection is deliberately deferred to here, so that a long
      // press landing on an already-selected chip picks it up instead of
      // toggling it off underneath the drag.
      if (current.kind === 'pending') {
        if (current.sceneId) toggleSelected(current.sceneId)
        else clearSelection()
      }
      resetTransient()
      return
    }

    if (current.kind === 'scene') {
      const delta = dragDeltaMinutes()
      const times = effectiveTimes()
      const step = event.shiftKey ? 1 : snapStep()
      const entries: Array<{ id: string; time: number }> = []
      for (const id of selection()) {
        const base = times.get(id)
        if (!base) continue
        entries.push({ id, time: snapTime(base.time + delta, step) })
      }
      commitStoryTimes(entries)
    } else if (current.kind === 'marquee') {
      const rect = marqueeRect()
      if (rect && surfaceRef) {
        const bounds = surfaceRef.getBoundingClientRect()
        const scrollTop = surfaceRef.scrollTop
        const marquee = rectFromPoints(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h)
        const hits = new Set(event.ctrlKey || event.metaKey ? selection() : [])
        for (const el of surfaceRef.querySelectorAll<HTMLElement>('[data-scene-id]')) {
          const r = el.getBoundingClientRect()
          const local = {
            left: r.left - bounds.left,
            right: r.right - bounds.left,
            top: r.top - bounds.top + scrollTop,
            bottom: r.bottom - bounds.top + scrollTop,
          }
          if (rectsIntersect(marquee, local)) hits.add(el.dataset.sceneId as string)
        }
        setSelection(hits)
      }
    }

    resetTransient()
  }

  /**
   * The browser took the gesture away. On touch this is routine: `pan-y` lets
   * it claim anything it reads as a page scroll. Abandon the drag -- routing
   * this through finishDrag would commit a move the user never released.
   */
  const cancelDrag = (event: PointerEvent) => {
    forgetPointer(event.pointerId)
    if (!drag || event.pointerId !== drag.pointerId) return
    drag = null
    clearLongPress()
    surfaceRef?.releasePointerCapture?.(event.pointerId)
    resetTransient()
  }

  const resetTransient = () => {
    setDragDeltaMinutes(0)
    setMarqueeRect(null)
    setFrozenTimes(null)
    setIsPanning(false)
    setLifted(false)
    viewportAtDragStart = null
  }

  /**
   * `touch-action: pan-y` leaves the browser free to claim a vertical drift as a
   * page scroll, which would cancel a chip the user has already picked up. Only
   * a non-passive touchmove can refuse that, and only before the scroll starts
   * -- which holds here, because the lift always lands before any movement.
   */
  const suppressScrollWhileLifted = (event: TouchEvent) => {
    // Also while pinching: two fingers on a `pan-y` surface would otherwise be
    // read as a two-finger scroll and cancel the zoom partway through.
    if ((lifted() || pinch) && event.cancelable) event.preventDefault()
  }

  const handleWheel = (event: WheelEvent) => {
    if (!surfaceRef) return
    // deltaMode is DOM_DELTA_LINE on Firefox and DOM_DELTA_PIXEL on Chrome for
    // the same physical scroll; without normalising, Firefox zooms ~40x faster.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
    const dy = event.deltaY * unit
    const dx = event.deltaX * unit

    if (event.shiftKey || Math.abs(dx) > Math.abs(dy)) {
      event.preventDefault()
      const amount = (event.shiftKey ? dy : dx) || dy
      setViewport(panViewport(viewport(), pixelDeltaToMinutes(amount, viewport(), trackWidth())))
      return
    }

    event.preventDefault()
    const bounds = surfaceRef.getBoundingClientRect()
    const anchor = trackFraction(event.clientX, bounds)
    setViewport(zoomViewport(viewport(), dy > 0 ? 1.15 : 1 / 1.15, anchor))
  }

  const zoomBy = (factor: number) => setViewport(zoomViewport(viewport(), factor, 0.5))

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && drag) {
      // OverlayPanel listens for Escape on the document to close the whole
      // panel; cancelling a drag must not throw the session away with it.
      event.stopPropagation()
      event.preventDefault()
      drag = null
      clearLongPress()
      resetTransient()
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      undo()
    }
  }

  onMount(() => {
    measure()
    const observer = new ResizeObserver(measure)
    if (surfaceRef) {
      observer.observe(surfaceRef)
      // Registered manually because preventDefault must work: the OverlayPanel
      // content scrolls, and an un-prevented wheel scrolls it instead of zooming.
      surfaceRef.addEventListener('wheel', handleWheel, { passive: false })
      surfaceRef.addEventListener('touchmove', suppressScrollWhileLifted, { passive: false })
      surfaceRef.addEventListener('mousedown', suppressMiddleClickAutoscroll)
    }
    onCleanup(() => {
      observer.disconnect()
      surfaceRef?.removeEventListener('wheel', handleWheel)
      surfaceRef?.removeEventListener('touchmove', suppressScrollWhileLifted)
      surfaceRef?.removeEventListener('mousedown', suppressMiddleClickAutoscroll)
      // The panel can close mid-press; a surviving timer would lift a chip in
      // an unmounted view.
      clearLongPress()
    })
  })

  const openScene = (id: string) => {
    nodeStore.selectNode(id)
    props.onSelectScene?.()
  }

  const selectionReadout = createMemo(() => {
    const ids = [...selection()]
    if (ids.length === 0) return null
    if (ids.length > 1) return `${ids.length} scenes selected`
    const entry = effectiveTimes().get(ids[0])
    if (!entry) return '1 scene selected'
    const time = entry.time + dragDeltaMinutes()
    return calendarStore.formatStoryTime(snapTime(time, snapStep())) ?? '1 scene selected'
  })

  return (
    <div class={styles.root} style={{ '--timeline-gutter': `${gutterPx()}px` }}>
      <div class={styles.toolbar}>
        <div class={styles.toolbarGroup}>
          <Button variant="secondary" size="sm" onClick={() => zoomBy(1 / 1.6)} title="Zoom in">
            <PhMagnifyingGlassPlusIcon />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => zoomBy(1.6)} title="Zoom out">
            <PhMagnifyingGlassMinusIcon />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => timelineViewStore.setViewport(null)}
            title="Fit all scenes"
          >
            Fit
          </Button>
        </div>

        <span class={styles.toolbarLabel}>
          {calendarStore.formatStoryTimeShort(viewport().start)} &ndash;{' '}
          {calendarStore.formatStoryTimeShort(viewport().end)}
        </span>

        <span class={styles.touchHint}>Long-press a scene to pick it up</span>

        <div class={styles.toolbarSpacer} />

        {/* Double-tapping a 20px dot is a poor target, so a selected scene can
            always be opened from here instead. */}
        <Show when={selection().size === 1}>
          <Button variant="secondary" size="sm" onClick={() => openScene([...selection()][0])}>
            Open
          </Button>
        </Show>

        <Show when={selectionReadout()}>
          {(text) => <span class={`${styles.readout} ${styles.readoutActive}`}>{text()}</span>}
        </Show>

        <Show when={undoStack().length > 0}>
          <Button variant="secondary" size="sm" onClick={undo} title="Undo last move (Ctrl+Z)">
            <PhArrowCounterClockwiseIcon /> Undo
          </Button>
        </Show>
      </div>

      <Show when={conflictCount() > 0 || orphanCount() > 0}>
        <div class={styles.warning}>
          <PhWarningIcon />
          <span>
            <Show when={conflictCount() > 0}>
              {conflictCount()} scene{conflictCount() === 1 ? '' : 's'} sit between story times that run backwards, so
              no position could be inferred for them.{' '}
            </Show>
            <Show when={orphanCount() > 0}>
              {orphanCount()} scene{orphanCount() === 1 ? '' : 's'} are not reachable from the story tree and are not
              shown.
            </Show>
          </span>
        </div>
      </Show>

      <div
        ref={surfaceRef}
        class={isPanning() ? `${styles.surface} ${styles.surfacePanning}` : styles.surface}
        tabindex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => {
          // Android raises a context menu at roughly the long-press threshold,
          // which would tear the browser's menu open mid-pickup. Only suppress
          // it while a gesture is live, so right-click still works on desktop.
          if (drag) event.preventDefault()
        }}
      >
        <Show
          when={anyTimed()}
          fallback={
            <div class={styles.emptyState}>
              <div class={styles.emptyTitle}>No scene has a story time yet</div>
              <p class={styles.hint}>
                Set a story time on one scene from its node menu, and every other scene will be placed relative to it
                here so you can drag them into position.
              </p>
            </div>
          }
        >
          <div class={`${styles.ruler} ${rulerShowsTime() ? styles.rulerTall : ''}`}>
            <div class={styles.rulerInner}>
              <For each={tickRows()}>
                {(row) => {
                  const left = () => timeToFraction(row.time, viewport()) * 100
                  return (
                    <div class={styles.rulerTick} style={{ left: `${left()}%` }}>
                      {/* Rendered even when blank so the time stays on the
                          second row and lines up across ticks. */}
                      <span class={styles.tickDate}>{row.showDate ? row.date : ''}</span>
                      <Show when={row.timeOfDay}>
                        <span class={styles.tickTime}>{row.timeOfDay}</span>
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </div>

          <div class={styles.lanes}>
            <For each={laneIds()}>
              {(laneId, laneIndex) => (
                <div class={laneIndex() % 2 === 1 ? `${styles.lane} ${styles.laneAlt}` : styles.lane}>
                  <div class={styles.laneLabel}>
                    <span class={styles.laneSwatch} style={{ background: laneColor(laneId) }} />
                    <span class={styles.laneLabelText} title={laneLabel(laneId)}>
                      {laneLabel(laneId)}
                    </span>
                    <span class={styles.laneCount}>{scenesByLane().get(laneId)?.length ?? 0}</span>
                  </div>

                  <div
                    class={styles.laneTrack}
                    style={{ height: `${(stackLayouts().get(laneId)?.rowCount ?? 1) * STACK_ROW_HEIGHT_PX}px` }}
                  >
                    <For each={chapterMarks()}>
                      {(time) => {
                        const left = () => timeToFraction(time, viewport()) * 100
                        return (
                          <Show when={left() >= -5 && left() <= 105}>
                            <div class={styles.chapterMark} style={{ left: `${left()}%` }} />
                          </Show>
                        )
                      }}
                    </For>

                    <For each={scenesByLane().get(laneId) ?? []}>
                      {(scene) => {
                        const resolved = () => effectiveTimes().get(scene.id)
                        const isSelected = () => selection().has(scene.id)
                        // isSelected() is read first deliberately: unselected
                        // chips never touch dragDeltaMinutes, so they don't
                        // subscribe to it and their styles stay untouched
                        // through the whole drag.
                        const time = () => {
                          const base = resolved()?.time ?? 0
                          return isSelected() ? base + dragDeltaMinutes() : base
                        }
                        const fraction = () => timeToFraction(time(), viewport())
                        const visible = () => fraction() >= -CULL_MARGIN && fraction() <= 1 + CULL_MARGIN
                        const confidence = () => resolved()?.confidence ?? 'unknown'
                        const stackLayout = () => stackLayouts().get(laneId)
                        const stackRow = () => stackLayout()?.rows.get(scene.id) ?? 0
                        // A stacked group has its own vertical room, so every
                        // visible member can remain a full, independently
                        // selectable tile instead of collapsing to a dot.
                        const isStacked = () => stackLayout()?.stackedIds.has(scene.id) ?? false
                        const showLabel = () => labelledScenes().has(scene.id) || isSelected() || isStacked()
                        const classes = () => {
                          const parts = [styles.chip[confidence()]]
                          if (!showLabel()) parts.push(styles.chipDot)
                          if (isSelected()) parts.push(styles.chipSelected)
                          if (isSelected() && dragDeltaMinutes() !== 0) parts.push(styles.chipDragging)
                          // The lift lands before any movement, so it is the
                          // only confirmation a finger gets that the long press
                          // took and the chip is now held.
                          if (isSelected() && lifted()) parts.push(styles.chipLifted)
                          return parts.join(' ')
                        }

                        return (
                          <Show when={visible()}>
                            <div
                              data-scene-id={scene.id}
                              class={classes()}
                              style={{
                                left: `${fraction() * 100}%`,
                                top: `${stackRow() * STACK_ROW_HEIGHT_PX + STACK_ROW_HEIGHT_PX / 2}px`,
                              }}
                              onDblClick={() => openScene(scene.id)}
                              // Carries the label for chips collapsed to dots too,
                              // which is where the density makes it hardest to tell
                              // one autogenerated scene title from another.
                              title={fullSceneLabel(scene)}
                            >
                              <Show when={showLabel()}>
                                <span class={styles.chipLabel}>
                                  <Show when={chapterPrefixFor(scene)}>
                                    {(prefix) => (
                                      <>
                                        <span class={styles.chipChapter}>{prefix()}</span>
                                        <span class={styles.chipSeparator}>{' · '}</span>
                                      </>
                                    )}
                                  </Show>
                                  {scene.title}
                                </span>
                              </Show>
                            </div>
                          </Show>
                        )
                      }}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>

          <Show when={marqueeRect()}>
            {(rect) => (
              <div
                class={styles.marquee}
                style={{
                  left: `${rect().x}px`,
                  top: `${rect().y}px`,
                  width: `${rect().w}px`,
                  height: `${rect().h}px`,
                }}
              />
            )}
          </Show>
        </Show>
      </div>
    </div>
  )
}
