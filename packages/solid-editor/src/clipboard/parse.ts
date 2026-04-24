/**
 * Parse an HTML string into document nodes.
 *
 * Supports the same limited subset as the serializer:
 *  - Block elements: p, h1-h6, blockquote, pre/code, ul, ol, li, hr, br
 *  - Inline marks: strong/b, em/i, u, s/del/strike, code, sub, sup, mark, a
 *  - Strips all other HTML, preserving text content
 *
 * Pass a `ClipboardFilter` to restrict which node types and marks are
 * parsed. Filtered-out blocks fall through to their children/text;
 * filtered-out marks are silently dropped.
 *
 * This parser works with DOMParser (browser) and doesn't need a full
 * HTML spec implementation — we only care about well-formed clipboard HTML.
 */
import { Fragment } from '../model/fragment'
import type { Mark } from '../model/mark'
import type { Node } from '../model/node'
import type { Schema, MarkType } from '../model/schema'
import { Slice } from '../model/slice'
import type { ClipboardFilter } from './types'

/**
 * Parse an HTML string into a Slice suitable for insertion.
 *
 * The openStart/openEnd depths are computed to allow sensible
 * merging when the slice is pasted into existing block context.
 */
export function parseHtmlToSlice(schema: Schema, html: string, filter?: ClipboardFilter): Slice {
  const nodes = parseHtml(schema, html, filter)
  if (nodes.length === 0) return Slice.empty

  // If there's exactly one paragraph, treat it as inline content
  // (openStart=1, openEnd=1) so it merges into the current paragraph.
  if (nodes.length === 1 && nodes[0].type.name === 'paragraph') {
    return new Slice(Fragment.from(nodes), 1, 1)
  }

  // Multiple blocks: wrap as a slice with open depth 1 so the first
  // and last blocks merge with the surrounding context.
  return new Slice(Fragment.from(nodes), 1, 1)
}

/**
 * Parse an HTML string into an array of block-level nodes.
 */
export function parseHtml(schema: Schema, html: string, filter?: ClipboardFilter): Node[] {
  if (typeof DOMParser === 'undefined') {
    // SSR fallback: treat as plain text
    return parsePlainText(schema, html)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return parseChildren(schema, doc.body, filter)
}

/** Check if a node type name is allowed by the filter. */
function nodeAllowed(name: string, filter?: ClipboardFilter): boolean {
  // paragraph is always allowed — it's the fundamental text container.
  // Without it, block content has nowhere to go.
  if (!filter?.nodes || name === 'paragraph') return true
  return filter.nodes.includes(name)
}

/** Check if a mark type name is allowed by the filter. */
function markAllowed(name: string, filter?: ClipboardFilter): boolean {
  if (!filter?.marks) return true
  return filter.marks.includes(name)
}

/**
 * Parse the children of a DOM element into block-level nodes.
 */
function parseChildren(schema: Schema, parent: Element, filter?: ClipboardFilter): Node[] {
  const nodes: Node[] = []
  const pendingInlines: Node[] = []

  const flushInlines = () => {
    if (pendingInlines.length > 0) {
      const pType = schema.nodes.paragraph
      if (pType) {
        nodes.push(pType.create(null, Fragment.from(pendingInlines.slice())))
      }
      pendingInlines.length = 0
    }
  }

  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i]

    if (child.nodeType === 3 /* TEXT_NODE */) {
      const text = child.textContent || ''
      // Skip whitespace-only text nodes between block elements
      if (text.trim() === '') continue
      const textNode = schema.text(text)
      pendingInlines.push(textNode)
      continue
    }

    if (child.nodeType !== 1 /* ELEMENT_NODE */) continue
    const el = child as Element
    const tag = el.tagName.toLowerCase()

    // Block-level elements
    if (isBlockTag(tag)) {
      flushInlines()
      const blockNodes = parseBlockElement(schema, el, tag, filter)
      nodes.push(...blockNodes)
    } else {
      // Inline element: parse it and add to pending inlines
      const inlineNodes = parseInlineContent(schema, el, [], filter)
      pendingInlines.push(...inlineNodes)
    }
  }

  flushInlines()
  return nodes
}

function isBlockTag(tag: string): boolean {
  return (
    tag === 'p' || tag === 'div' ||
    tag === 'h1' || tag === 'h2' || tag === 'h3' ||
    tag === 'h4' || tag === 'h5' || tag === 'h6' ||
    tag === 'blockquote' ||
    tag === 'pre' ||
    tag === 'ul' || tag === 'ol' || tag === 'li' ||
    tag === 'hr' ||
    tag === 'table' || tag === 'thead' || tag === 'tbody' || tag === 'tr' || tag === 'td' || tag === 'th'
  )
}

