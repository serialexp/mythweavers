/**
 * Serialize a document fragment (or slice content) to an HTML string.
 *
 * Supports a limited but practical subset:
 *  - Block nodes: paragraph, heading (1-6), blockquote, code_block,
 *    bullet_list, ordered_list, list_item, horizontal_rule, hard_break
 *  - Marks: strong, em, underline, strikethrough, code, link,
 *    subscript, superscript, highlight
 *
 * Pass a `ClipboardFilter` to restrict which node types and marks are
 * serialized. Unrecognized nodes emit their text content; unrecognized
 * marks are silently dropped.
 */
import type { Fragment } from '../model/fragment'
import type { Node } from '../model/node'
import type { Mark } from '../model/mark'
import type { ClipboardFilter } from './types'

/**
 * Serialize a Fragment to an HTML string.
 */
export function serializeFragment(fragment: Fragment, filter?: ClipboardFilter): string {
  let html = ''
  fragment.forEach((node) => {
    html += serializeNode(node, filter)
  })
  return html
}

/**
 * Serialize a single Node to an HTML string.
 */
function serializeNode(node: Node, filter?: ClipboardFilter): string {
  if (node.isText) {
    let text = escapeHtml(node.text!)
    const marks = filter?.marks
      ? node.marks.filter((m) => filter.marks!.includes(m.type.name))
      : node.marks
    text = wrapInMarks(text, marks)
    return text
  }

  // "text" and "hard_break" are always allowed (they're structural).
  // Everything else is checked against the filter.
  const name = node.type.name
  const allowed = !filter?.nodes || name === 'doc' || name === 'text' || name === 'hard_break'
    || filter.nodes.includes(name)

  const inner = node.content.size > 0 ? serializeFragment(node.content, filter) : ''

  if (!allowed) {
    // Node type not in filter — emit raw text content
    return inner || ''
  }

  switch (name) {
    case 'doc':
      return inner

    case 'paragraph':
      return `<p>${inner}</p>`

    case 'heading': {
      const level = Math.min(Math.max((node.attrs.level as number) || 1, 1), 6)
      return `<h${level}>${inner}</h${level}>`
    }

    case 'blockquote':
      return `<blockquote>${inner}</blockquote>`

    case 'code_block':
      return `<pre><code>${inner}</code></pre>`

    case 'bullet_list':
      return `<ul>${inner}</ul>`

    case 'ordered_list': {
      const order = node.attrs.order as number
      return order && order !== 1
        ? `<ol start="${order}">${inner}</ol>`
        : `<ol>${inner}</ol>`
    }

    case 'list_item':
      return `<li>${inner}</li>`

    case 'horizontal_rule':
      return '<hr>'

    case 'hard_break':
      return '<br>'

    default:
      return inner || ''
  }
}

/**
 * Wrap a text string in HTML tags corresponding to the given marks.
 * Marks are applied from outermost to innermost (the order they appear in the array).
 */
function wrapInMarks(text: string, marks: readonly Mark[]): string {
  let result = text

  // Apply marks from innermost to outermost (reverse order) so the
  // first mark in the array ends up as the outermost tag.
  for (let i = marks.length - 1; i >= 0; i--) {
    const mark = marks[i]
    const [open, close] = markTags(mark)
    result = open + result + close
  }

  return result
}

/**
 * Return the opening and closing HTML tags for a mark.
 */
function markTags(mark: Mark): [string, string] {
  switch (mark.type.name) {
    case 'strong':
      return ['<strong>', '</strong>']
    case 'em':
      return ['<em>', '</em>']
    case 'underline':
      return ['<u>', '</u>']
    case 'strikethrough':
      return ['<s>', '</s>']
    case 'code':
      return ['<code>', '</code>']
    case 'subscript':
      return ['<sub>', '</sub>']
    case 'superscript':
      return ['<sup>', '</sup>']
    case 'highlight': {
      const color = (mark.attrs.color as string) || 'yellow'
      return [`<mark data-color="${escapeAttr(color)}">`, '</mark>']
    }
    case 'link': {
      const href = (mark.attrs.href as string) || ''
      const title = mark.attrs.title as string | null
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : ''
      return [`<a href="${escapeAttr(href)}"${titleAttr}>`, '</a>']
    }
    default:
      return ['', '']
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
