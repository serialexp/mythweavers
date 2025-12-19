const blockLevelTags = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
])

function wrapWithMarker(content: string, marker: string): string {
  const leadingSpaces = content.match(/^\s*/)?.[0] ?? ''
  const trailingSpaces = content.match(/\s*$/)?.[0] ?? ''
  const inner = content.trim()
  if (!inner) return content
  return `${leadingSpaces}${marker}${inner}${marker}${trailingSpaces}`
}

function serializeNode(node: Node): string {
  if (node.nodeType === 3) {
    return (node.textContent ?? '').replace(/\u00a0/g, ' ')
  }

  if (node.nodeType === 1) {
    const element = node as HTMLElement
    const tagName = element.tagName.toLowerCase()
    const childText = Array.from(element.childNodes).map(serializeNode).join('')

    if (tagName === 'br') {
      return '\n'
    }

    if (!childText) return ''

    if (tagName === 'pre') {
      return childText
    }

    if (tagName === 'i' || tagName === 'em') {
      return wrapWithMarker(childText, '*')
    }

    if (tagName === 'b' || tagName === 'strong') {
      return wrapWithMarker(childText, '__')
    }

    if (blockLevelTags.has(tagName)) {
      const normalized = childText.replace(/^\n+/, '').replace(/\n+$/, '')
      if (!normalized) return ''
      if (tagName === 'li') {
        return `${normalized}\n`
      }
      return `${normalized}\n\n`
    }

    return childText
  }

  return ''
}

function extractTextWithFormatting(html: string): string {
  if (!html) return ''
  if (typeof document === 'undefined') return ''

  const container = document.createElement('div')
  container.innerHTML = html

  const serialized = Array.from(container.childNodes).map(serializeNode).join('')
  return serialized
}

/**
 * Processes pasted text to preserve readable paragraphs while keeping inline formatting.
 *
 * When HTML content is available we rely on its structure to recover block boundaries without
 * introducing extra newline characters. For plain-text-only clipboard entries we still expand
 * single newlines to double newlines to mimic standard paragraph spacing.
 *
 * @param text - The raw pasted text
 * @param html - Optional HTML representation of the pasted content
 * @returns Processed text with improved paragraph spacing
 */
export function processPastedText(text: string, html?: string): string {
  const formattedFromHtml = html ? extractTextWithFormatting(html) : ''
  const hasHtmlContent = formattedFromHtml.trim().length > 0
  const baseText = hasHtmlContent ? formattedFromHtml : text

  if (!baseText) return baseText

  // Step 1: Normalize line endings to \n
  let processed = baseText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Step 2: Only expand paragraph spacing when we don't have structured HTML
  if (!hasHtmlContent) {
    processed = processed.replace(/\n/g, '\n\n')
  }

  // Step 3: Replace any sequence of 3 or more newlines with just 2
  // This prevents excessive spacing while maintaining paragraph breaks
  processed = processed.replace(/\n{3,}/g, '\n\n')

  // Step 4: Trim any leading/trailing whitespace
  processed = processed.trim()

  return processed
}
