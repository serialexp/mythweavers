import type { JSX } from 'solid-js'
import type { Node } from '../model'
import type { Mapping } from '../transform'

/**
 * Spec for widget decorations.
 */
export interface WidgetDecorationSpec {
  /** Which side of the position to render on (-1 = before, 1 = after) */
  side?: number
  /** Key for stable identity across updates */
  key?: string
  /** Whether the widget should be ignored for cursor positioning */
  ignoreSelection?: boolean
  /** Marks this as a widget decoration */
  type: 'widget'
}

/**
 * Spec for inline decorations.
 */
export interface InlineDecorationSpec {
  /** Whether to include the start position when the decoration is at a boundary */
  inclusiveStart?: boolean
  /** Whether to include the end position when the decoration is at a boundary */
  inclusiveEnd?: boolean
  /** Key for stable identity */
  key?: string
  /** Marks this as an inline decoration */
  type: 'inline'
}

/**
 * Spec for node decorations.
 */
export interface NodeDecorationSpec {
  /** Key for stable identity */
  key?: string
  /** Marks this as a node decoration */
  type: 'node'
}

/**
 * Spec for span decorations (full element wrappers).
 */
export interface SpanDecorationSpec {
  /** Whether to include the start position when the decoration is at a boundary */
  inclusiveStart?: boolean
  /** Whether to include the end position when the decoration is at a boundary */
  inclusiveEnd?: boolean
  /** Key for stable identity */
  key?: string
  /** Marks this as a span decoration */
  type: 'span'
}

/**
 * Base decoration type.
 */
export type Decoration = WidgetDecoration | InlineDecoration | NodeDecoration | SpanDecoration

/**
 * A widget decoration renders a JSX element at a specific position.
 * Unlike ProseMirror which uses DOM nodes, we use SolidJS components.
 */
export interface WidgetDecoration {
  /** Position in the document */
  from: number
  /** For widgets, to === from */
  to: number
  /** The component to render */
  widget: () => JSX.Element
  /** Decoration spec */
  spec: WidgetDecorationSpec
}

/**
 * An inline decoration adds attributes/classes to a range of inline content.
 */
export interface InlineDecoration {
  /** Start position */
  from: number
  /** End position */
  to: number
  /** Attributes to add to the rendered spans */
  attrs: Record<string, string>
  /** Decoration spec */
  spec: InlineDecorationSpec
}

/**
 * A node decoration adds attributes to a node's outer element.
 */
export interface NodeDecoration {
  /** Start of the node (before it) */
  from: number
  /** End of the node (after it) */
  to: number
  /** Attributes to add to the node's DOM element */
  attrs: Record<string, string>
  /** Decoration spec */
  spec: NodeDecorationSpec
}

/**
 * A span decoration wraps a range of content in a custom element.
 * This is more powerful than inline decorations - it can render
 * arbitrary wrapper elements or even SolidJS components.
 *
 * The wrapper receives the content as children.
 */
export interface SpanDecoration {
  /** Start position */
  from: number
  /** End position */
  to: number
  /**
   * The wrapper to render around the content.
   * Can be:
   * - A tag name string (e.g., "mark", "a", "strong")
   * - A component function that receives children and renders a wrapper
   */
  tagName?: string
  /**
   * For custom component wrappers - receives children as a render prop.
   * Example: (children) => <mark class="highlight">{children()}</mark>
   */
  render?: (children: () => JSX.Element) => JSX.Element
  /** Attributes to add to the wrapper element (only used with tagName) */
  attrs?: Record<string, string>
  /** Decoration spec */
  spec: SpanDecorationSpec
}

/**
 * Create a widget decoration that renders a SolidJS component.
 */
export function widget(
  pos: number,
  component: () => JSX.Element,
  spec?: Partial<Omit<WidgetDecorationSpec, 'type'>>,
): WidgetDecoration {
  return {
    from: pos,
    to: pos,
    widget: component,
    spec: { side: 0, ...spec, type: 'widget' },
  }
}

/**
 * Create an inline decoration that adds attributes to text.
 */
export function inline(
  from: number,
  to: number,
  attrs: Record<string, string>,
  spec?: Partial<Omit<InlineDecorationSpec, 'type'>>,
): InlineDecoration {
  return {
    from,
    to,
    attrs,
    spec: { ...spec, type: 'inline' },
  }
}

/**
 * Create a node decoration that adds attributes to a block node.
 */
