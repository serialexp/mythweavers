import { For, Index, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { Mark, Node as PMNode } from '../model'
import { DecorationSet, type InlineDecoration, type SpanDecoration } from './decoration'
import { setPosInfo } from './selection'

export interface TextViewProps {
  /** The text node to render */
  node: PMNode
  /** Document position of this text node */
  pos: number
  /** Inline decorations that may apply to this text */
  decorations?: InlineDecoration[]
}

/**
 * Wraps text content with mark elements and inline decorations
 */
function wrapWithMarks(text: string, marks: readonly Mark[], decorations?: InlineDecoration[]): JSX.Element {
  let result: JSX.Element = text as unknown as JSX.Element

  // First, apply inline decorations (innermost)
  if (decorations && decorations.length > 0) {
    for (const dec of decorations) {
      result = wrapWithDecorationAttrs(result, dec.attrs)
    }
  }

  // Then wrap with marks (outermost)
  if (marks.length > 0) {
    // Wrap from innermost to outermost mark
    for (let i = marks.length - 1; i >= 0; i--) {
      const mark = marks[i]
      result = renderMark(mark, result)
    }
  }

  return result
}

/**
 * Wrap content with decoration attributes
 */
function wrapWithDecorationAttrs(children: JSX.Element, attrs: Record<string, string>): JSX.Element {
  return <span {...attrs}>{children}</span>
}

/**
 * Render a single mark around content
 */
function renderMark(mark: Mark, children: JSX.Element): JSX.Element {
  const spec = mark.type.spec
  const attrs = mark.attrs

  // Use toDOM from mark spec if available
  const toDOM = spec.toDOM as ((mark: Mark) => unknown) | undefined
  if (toDOM) {
    const domSpec = toDOM(mark)
    // domSpec is [tagName, attrs?, content?] or [tagName, content]
    if (Array.isArray(domSpec)) {
      const [tag, maybeAttrs] = domSpec
      const htmlAttrs =
        typeof maybeAttrs === 'object' && maybeAttrs !== null && !Array.isArray(maybeAttrs)
          ? (maybeAttrs as Record<string, string>)
          : {}

      // Create element dynamically
      return createMarkElement(tag as string, htmlAttrs, children)
    }
  }

  // Default mark rendering based on mark type name
  switch (mark.type.name) {
    case 'strong':
    case 'bold':
      return <strong>{children}</strong>
    case 'em':
    case 'italic':
      return <em>{children}</em>
    case 'code':
      return <code>{children}</code>
    case 'underline':
      return <u>{children}</u>
    case 'strikethrough':
    case 'strike':
      return <s>{children}</s>
    case 'link':
      return (
        <a href={attrs.href as string} title={attrs.title as string}>
          {children}
        </a>
      )
    case 'subscript':
      return <sub>{children}</sub>
    case 'superscript':
      return <sup>{children}</sup>
    default:
      // Fallback: wrap in span with class
      return <span class={`mark-${mark.type.name}`}>{children}</span>
  }
}

/**
 * Create an element for a mark dynamically
 */
function createMarkElement(tag: string, attrs: Record<string, string>, children: JSX.Element): JSX.Element {
  // For common tags, use JSX directly for better performance
  switch (tag.toLowerCase()) {
    case 'strong':
    case 'b':
      return <strong {...attrs}>{children}</strong>
    case 'em':
    case 'i':
      return <em {...attrs}>{children}</em>
    case 'code':
      return <code {...attrs}>{children}</code>
    case 'u':
      return <u {...attrs}>{children}</u>
    case 's':
    case 'strike':
    case 'del':
      return <s {...attrs}>{children}</s>
    case 'a':
      return <a {...attrs}>{children}</a>
    case 'sub':
      return <sub {...attrs}>{children}</sub>
    case 'sup':
      return <sup {...attrs}>{children}</sup>
    default:
      return <span {...attrs}>{children}</span>
  }
}

/**
 * Component for rendering a text node with its marks and decorations
 */
export function TextView(props: TextViewProps): JSX.Element {
  // Store position info for selection mapping
  // Note: We can't directly store on text nodes, so we rely on parent
  return wrapWithMarks(props.node.text ?? '', props.node.marks, props.decorations)
}

/**
 * Props for inline atom node views (internal use)
 */
interface InlineAtomViewProps {
  node: PMNode
  pos: number
  decorations?: InlineDecoration[]
}

import type { Selection } from '../state'
// Import NodeViewMap type - we reuse it for inline nodes too
import type { NodeViewMap } from './NodeView'

/**
 * Renders inline content (text and inline nodes) as a sequence
 */
export interface InlineContentProps {
  /** Parent node containing inline content */
  node: PMNode
  /** Starting position of the parent node's content */
  startPos: number
  /** Inline decorations to apply */
  decorations?: DecorationSet
  /** Custom node views for node types (same as NodeView's nodeViews) */
  nodeViews?: NodeViewMap
  /** Current selection for determining if nodes are selected */
  selection?: Selection
  /** Callback when an inline node wants to be selected (receives pos and endPos) */
  onSelectNode?: (from: number, to: number) => void
}

/**
 * Renders a span decoration wrapper around content.
 */
function SpanWrapper(props: {
  decoration: SpanDecoration
  children: JSX.Element
}): JSX.Element {
  // If it has a custom render function, use that
  if (props.decoration.render) {
    return props.decoration.render(() => props.children)
  }

  // Otherwise use the tag name
  const tag = props.decoration.tagName || 'span'
  const attrs = props.decoration.attrs || {}

  return (
    <Dynamic component={tag} {...attrs}>
      {props.children}
    </Dynamic>
  )
}

/**
 * Wraps content in multiple span decorations (nested).
 * Decorations are applied from outermost to innermost.
 */
function wrapWithSpans(content: () => JSX.Element, spans: SpanDecoration[]): JSX.Element {
  if (spans.length === 0) {
    return content()
  }

  // Sort by range size (largest first = outermost)
  const sorted = [...spans].sort((a, b) => b.to - b.from - (a.to - a.from))

  // Wrap from outermost to innermost
  let result = content
  for (let i = sorted.length - 1; i >= 0; i--) {
    const span = sorted[i]
    const inner = result
    result = () => <SpanWrapper decoration={span}>{inner()}</SpanWrapper>
  }

  return result()
}

export function InlineContent(props: InlineContentProps): JSX.Element {
  // Build array of children with their positions
  const getChildren = () => {
    const children: { node: PMNode; pos: number; endPos: number }[] = []
    const pos = props.startPos
    props.node.forEach((child, offset) => {
      const nodeStart = pos + offset
      const nodeEnd = nodeStart + child.nodeSize
      children.push({ node: child, pos: nodeStart, endPos: nodeEnd })
    })
    return children
  }

  // Get inline decorations for a specific range
  const getInlineDecorationsFor = (from: number, to: number): InlineDecoration[] | undefined => {
    if (!props.decorations) return undefined
    const decs = props.decorations.findInlineIn(from, to)
    return decs.length > 0 ? decs : undefined
  }

  // Get span decorations for a specific range
  const getSpanDecorationsFor = (from: number, to: number): SpanDecoration[] => {
    if (!props.decorations) return []
    return props.decorations.findSpansIn(from, to)
  }

  // Content end position
  const contentEnd = () => props.startPos + props.node.content.size

  // Get span decorations that cover the entire content
  const outerSpans = () => {
    if (!props.decorations) return []
    // Find spans that fully contain this content
    return props.decorations
      .findSpansIn(props.startPos, contentEnd())
      .filter((s) => s.from <= props.startPos && s.to >= contentEnd())
  }

  // Render the inline content
  const renderContent = () => (
    <For each={getChildren()}>
      {(item) => {
        const inlineDecs = () => getInlineDecorationsFor(item.pos, item.endPos)
        const spanDecs = () =>
          getSpanDecorationsFor(item.pos, item.endPos).filter(
            // Only include spans that don't fully wrap the entire content (those are handled at outer level)
            (s) => !(s.from <= props.startPos && s.to >= contentEnd()),
          )

        const renderItem = () => {
          if (item.node.isText) {
            return <TextView node={item.node} pos={item.pos} decorations={inlineDecs()} />
          }

          // Calculate if this node is selected
          const isSelected = (): boolean => {
            if (!props.selection) return false
            const { from, to } = props.selection
            // Node is selected if:
            // 1. Selection fully covers it (range selection)
            // 2. For atoms: cursor is at the node's start position (you're "on" the atom)
            //    Note: cursor at endPos means you've passed the atom, so not selected
            if (from <= item.pos && to >= item.endPos) return true
            if (item.node.isAtom && from === to && from === item.pos) {
              return true
            }
            return false
          }

          // Create onSelect callback for this node
          const handleSelect = () => {
            props.onSelectNode?.(item.pos, item.endPos)
          }

          // Check for custom node view first
          const customView = props.nodeViews?.[item.node.type.name]
          if (customView) {
            // Call custom view with NodeViewProps-compatible arguments
            return customView({
              node: item.node,
              pos: item.pos,
              nodeViews: props.nodeViews,
              selected: isSelected(),
              onSelect: handleSelect,
            })
          }
          // Fallback to default inline atom view
          return <InlineAtomView node={item.node} pos={item.pos} decorations={inlineDecs()} />
        }

        // Wrap in span decorations if any apply specifically to this item
        const itemSpans = spanDecs()
        if (itemSpans.length > 0) {
          return wrapWithSpans(renderItem, itemSpans)
        }
        return renderItem()
      }}
    </For>
  )

  // Wrap the entire content in outer span decorations
  const spans = outerSpans()
  if (spans.length > 0) {
    return wrapWithSpans(renderContent, spans)
  }

  return renderContent()
}

/**
 * Renders an inline atom node (non-text inline node).
 * This is the default renderer - custom views can be provided via nodeViews.
 */
function InlineAtomView(props: InlineAtomViewProps): JSX.Element {
  const spec = props.node.type.spec

  // Merge decoration attributes into the element
  const getAttrs = (): Record<string, string> => {
    const base: Record<string, string> = {
      class: `inline-atom inline-atom-${props.node.type.name}`,
      'data-node-type': props.node.type.name,
    }

    // Apply inline decoration attributes
    if (props.decorations) {
      for (const dec of props.decorations) {
        for (const [key, value] of Object.entries(dec.attrs)) {
          if (key === 'class') {
            base.class = `${base.class} ${value}`
          } else {
            base[key] = value
          }
        }
      }
    }

    return base
  }

  // Use toDOM if available
  if (spec.toDOM) {
    // For now, render as a span placeholder
    // Full implementation would parse the DOM spec
    return (
      <span {...getAttrs()} ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}>
        {props.node.textContent || '\u200B'}
      </span>
    )
  }

  // Default: render as empty span
  return (
    <span {...getAttrs()} ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}>
      {'\u200B'}
    </span>
  )
}
