import { type Accessor, createSignal } from 'solid-js'
import type { Node } from '../model'
import type { Transaction } from '../state'
import type { Mapping } from '../transform'
import { type Decoration, DecorationSet, isInline, isSpan, isWidget } from './decoration'

/**
 * A tracked decoration that automatically adjusts its position
 * when the document changes.
 */
export interface TrackedDecoration {
  /** Unique ID for this tracked decoration */
  id: string
  /** The decoration (positions will be updated automatically) */
  decoration: Decoration
  /** Remove this decoration */
  remove: () => void
}

/**
 * Manages decorations that automatically track their positions
 * through document changes.
 *
 * Unlike plugin-provided decorations which need manual mapping,
 * tracked decorations "just work" - add them once and they stay
 * attached to their content as the document changes.
 */
export class DecorationManager {
  private decorations: Map<string, Decoration> = new Map()
  private nextId = 1
  private version: Accessor<number>
  private setVersion: (fn: (v: number) => number) => void

  constructor() {
    // Signal to trigger reactivity when decorations change
    const [version, setVersion] = createSignal(0)
    this.version = version
    this.setVersion = setVersion
  }

  /**
   * Add a decoration that will be tracked through document changes.
   * Returns a TrackedDecoration with a remove() method.
   */
  add(decoration: Decoration): TrackedDecoration {
    const id = `tracked-${this.nextId++}`
    this.decorations.set(id, decoration)
    this.notify()

    return {
      id,
      decoration,
      remove: () => this.remove(id),
    }
  }

  /**
   * Add multiple decorations at once.
   */
  addAll(decorations: Decoration[]): TrackedDecoration[] {
    const tracked = decorations.map((dec) => {
      const id = `tracked-${this.nextId++}`
      this.decorations.set(id, dec)
      return {
        id,
        decoration: dec,
        remove: () => this.remove(id),
      }
    })
    this.notify()
    return tracked
  }

  /**
   * Remove a decoration by ID.
   */
  remove(id: string): boolean {
    const removed = this.decorations.delete(id)
    if (removed) {
      this.notify()
    }
    return removed
  }

  /**
   * Remove all decorations matching a predicate.
   */
  removeWhere(predicate: (dec: Decoration, id: string) => boolean): number {
    let count = 0
    for (const [id, dec] of this.decorations) {
      if (predicate(dec, id)) {
        this.decorations.delete(id)
        count++
      }
    }
    if (count > 0) {
      this.notify()
    }
    return count
  }

  /**
   * Clear all tracked decorations.
   */
  clear(): void {
    if (this.decorations.size > 0) {
      this.decorations.clear()
      this.notify()
    }
  }

  /**
   * Map all decorations through a transaction.
   * This is called automatically by EditorView when state changes.
   */
  mapThrough(tr: Transaction): void {
    if (!tr.docChanged || this.decorations.size === 0) {
      return
    }

    const mapping = tr.mapping
    const newDecorations = new Map<string, Decoration>()

    for (const [id, dec] of this.decorations) {
      const mapped = this.mapDecoration(dec, mapping)
      if (mapped) {
        newDecorations.set(id, mapped)
      }
      // If mapped returns null, the decoration was deleted
    }

    this.decorations = newDecorations
    this.notify()
  }

  /**
   * Map a single decoration through a mapping.
   * Returns null if the decoration was deleted.
   */
  private mapDecoration(dec: Decoration, mapping: Mapping): Decoration | null {
    const from = mapping.map(dec.from, isWidget(dec) ? (dec.spec.side ?? 0) : 1)
    const to = mapping.map(dec.to, -1)

    // Decoration was deleted (positions crossed)
    if (from > to) {
      return null
    }

    // For inline/span decorations, check if they became empty
    if ((isInline(dec) || isSpan(dec)) && from === to) {
      return null
    }

    // Return updated decoration with new positions
    if (isWidget(dec)) {
      return { ...dec, from, to: from }
    }
    return { ...dec, from, to }
  }

  /**
   * Get all tracked decorations as a DecorationSet.
   * This is reactive - it will update when decorations change.
   */
  getDecorationSet(doc: Node): DecorationSet {
    // Access signal to establish reactivity
    this.version()

    if (this.decorations.size === 0) {
      return DecorationSet.empty
    }

    return DecorationSet.create(doc, Array.from(this.decorations.values()))
  }

  /**
   * Get the reactive accessor for decoration changes.
   * Use this to trigger effects when decorations change.
   */
  get onChange(): Accessor<number> {
    return this.version
  }

  /**
   * Get the number of tracked decorations.
   */
  get size(): number {
    return this.decorations.size
  }

  private notify(): void {
    this.setVersion((v) => v + 1)
  }
}

/**
 * Create a new decoration manager.
 */
export function createDecorationManager(): DecorationManager {
  return new DecorationManager()
}
