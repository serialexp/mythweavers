import type { Node } from '../model'
import { Selection, TextSelection } from '../state'

/**
 * Position info stored on DOM nodes for mapping back to document positions
 */
export interface PosInfo {
  /** Document position at the start of this node */
  pos: number
  /** The model node this DOM element represents */
  node: Node
}

// WeakMap to store position info on DOM nodes without modifying them
const positionMap = new WeakMap<globalThis.Node, PosInfo>()

/**
 * Store position information on a DOM node
 */
export function setPosInfo(domNode: globalThis.Node, info: PosInfo): void {
  positionMap.set(domNode, info)
}

/**
 * Get position information from a DOM node
 */
export function getPosInfo(domNode: globalThis.Node): PosInfo | undefined {
  return positionMap.get(domNode)
}

/**
 * Find the nearest ancestor with position info
 */
function findNearestPosNode(node: globalThis.Node | null): { node: globalThis.Node; info: PosInfo } | null {
  while (node) {
    const info = getPosInfo(node)
    if (info) return { node, info }
    node = node.parentNode
  }
  return null
}

/**
 * Count content size before a node within a subtree, up to (but not including) the target.
 * This accounts for:
 * - Text nodes: count their length
 * - Inline nodes with position info (like mentions): count their nodeSize
 * - Mark wrappers without position info (like <strong>): walk into children
 * Returns null if target is not found.
 */
function countContentBefore(container: globalThis.Node, target: globalThis.Node): number | null {
  let count = 0
  const debug: string[] = []

  function walk(node: globalThis.Node): boolean {
    if (node === target) {
      return true // Found it
    }

    if (node.nodeType === 3) {
      // Text node - count its length
      const len = node.textContent?.length ?? 0
      debug.push(`text(${len})`)
      count += len
      return false
    }

    if (node.nodeType === 1) {
      const element = node as Element

      // Cursor target spans don't contribute to content count, but we still
      // need to check if the target is inside them
      if (element.hasAttribute('data-cursor-target')) {
        debug.push('cursor-target')
        // Walk into it to check for target, but don't count content
        for (let i = 0; i < node.childNodes.length; i++) {
          if (node.childNodes[i] === target) {
            // Target is the ZWS text node inside cursor target - return current count
            // This maps the cursor position to right before the following atom
            return true
          }
        }
        return false
      }

      // Widget spans don't contribute to content count - they're decorations, not content
      if (element.hasAttribute('data-widget')) {
        debug.push('widget')
        // Walk into it to check for target, but don't count content
        for (let i = 0; i < node.childNodes.length; i++) {
          if (node.childNodes[i] === target) {
            // Target is inside widget - return current count
            return true
          }
          // Check nested children too (in case of deep widget structure)
          if (node.childNodes[i].contains(target)) {
            return true
          }
        }
        return false
      }

      // Element node - check if it has position info (inline node like mention)
      const info = getPosInfo(node)
      if (info) {
        // This is a node with position info
        if (info.node.isInline && info.node.isAtom) {
          // Inline atom node (mention, image, etc.) - count its nodeSize
          debug.push(`atom(${info.node.nodeSize},${info.node.type.name})`)
          count += info.node.nodeSize
          return false // Don't walk into it
        }
        // For block nodes or non-atom inline nodes, walk children
        debug.push(`block(${info.node.type.name})`)
      } else {
        debug.push(`wrapper(${element.tagName})`)
      }

      // Element without position info (mark wrapper) or block node - walk children
      for (let i = 0; i < node.childNodes.length; i++) {
        if (walk(node.childNodes[i])) {
          return true // Found target in this subtree
        }
      }
    }

    return false
  }

  // Walk children of container (not the container itself)
  for (let i = 0; i < container.childNodes.length; i++) {
    if (walk(container.childNodes[i])) {
      console.log('[countContentBefore]', count, 'items:', debug.join(', '))
      return count
    }
  }

  return null // Target not found
}

/**
 * Calculate the document position from a DOM position
 */
export function posFromDOM(_doc: Node, domNode: globalThis.Node, domOffset: number): number | null {
  // Find nearest ancestor with position info
  const posNode = findNearestPosNode(domNode)
  if (!posNode) return null

  const { node: ancestorNode, info } = posNode

  // info.pos stores the node's position in the document.
  // For block nodes, content starts at info.pos + 1 (after the opening tag).
  // For inline nodes, info.pos is already the content start.
  const contentStartPos = info.node.isBlock ? info.pos + 1 : info.pos

  // If we're in a text node, add the offset
  if (domNode.nodeType === 3) {
    // Text node
    if (domNode === ancestorNode) {
      // Direct text node with position info (rare case)
      const result = contentStartPos + domOffset
      console.log('[posFromDOM] Text node (direct):', { domOffset, contentStartPos, result })
      return result
    }

    // Text node is somewhere within the ancestor's subtree
    // Count all content (text + inline nodes) before this text node, then add the offset within it
    const contentBefore = countContentBefore(ancestorNode, domNode)
    if (contentBefore === null) return null

    const result = contentStartPos + contentBefore + domOffset
    console.log('[posFromDOM] Text node:', {
      domOffset,
      contentStartPos,
      contentBefore,
      result,
      ancestorNodeName: (ancestorNode as Element).className || ancestorNode.nodeName,
    })
    return result
  }

  // For element nodes, traverse children to find position
  if (domNode.nodeType === 1 && domNode === ancestorNode) {
    // If offset is within children, calculate position
    const children = domNode.childNodes
    let offset = 0
    for (let i = 0; i < domOffset && i < children.length; i++) {
      const child = children[i]
      // Skip widget elements - they're decorations, not content
      if (child.nodeType === 1 && (child as Element).hasAttribute('data-widget')) {
        continue
      }
      if (child.nodeType === 3) {
        offset += child.textContent?.length ?? 0
      } else {
        const childInfo = getPosInfo(child)
        if (childInfo) {
          offset = childInfo.pos - contentStartPos + childInfo.node.nodeSize
        } else {
          // Element without position info (mark wrapper) - count text content
          offset += child.textContent?.length ?? 0
        }
      }
    }
    const result = contentStartPos + offset
    console.log('[posFromDOM] Element node:', {
      domOffset,
      contentStartPos,
      offset,
      result,
      numChildren: children.length,
    })
    return result
  }

  console.log('[posFromDOM] Fallback:', { contentStartPos })
  return contentStartPos
}

