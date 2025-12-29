/**
 * History plugin for solid-editor
 *
 * Provides undo/redo functionality with support for:
 * - Transaction grouping by time and adjacency
 * - Selection restoration
 * - Collaboration-ready rebasing
 * - Step merging for efficiency
 *
 * Based on ProseMirror's history plugin architecture.
 */

import type { Command } from '../keymap'
import { EditorState, Plugin, PluginKey, Transaction } from '../state'
import type { SelectionBookmark } from '../state/selection'
import { Mapping, Step, StepMap, Transform } from '../transform'

// ============================================================================
// Constants
// ============================================================================

/** Maximum empty items before compression is triggered */
const MAX_EMPTY_ITEMS = 500

/** Overflow threshold for event count before pruning */
const DEPTH_OVERFLOW = 20

// ============================================================================
// Item class - represents a single entry in the history
// ============================================================================

/**
 * An item in a history branch.
 *
 * Items can be:
 * - A step with its map (undoable change)
 * - Just a map (position adjustment for non-undoable changes)
 * - A step with selection (start of an event group)
 */
class Item {
  constructor(
    /** The (forward) step map for this item */
    readonly map: StepMap,
    /** The inverted step (to undo this change) */
    readonly step?: Step,
    /**
     * If this is non-null, this item starts an event group.
     * The selection is the one before the first step was applied.
     */
    readonly selection?: SelectionBookmark,
    /**
     * If this item is the inverse of a previous mapping,
     * this points at the inverse's offset in the array.
     */
    readonly mirrorOffset?: number,
  ) {}

  /**
   * Try to merge this item with another.
   * Returns merged item or null if they can't be merged.
   */
  merge(other: Item): Item | null {
    if (this.step && other.step && !other.selection) {
      const step = other.step.merge(this.step)
      if (step) {
        return new Item(step.getMap().invert(), step, this.selection)
      }
    }
    return null
  }
}

// ============================================================================
// Branch class - holds undo or redo history
// ============================================================================

/**
 * A branch of history, either undo or redo.
 */
class Branch {
  constructor(
    /** The history items */
    readonly items: Item[],
    /** Number of event groups in this branch */
    readonly eventCount: number,
  ) {}

  /**
   * Pop the latest event from the branch and apply it to a transform.
   * Returns the remaining branch, the transform, and the selection.
   */
  popEvent(
    state: EditorState,
    preserveItems: boolean,
  ): { remaining: Branch; transform: Transform; selection: SelectionBookmark } | null {
    if (this.eventCount === 0) return null

    // Find the end of the latest event (first item with selection, searching backward)
    let end = this.items.length
    for (; end > 0; end--) {
      if (this.items[end - 1].selection) {
        end--
        break
      }
    }

    let remap: Mapping | undefined
    let mapFrom: number | undefined
    if (preserveItems) {
      remap = this.remapping(end, this.items.length)
      mapFrom = remap.maps.length
    }

    const transform = state.tr()
    let selection: SelectionBookmark | undefined
    let remaining: Branch | undefined
    const addAfter: Item[] = []
    const addBefore: Item[] = []

    // Process items from end to start
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]

      if (!item.step) {
        if (!remap) {
          remap = this.remapping(end, i + 1)
          mapFrom = remap.maps.length
        }
        mapFrom!--
        addBefore.push(item)
        continue
      }

      if (remap) {
        addBefore.push(new Item(item.map))
        const step = item.step.map(remap.slice(mapFrom))
        let map: StepMap | undefined

        if (step && transform.maybeStep(step).doc) {
          map = transform.mapping.maps[transform.mapping.maps.length - 1]
          addAfter.push(new Item(map, undefined, undefined, addAfter.length + addBefore.length))
        }
        mapFrom!--
        if (map) remap.appendMap(map, mapFrom)
      } else {
        transform.maybeStep(item.step)
      }