export function node(
  from: number,
  to: number,
  attrs: Record<string, string>,
  spec?: Partial<Omit<NodeDecorationSpec, 'type'>>,
): NodeDecoration {
  return {
    from,
    to,
    attrs,
    spec: { ...spec, type: 'node' },
  }
}

/**
 * Create a span decoration that wraps content in a custom element.
 *
 * @example
 * // Wrap in a <mark> element
 * span(5, 15, "mark", { class: "highlight" })
 *
 * @example
 * // Wrap in a custom component
 * span(5, 15, (children) => (
 *   <Tooltip content="This is highlighted">
 *     <mark>{children()}</mark>
 *   </Tooltip>
 * ))
 */
export function span(
  from: number,
  to: number,
  tagOrRender: string | ((children: () => JSX.Element) => JSX.Element),
  attrsOrSpec?: Record<string, string> | Partial<Omit<SpanDecorationSpec, 'type'>>,
  spec?: Partial<Omit<SpanDecorationSpec, 'type'>>,
): SpanDecoration {
  if (typeof tagOrRender === 'string') {
    // Tag name variant
    const attrs =
      typeof attrsOrSpec === 'object' && !('key' in attrsOrSpec && 'type' in attrsOrSpec)
        ? (attrsOrSpec as Record<string, string>)
        : undefined
    const finalSpec = attrs ? spec : (attrsOrSpec as Partial<Omit<SpanDecorationSpec, 'type'>> | undefined)

    return {
      from,
      to,
      tagName: tagOrRender,
      attrs,
      spec: { ...finalSpec, type: 'span' },
    }
  }
  // Render function variant
  return {
    from,
    to,
    render: tagOrRender,
    spec: { ...(attrsOrSpec as Partial<Omit<SpanDecorationSpec, 'type'>>), type: 'span' },
  }
}

/**
 * Type guard for widget decorations.
 */
export function isWidget(dec: Decoration): dec is WidgetDecoration {
  return dec.spec.type === 'widget'
}

/**
 * Type guard for inline decorations.
 */
export function isInline(dec: Decoration): dec is InlineDecoration {
  return dec.spec.type === 'inline'
}

/**
 * Type guard for node decorations.
 */
export function isNode(dec: Decoration): dec is NodeDecoration {
  return dec.spec.type === 'node'
}

/**
 * Type guard for span decorations.
 */
export function isSpan(dec: Decoration): dec is SpanDecoration {
  return dec.spec.type === 'span'
}

/**
 * A set of decorations, optimized for lookup and mapping.
 *
 * DecorationSet stores decorations in a way that makes it efficient to:
 * - Find all decorations in a given range
 * - Map decorations through document changes
 * - Add or remove decorations
 */
export class DecorationSet {
  /** An empty decoration set. */
  static empty: DecorationSet = new DecorationSet([])

  /** Track widget positions for development warnings */
  private widgetPositions: Set<number> = new Set()
  /** Track which positions have been queried */
  private queriedPositions: Set<number> = new Set()

  private constructor(
    /** All decorations, sorted by from position */
    private readonly decorations: Decoration[],
  ) {
    // Track widget positions for development mode warnings
    for (const dec of decorations) {
      if (isWidget(dec)) {
        this.widgetPositions.add(dec.from)
      }
    }
  }