/**
 * Map an HTML tag to its node type name. Returns null for tags that don't
 * map to a specific node type (div, table wrappers, etc.).
 */
function nodeNameForTag(tag: string): string | null {
  switch (tag) {
    case 'p': case 'div': return 'paragraph'
    case 'h1': case 'h2': case 'h3':
    case 'h4': case 'h5': case 'h6': return 'heading'
    case 'blockquote': return 'blockquote'
    case 'pre': return 'code_block'
    case 'ul': return 'bullet_list'
    case 'ol': return 'ordered_list'
    case 'li': return 'list_item'
    case 'hr': return 'horizontal_rule'
    default: return null
  }
}

/**
 * Parse a block-level element into one or more nodes.
 */
function parseBlockElement(schema: Schema, el: Element, tag: string, filter?: ClipboardFilter): Node[] {
  const nodeName = nodeNameForTag(tag)

  // If the node type is filtered out, fall through to children
  if (nodeName && !nodeAllowed(nodeName, filter)) {
    // For filtered-out blocks, extract children as if the wrapper wasn't there
    return parseChildren(schema, el, filter)
  }

  switch (tag) {
    case 'p':
    case 'div': {
      const pType = schema.nodes.paragraph
      if (!pType) return []
      const inlines = parseInlineContent(schema, el, [], filter)
      return [pType.create(null, inlines.length > 0 ? Fragment.from(inlines) : null)]
    }

    case 'h1': case 'h2': case 'h3':
    case 'h4': case 'h5': case 'h6': {
      const hType = schema.nodes.heading
      if (!hType) {
        // Fall back to paragraph if schema has no heading type
        const pType = schema.nodes.paragraph
        if (!pType) return []
        const inlines = parseInlineContent(schema, el, [], filter)
        return [pType.create(null, inlines.length > 0 ? Fragment.from(inlines) : null)]
      }
      const level = parseInt(tag[1], 10)
      const inlines = parseInlineContent(schema, el, [], filter)
      return [hType.create({ level }, inlines.length > 0 ? Fragment.from(inlines) : null)]
    }

    case 'blockquote': {
      const bqType = schema.nodes.blockquote
      if (!bqType) {
        return parseChildren(schema, el, filter)
      }
      const children = parseChildren(schema, el, filter)
      if (children.length === 0) {
        const pType = schema.nodes.paragraph
        if (pType) children.push(pType.create())
      }
      return [bqType.create(null, Fragment.from(children))]
    }

    case 'pre': {
      const cbType = schema.nodes.code_block
      if (!cbType) {
        const pType = schema.nodes.paragraph
        if (!pType) return []
        return [pType.create(null, schema.text(el.textContent || ''))]
      }
      const codeEl = el.querySelector('code')
      const text = (codeEl || el).textContent || ''
      return [cbType.create(null, text ? schema.text(text) : null)]
    }

    case 'ul':
    case 'ol': {
      const listType = tag === 'ul' ? schema.nodes.bullet_list : schema.nodes.ordered_list
      if (!listType) {
        return parseChildren(schema, el, filter)
      }
      const items: Node[] = []
      for (let i = 0; i < el.children.length; i++) {
        const child = el.children[i]
        if (child.tagName.toLowerCase() === 'li') {
          const liNode = parseListItem(schema, child, filter)
          if (liNode) items.push(liNode)
        }
      }
      if (items.length === 0) return []
      const attrs = tag === 'ol' ? { order: parseInt(el.getAttribute('start') || '1', 10) } : null
      return [listType.create(attrs, Fragment.from(items))]
    }

    case 'li': {
      const liNode = parseListItem(schema, el, filter)
      if (liNode) return [liNode]
      return []
    }

    case 'hr': {
      const hrType = schema.nodes.horizontal_rule
      if (!hrType) return []
      return [hrType.create()]
    }

    default:
      return parseChildren(schema, el, filter)
  }
}

/**
 * Parse an <li> element into a list_item node.
 */
function parseListItem(schema: Schema, el: Element, filter?: ClipboardFilter): Node | null {
  const liType = schema.nodes.list_item
  if (!liType) return null

  const children = parseChildren(schema, el, filter)
  if (children.length === 0) {
    const pType = schema.nodes.paragraph
    if (pType) children.push(pType.create())
  }
  return liType.create(null, Fragment.from(children))
}

/**
 * Parse the inline content of an element, accumulating marks from ancestor
 * inline elements.
 */