      if (item.selection) {
        selection = remap ? item.selection.map(remap.slice(mapFrom)) : item.selection
        remaining = new Branch(
          this.items.slice(0, end).concat(addBefore.reverse()).concat(addAfter),
          this.eventCount - 1,
        )
        break
      }
    }

    if (!remaining || !selection) return null

    return { remaining, transform, selection }
  }

  /**
   * Add a transform to this branch.
   */
  addTransform(
    transform: Transform,
    selection: SelectionBookmark | undefined,
    histOptions: Required<HistoryOptions>,
    preserveItems: boolean,
  ): Branch {
    const newItems: Item[] = []
    let eventCount = this.eventCount
    let items = this.items
    let lastItem = !preserveItems && items.length ? items[items.length - 1] : null

    for (let i = 0; i < transform.steps.length; i++) {
      const step = transform.steps[i].invert(transform.docs[i])
      const item = new Item(transform.mapping.maps[i], step, selection)
      const merged = lastItem?.merge(item)

      if (merged) {
        // Merge with last item
        if (i > 0) {
          newItems.pop()
        } else {
          items = items.slice(0, items.length - 1)
        }
        newItems.push(merged)
      } else {
        newItems.push(item)
      }

      if (selection) {
        eventCount++
        selection = undefined
      }
      if (!preserveItems) lastItem = newItems[newItems.length - 1]
    }

    // Prune old events if we have too many
    const overflow = eventCount - histOptions.depth
    if (overflow > DEPTH_OVERFLOW) {
      items = cutOffEvents(items, overflow)
      eventCount -= overflow
    }

    return new Branch(items.concat(newItems), eventCount)
  }

  /**
   * Create a mapping from a range of items.
   */
  remapping(from: number, to: number): Mapping {
    const maps = new Mapping()
    for (let i = from; i < to; i++) {
      const item = this.items[i]
      const mirrorPos =
        item.mirrorOffset != null && i - item.mirrorOffset >= from ? maps.maps.length - item.mirrorOffset : undefined
      maps.appendMap(item.map, mirrorPos)
    }
    return maps
  }

  /**
   * Add step maps for non-undoable changes.
   */
  addMaps(array: readonly StepMap[]): Branch {
    if (this.eventCount === 0) return this
    return new Branch(this.items.concat(array.map((map) => new Item(map))), this.eventCount)
  }

  /**
   * Rebase the branch when remote changes arrive (for collaboration).
   */
  rebased(rebasedTransform: Transform, rebasedCount: number): Branch {
    if (!this.eventCount) return this

    const rebasedItems: Item[] = []
    const start = Math.max(0, this.items.length - rebasedCount)

    const mapping = rebasedTransform.mapping
    let newUntil = rebasedTransform.steps.length
    let eventCount = this.eventCount

    // Count events in the rebased portion
    for (let i = start; i < this.items.length; i++) {
      if (this.items[i].selection) eventCount--
    }

    let iRebased = rebasedCount
    for (let i = start; i < this.items.length; i++) {
      const item = this.items[i]
      const pos = mapping.getMirror(--iRebased)
      if (pos == null) continue

      newUntil = Math.min(newUntil, pos)
      const map = mapping.maps[pos]

      if (item.step) {
        const step = rebasedTransform.steps[pos].invert(rebasedTransform.docs[pos])
        const selection = item.selection?.map(mapping.slice(iRebased + 1, pos))
        if (selection) eventCount++
        rebasedItems.push(new Item(map, step, selection))
      } else {
        rebasedItems.push(new Item(map))
      }
    }

    const newMaps: Item[] = []
    for (let i = rebasedCount; i < newUntil; i++) {
      newMaps.push(new Item(mapping.maps[i]))
    }

    const newItems = this.items.slice(0, start).concat(newMaps).concat(rebasedItems)
    let branch = new Branch(newItems, eventCount)

    if (branch.emptyItemCount() > MAX_EMPTY_ITEMS) {
      branch = branch.compress(this.items.length - rebasedItems.length)
    }

    return branch
  }

  /**
   * Count items without steps (map-only items).
   */
  emptyItemCount(): number {
    let count = 0
    for (const item of this.items) {
      if (!item.step) count++
    }
    return count
  }

  /**
   * Compress the branch by removing air (map-only items).
   */
  compress(upto = this.items.length): Branch {
    const remap = this.remapping(0, upto)
    let mapFrom = remap.maps.length
    const items: Item[] = []
    let events = 0

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]

      if (i >= upto) {
        items.push(item)
        if (item.selection) events++
      } else if (item.step) {
        const step = item.step.map(remap.slice(mapFrom))
        const map = step?.getMap()
        mapFrom--
        if (map) remap.appendMap(map, mapFrom)
        if (step) {
          const selection = item.selection?.map(remap.slice(mapFrom))
          if (selection) events++
          const newItem = new Item(map!.invert(), step, selection)
          const merged = items.length && items[items.length - 1].merge(newItem)
          if (merged) {
            items[items.length - 1] = merged
          } else {
            items.push(newItem)
          }
        }
      } else if (item.map) {
        mapFrom--
      }
    }

    return new Branch(items.reverse(), events)
  }

  /** Empty branch */
  static empty = new Branch([], 0)
}