  /**
   * Create a decoration set from a list of decorations.
   */
  static create(_doc: Node, decorations: Decoration[]): DecorationSet {
    if (decorations.length === 0) return DecorationSet.empty

    // Sort by from position, then by spec.side for widgets
    const sorted = [...decorations].sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from
      // For widgets at same position, sort by side
      if (isWidget(a) && isWidget(b)) {
        return (a.spec.side ?? 0) - (b.spec.side ?? 0)
      }
      return 0
    })

    return new DecorationSet(sorted)
  }

  /**
   * Find all decorations that overlap with the given range.
   * If no range is specified, returns all decorations.
   */
  find(start?: number, end?: number): Decoration[] {
    if (start === undefined && end === undefined) {
      return [...this.decorations]
    }

    const s = start ?? 0
    const e = end ?? Number.POSITIVE_INFINITY

    return this.decorations.filter((d) => d.from < e && d.to > s)
  }

  /**
   * Find decorations at a specific position.
   */
  findAt(pos: number): Decoration[] {
    return this.decorations.filter((d) => d.from <= pos && d.to >= pos)
  }

  /**
   * Find widget decorations at a specific position.
   */
  findWidgetsAt(pos: number): WidgetDecoration[] {
    this.queriedPositions.add(pos)
    return this.decorations.filter((d): d is WidgetDecoration => isWidget(d) && d.from === pos)
  }

  /**
   * Check for widgets that were created but never queried (likely not rendered).
   * Call this after rendering to detect missing WidgetsAt in custom nodeViews.
   */
  checkUnrenderedWidgets(): void {
    if (this.widgetPositions.size === 0) return

    const unrendered: number[] = []
    for (const pos of this.widgetPositions) {
      if (!this.queriedPositions.has(pos)) {
        unrendered.push(pos)
      }
    }

    if (unrendered.length > 0) {
      console.warn(
        `[DecorationSet] ${unrendered.length} widget decoration(s) at position(s) [${unrendered.join(', ')}] ` +
          `were created but never queried by WidgetsAt. ` +
          `If you're using custom nodeViews, make sure they render <WidgetsAt> for widget decorations.`,
      )
    }
  }

  /**
   * Find inline decorations that cover a range.
   */
  findInlineIn(from: number, to: number): InlineDecoration[] {
    return this.decorations.filter((d): d is InlineDecoration => isInline(d) && d.from < to && d.to > from)
  }

  /**
   * Find node decoration for a node at a position.
   */
  findNodeAt(from: number, to: number): NodeDecoration | undefined {
    return this.decorations.find((d): d is NodeDecoration => isNode(d) && d.from === from && d.to === to)
  }

  /**
   * Find span decorations that cover a range.
   */
  findSpansIn(from: number, to: number): SpanDecoration[] {
    return this.decorations.filter((d): d is SpanDecoration => isSpan(d) && d.from < to && d.to > from)
  }

  /**
   * Map this decoration set through a set of document changes.
   * Decorations that are deleted or become empty are removed.
   */
  map(mapping: Mapping, _doc: Node): DecorationSet {
    if (this.decorations.length === 0) return this

    const mapped: Decoration[] = []

    for (const dec of this.decorations) {
      const from = mapping.map(dec.from, isWidget(dec) ? (dec.spec.side ?? 0) : 1)
      const to = mapping.map(dec.to, -1)

      // Skip if decoration was deleted (maps to same position)
      if (from > to) continue

      // For inline decorations, skip if they become empty
      if (isInline(dec) && from === to) continue

      if (isWidget(dec)) {
        mapped.push({ ...dec, from, to: from })
      } else if (isInline(dec)) {
        mapped.push({ ...dec, from, to })
      } else {
        // Node decorations - verify the node still exists at this position
        // For now, just map the positions
        mapped.push({ ...dec, from, to })
      }
    }

    if (mapped.length === 0) return DecorationSet.empty
    return new DecorationSet(mapped)
  }

  /**
   * Add decorations to this set.
   */
  add(doc: Node, decorations: Decoration[]): DecorationSet {
    if (decorations.length === 0) return this
    if (this.decorations.length === 0) {
      return DecorationSet.create(doc, decorations)
    }

    return DecorationSet.create(doc, [...this.decorations, ...decorations])
  }

  /**
   * Remove decorations from this set.
   * Decorations are matched by reference or by key.
   */
  remove(decorations: Decoration[]): DecorationSet {
    if (decorations.length === 0) return this

    const toRemove = new Set(decorations)
    const keysToRemove = new Set(decorations.map((d) => d.spec.key).filter((k): k is string => k !== undefined))

    const remaining = this.decorations.filter((d) => {
      if (toRemove.has(d)) return false
      if (d.spec.key && keysToRemove.has(d.spec.key)) return false
      return true
    })

    if (remaining.length === this.decorations.length) return this
    if (remaining.length === 0) return DecorationSet.empty
    return new DecorationSet(remaining)
  }

  /**
   * Check if this set is empty.
   */
  get isEmpty(): boolean {
    return this.decorations.length === 0
  }

  /**
   * Get the number of decorations in this set.
   */
  get size(): number {
    return this.decorations.length
  }
}

/**
 * A decoration source is either a DecorationSet or a function that
 * computes one from the editor state.
 */
export type DecorationSource = DecorationSet | ((state: { doc: Node }) => DecorationSet)

/**
 * Resolve a decoration source to a DecorationSet.
 */
export function resolveDecorations(source: DecorationSource | undefined | null, state: { doc: Node }): DecorationSet {
  if (!source) return DecorationSet.empty
  if (source instanceof DecorationSet) return source
  return source(state)
}