function parseInlineContent(schema: Schema, el: Element, parentMarks: readonly Mark[], filter?: ClipboardFilter): Node[] {
  const nodes: Node[] = []

  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]

    if (child.nodeType === 3 /* TEXT_NODE */) {
      const text = child.textContent || ''
      if (text.length === 0) continue
      nodes.push(schema.text(text, parentMarks.length > 0 ? parentMarks : null))
      continue
    }

    if (child.nodeType !== 1 /* ELEMENT_NODE */) continue
    const childEl = child as Element
    const tag = childEl.tagName.toLowerCase()

    // If it's a block element inside an inline context, recursively handle
    if (isBlockTag(tag)) {
      const text = childEl.textContent || ''
      if (text.length > 0) {
        nodes.push(schema.text(text, parentMarks.length > 0 ? parentMarks : null))
      }
      continue
    }

    // Handle <br> as hard_break
    if (tag === 'br') {
      const brType = schema.nodes.hard_break
      if (brType) {
        nodes.push(brType.create())
      }
      continue
    }

    // Inline element: determine if it adds a mark (respecting filter)
    const mark = markFromTag(schema, childEl, tag, filter)
    const childMarks = mark ? addMarkToSet(parentMarks, mark) : parentMarks
    const childNodes = parseInlineContent(schema, childEl, childMarks, filter)
    nodes.push(...childNodes)
  }

  return nodes
}

/**
 * Determine if an inline element corresponds to a mark, and if so, create it.
 * Returns null if the mark type is filtered out.
 */
function markFromTag(schema: Schema, el: Element, tag: string, filter?: ClipboardFilter): Mark | null {
  let markType: MarkType | undefined
  let markName: string | undefined

  switch (tag) {
    case 'strong':
    case 'b':
      markName = 'strong'
      markType = schema.marks.strong
      break
    case 'em':
    case 'i':
      markName = 'em'
      markType = schema.marks.em
      break
    case 'u':
      markName = 'underline'
      markType = schema.marks.underline
      break
    case 's':
    case 'del':
    case 'strike':
      markName = 'strikethrough'
      markType = schema.marks.strikethrough
      break
    case 'code':
      markName = 'code'
      markType = schema.marks.code
      break
    case 'sub':
      markName = 'subscript'
      markType = schema.marks.subscript
      break
    case 'sup':
      markName = 'superscript'
      markType = schema.marks.superscript
      break
    case 'mark':
      markName = 'highlight'
      markType = schema.marks.highlight
      if (markType && markAllowed(markName, filter)) {
        const color = el.getAttribute('data-color') || 'yellow'
        return markType.create({ color })
      }
      return null
    case 'a':
      markName = 'link'
      markType = schema.marks.link
      if (markType && markAllowed(markName, filter)) {
        const href = el.getAttribute('href') || ''
        const title = el.getAttribute('title') || null
        return markType.create({ href, title })
      }
      return null
    case 'span': {
      // Handle styled spans from Google Docs, Word, etc.
      const style = el.getAttribute('style') || ''
      const marks = marksFromStyle(schema, style, filter)
      return marks.length > 0 ? marks[0] : null
    }
  }

  if (!markType || !markName) return null
  if (!markAllowed(markName, filter)) return null
  return markType.create()
}

/**
 * Extract marks from a CSS style string (for styled <span> elements from
 * word processors).
 */
function marksFromStyle(schema: Schema, style: string, filter?: ClipboardFilter): Mark[] {
  const marks: Mark[] = []

  if (/font-weight\s*:\s*(bold|[7-9]\d{2})/i.test(style) && markAllowed('strong', filter)) {
    const mt = schema.marks.strong
    if (mt) marks.push(mt.create())
  }

  if (/font-style\s*:\s*italic/i.test(style) && markAllowed('em', filter)) {
    const mt = schema.marks.em
    if (mt) marks.push(mt.create())
  }

  if (/text-decoration[^:]*:\s*[^;]*underline/i.test(style) && markAllowed('underline', filter)) {
    const mt = schema.marks.underline
    if (mt) marks.push(mt.create())
  }

  if (/text-decoration[^:]*:\s*[^;]*line-through/i.test(style) && markAllowed('strikethrough', filter)) {
    const mt = schema.marks.strikethrough
    if (mt) marks.push(mt.create())
  }

  return marks
}

/**
 * Add a mark to a mark set, maintaining proper ordering.
 */
function addMarkToSet(marks: readonly Mark[], mark: Mark): readonly Mark[] {
  return mark.addToSet(marks as Mark[])
}

/**
 * Fallback parser for plain text (used in SSR where DOMParser is unavailable).
 */
function parsePlainText(schema: Schema, text: string): Node[] {
  const pType = schema.nodes.paragraph
  if (!pType) return []

  const paragraphs = text.split(/\n\n+/)
  return paragraphs.map((content) => {
    const trimmed = content.replace(/\n/g, ' ')
    return pType.create(null, trimmed ? schema.text(trimmed) : null)
  })
}