/**
 * Cut off events from the start of the items array.
 */
function cutOffEvents(items: Item[], n: number): Item[] {
  let cutPoint: number | undefined
  for (let i = 0; i < items.length; i++) {
    if (items[i].selection && --n === 0) {
      cutPoint = i
      break
    }
  }
  return cutPoint != null ? items.slice(cutPoint) : items
}

// ============================================================================
// HistoryState class - the plugin's state
// ============================================================================

/**
 * The state tracked by the history plugin.
 */
class HistoryState {
  constructor(
    /** Undo stack */
    readonly done: Branch,
    /** Redo stack */
    readonly undone: Branch,
    /** Previous transaction ranges for adjacency checking */
    readonly prevRanges: readonly number[] | null,
    /** Timestamp of previous transaction */
    readonly prevTime: number,
    /** Previous composition ID for IME handling */
    readonly prevComposition: number,
  ) {}
}

// ============================================================================
// History plugin implementation
// ============================================================================

export interface HistoryOptions {
  /**
   * The amount of history events that are collected before the
   * oldest events are discarded. Defaults to 100.
   */
  depth?: number

  /**
   * The delay between changes after which a new group should be
   * started. Defaults to 500 (milliseconds). Note that when changes
   * aren't adjacent, a new group is always started.
   */
  newGroupDelay?: number
}

/** Plugin key for accessing history state */
export const historyKey = new PluginKey<HistoryState>('history')

/** Plugin key for closing history (forcing new group) */
const closeHistoryKey = new PluginKey('closeHistory')

/**
 * Record a transaction in the history.
 */