/**
 * Convert a DOM selection to a model Selection
 */
export function selectionFromDOM(doc: Node, domSelection: globalThis.Selection): Selection | null {
  const { anchorNode, anchorOffset, focusNode, focusOffset } = domSelection

  if (!anchorNode || !focusNode) return null

  const anchor = posFromDOM(doc, anchorNode, anchorOffset)
  const head = posFromDOM(doc, focusNode, focusOffset)

  if (anchor === null || head === null) return null

  try {
    const $anchor = doc.resolve(anchor)
    const $head = doc.resolve(head)
    return TextSelection.between($anchor, $head)
  } catch {
    return null
  }
}

/**
 * Find the DOM position for a document position
 */
export function domFromPos(container: HTMLElement, pos: number): { node: globalThis.Node; offset: number } | null {
  const debug: string[] = []

  // Walk the DOM tree to find the position
  function walk(node: globalThis.Node, currentPos: number): { node: globalThis.Node; offset: number } | null {
    const info = getPosInfo(node)

    if (node.nodeType === 3) {
      // Text node
      const textLength = node.textContent?.length ?? 0
      debug.push(`text@${currentPos}(len=${textLength})`)
      if (pos >= currentPos && pos <= currentPos + textLength) {
        return { node, offset: pos - currentPos }
      }
      return null
    }

    if (node.nodeType === 1) {
      const element = node as HTMLElement

      // If this node has position info, use it
      if (info) {
        debug.push(`elem@${info.pos}(${info.node.type.name},size=${info.node.nodeSize})`)
        // info.pos is the node position
        // For block nodes, content starts at info.pos + 1
        // For inline nodes, content starts at info.pos
        const contentStart = info.node.isBlock ? info.pos + 1 : info.pos
        const contentEnd = contentStart + info.node.content.size
        if (pos < contentStart || pos > contentEnd) {
          return null // Position not in this subtree
        }
        if (pos === contentStart) {
          // At the start of content - before first child (skip leading widgets)
          let firstContentIndex = 0
          for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i]
            if (child.nodeType === 1 && (child as Element).hasAttribute('data-widget')) {
              firstContentIndex = i + 1
            } else {
              break
            }
          }
          return { node: element, offset: firstContentIndex }
        }
        if (pos === contentEnd) {
          // At the end of content - after last content child (before trailing widgets)
          let lastContentIndex = element.childNodes.length
          for (let i = element.childNodes.length - 1; i >= 0; i--) {
            const child = element.childNodes[i]
            if (child.nodeType === 1 && (child as Element).hasAttribute('data-widget')) {
              lastContentIndex = i
            } else {
              break
            }
          }
          return { node: element, offset: lastContentIndex }
        }
      } else {
        debug.push(`wrapper(${element.tagName})`)
      }

      // Search children
      // For block nodes, content starts at info.pos + 1; for inline, at info.pos
      let childPos = info ? (info.node.isBlock ? info.pos + 1 : info.pos) : currentPos
      for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i]

        // Skip cursor target spans and widget spans - they don't represent model content
        if (child.nodeType === 1) {
          const childElement = child as Element
          if (childElement.hasAttribute('data-cursor-target') || childElement.hasAttribute('data-widget')) {
            continue
          }
        }

        const result = walk(child, childPos)
        if (result) return result

        // Advance childPos based on what we just walked
        if (child.nodeType === 3) {
          childPos += child.textContent?.length ?? 0
        } else {
          const childInfo = getPosInfo(child)
          if (childInfo) {
            // Inline node with position info - use its nodeSize
            childPos = childInfo.pos + childInfo.node.nodeSize
          } else {
            // Element without position info (like mark wrappers) - count its text content
            childPos += child.textContent?.length ?? 0
          }
        }
      }
    }

    return null
  }

  const result = walk(container, 0)
  console.log(
    '[domFromPos] pos:',
    pos,
    'walk:',
    debug.join(' → '),
    '→',
    result
      ? {
          nodeName: result.node.nodeName,
          offset: result.offset,
          text: result.node.nodeType === 3 ? `"${result.node.textContent?.slice(0, 20)}..."` : null,
        }
      : 'null',
  )
  return result
}

/**
 * Set the DOM selection to match a model Selection
 */
export function selectionToDOM(container: HTMLElement, selection: Selection): boolean {
  const domSelection = container.ownerDocument.getSelection()
  if (!domSelection) return false

  const anchor = domFromPos(container, selection.anchor)
  const head = domFromPos(container, selection.head)

  if (!anchor || !head) return false

  try {
    domSelection.setBaseAndExtent(anchor.node, anchor.offset, head.node, head.offset)
    return true
  } catch {
    return false
  }
}