function applyTransaction(
  history: HistoryState,
  state: EditorState,
  tr: Transaction,
  options: Required<HistoryOptions>,
): HistoryState {
  // Check if this is a history transaction (undo/redo)
  const historyTr = tr.getMeta(historyKey) as { redo: boolean; historyState: HistoryState } | undefined
  if (historyTr) return historyTr.historyState

  // Check if history should be closed (new group forced)
  if (tr.getMeta(closeHistoryKey)) {
    history = new HistoryState(history.done, history.undone, null, 0, -1)
  }

  const appended = tr.getMeta('appendedTransaction') as Transaction | undefined

  if (tr.steps.length === 0) {
    return history
  }
  if (appended?.getMeta(historyKey)) {
    // This is a follow-up transaction from undo/redo
    const appendedHistoryMeta = appended.getMeta(historyKey) as { redo: boolean }
    if (appendedHistoryMeta.redo) {
      return new HistoryState(
        history.done.addTransform(tr, undefined, options, mustPreserveItems(state)),
        history.undone,
        rangesFor(tr.mapping.maps),
        history.prevTime,
        history.prevComposition,
      )
    }
    return new HistoryState(
      history.done,
      history.undone.addTransform(tr, undefined, options, mustPreserveItems(state)),
      null,
      history.prevTime,
      history.prevComposition,
    )
  }
  if (tr.getMeta('addToHistory') !== false && !(appended && appended.getMeta('addToHistory') === false)) {
    // Normal transaction that should be recorded
    const composition = tr.getMeta('composition') as number | undefined
    const newGroup =
      history.prevTime === 0 ||
      (!appended &&
        history.prevComposition !== composition &&
        (history.prevTime < (tr.time || 0) - options.newGroupDelay || !isAdjacentTo(tr, history.prevRanges!)))

    const prevRanges = appended ? mapRanges(history.prevRanges!, tr.mapping) : rangesFor(tr.mapping.maps)

    return new HistoryState(
      history.done.addTransform(
        tr,
        newGroup ? state.selection.getBookmark() : undefined,
        options,
        mustPreserveItems(state),
      ),
      Branch.empty,
      prevRanges,
      tr.time || 0,
      composition == null ? history.prevComposition : composition,
    )
  }
  // Transaction marked as not to be added to history
  const rebased = tr.getMeta('rebased') as number | undefined
  if (rebased != null) {
    // Collaboration: rebase history through remote changes
    return new HistoryState(
      history.done.rebased(tr, rebased),
      history.undone.rebased(tr, rebased),
      mapRanges(history.prevRanges!, tr.mapping),
      history.prevTime,
      history.prevComposition,
    )
  }
  // Just add the maps for position tracking
  return new HistoryState(
    history.done.addMaps(tr.mapping.maps),
    history.undone.addMaps(tr.mapping.maps),
    mapRanges(history.prevRanges!, tr.mapping),
    history.prevTime,
    history.prevComposition,
  )
}

/**
 * Check if a transform is adjacent to previous ranges.
 */
function isAdjacentTo(transform: Transform, prevRanges: readonly number[]): boolean {
  if (!prevRanges) return false
  if (!transform.docChanged) return true

  let adjacent = false
  transform.mapping.maps[0].forEach((start, end) => {
    for (let i = 0; i < prevRanges.length; i += 2) {
      if (start <= prevRanges[i + 1] && end >= prevRanges[i]) {
        adjacent = true
      }
    }
  })
  return adjacent
}

/**
 * Get the affected ranges from step maps.
 */
function rangesFor(maps: readonly StepMap[]): number[] {
  const result: number[] = []
  for (let i = maps.length - 1; i >= 0 && result.length === 0; i--) {
    maps[i].forEach((_from, _to, from, to) => result.push(from, to))
  }
  return result
}

/**
 * Map ranges through a mapping.
 */
function mapRanges(ranges: readonly number[] | null, mapping: Mapping): number[] | null {
  if (!ranges) return null
  const result: number[] = []
  for (let i = 0; i < ranges.length; i += 2) {
    const from = mapping.map(ranges[i], 1)
    const to = mapping.map(ranges[i + 1], -1)
    if (from <= to) result.push(from, to)
  }
  return result
}

/**
 * Create a history transaction (for undo/redo).
 */
function histTransaction(history: HistoryState, state: EditorState, redo: boolean): Transaction | null {
  const preserveItems = mustPreserveItems(state)
  const histOptions = (historyKey.get(state)!.spec as any).config as Required<HistoryOptions>

  const pop = (redo ? history.undone : history.done).popEvent(state, preserveItems)
  if (!pop) return null

  const added = (redo ? history.done : history.undone).addTransform(
    pop.transform,
    state.selection.getBookmark(),
    histOptions,
    preserveItems,
  )

  const newHist = new HistoryState(redo ? added : pop.remaining, redo ? pop.remaining : added, null, 0, -1)

  // Create a transaction and apply the transform's steps
  const tr = state.tr()
  for (const step of pop.transform.steps) {
    tr.step(step)
  }

  // Resolve the selection from the transaction's doc (after steps are applied)
  // to ensure the selection references the correct document instance
  const selection = pop.selection.resolve(tr.doc)

  return tr.setSelection(selection).setMeta(historyKey, {
    redo,
    historyState: newHist,
  })
}

// Cache for checking if items need to be preserved
let cachedPreserveItems = false
let cachedPreserveItemsPlugins: readonly Plugin[] | null = null

/**
 * Check if any plugin requires preserving history items.
 * This is needed for collaboration where items may need to be rebased.
 */
function mustPreserveItems(state: EditorState): boolean {
  const plugins = state.plugins
  if (cachedPreserveItemsPlugins !== plugins) {
    cachedPreserveItems = false
    cachedPreserveItemsPlugins = plugins
    for (const plugin of plugins) {
      if ((plugin.spec as any).historyPreserveItems) {
        cachedPreserveItems = true
        break
      }
    }
  }
  return cachedPreserveItems
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Set a flag on the given transaction that will prevent further steps
 * from being appended to an existing history event (so that they
 * require a separate undo command to undo).
 */
export function closeHistory(tr: Transaction): Transaction {
  return tr.setMeta(closeHistoryKey, true)
}

/**
 * Create a history plugin.
 *
 * The plugin will track undo and redo stacks, which can be used with
 * the `undo` and `redo` commands.
 *
 * You can set an "addToHistory" metadata property of `false` on a
 * transaction to prevent it from being rolled back by undo.
 */
export function history(config: HistoryOptions = {}): Plugin<HistoryState> {
  const options: Required<HistoryOptions> = {
    depth: config.depth || 100,
    newGroupDelay: config.newGroupDelay || 500,
  }

  return new Plugin<HistoryState>({
    key: historyKey,

    state: {
      init(): HistoryState {
        return new HistoryState(Branch.empty, Branch.empty, null, 0, -1)
      },
      apply(tr: Transaction, hist: HistoryState, state: EditorState): HistoryState {
        return applyTransaction(hist, state, tr, options)
      },
    },

    config: options,

    props: {
      handleDOMEvents: {
        beforeinput(view: { state: EditorState; dispatch: (tr: Transaction) => void }, e: Event): boolean {
          const inputType = (e as InputEvent).inputType
          const command = inputType === 'historyUndo' ? undo : inputType === 'historyRedo' ? redo : null
          if (!command) return false
          e.preventDefault()
          return command(view.state, view.dispatch)
        },
      },
    },
  })
}

/**
 * Build an undo or redo command.
 */
function buildCommand(redo: boolean, scroll: boolean): Command {
  return (state, dispatch) => {
    const hist = historyKey.getState(state)
    if (!hist || (redo ? hist.undone : hist.done).eventCount === 0) return false
    if (dispatch) {
      const tr = histTransaction(hist, state, redo)
      if (tr) dispatch(scroll ? tr.scrollIntoView() : tr)
    }
    return true
  }
}

/** A command that undoes the last change, if any. */
export const undo: Command = buildCommand(false, true)

/** A command that redoes the last undone change, if any. */
export const redo: Command = buildCommand(true, true)

/** A command that undoes without scrolling the selection into view. */
export const undoNoScroll: Command = buildCommand(false, false)

/** A command that redoes without scrolling the selection into view. */
export const redoNoScroll: Command = buildCommand(true, false)

/** The amount of undoable events available in a given state. */
export function undoDepth(state: EditorState): number {
  const hist = historyKey.getState(state)
  return hist ? hist.done.eventCount : 0
}

/** The amount of redoable events available in a given editor state. */
export function redoDepth(state: EditorState): number {
  const hist = historyKey.getState(state)
  return hist ? hist.undone.eventCount : 0
}

/** Check if a transaction was generated by the history plugin. */
export function isHistoryTransaction(tr: Transaction): boolean {
  return tr.getMeta(historyKey) != null
}
