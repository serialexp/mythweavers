import type { Node } from '../model'
import { Selection, TextSelection } from '../state'

/**
 * Node index entry — built on-demand from the current document model.
 * Contains everything needed to compute positions, content ranges, etc.
 */
export interface NodeIndexEntry {
  /** The model node */
  node: Node
  /** Document position at the start of this node */
  pos: number
  /** Whether this is the doc node (special content-start rules) */
  isDoc: boolean
}

/**
 * Build an index of node ID → { node, pos } from the current document.
 * This walks the model tree once and is the single source of truth for positions.
 * Called on-demand by domFromPos / posFromDOM — the model is always authoritative.
 */
export function buildNodeIndex(doc: Node): Map<string, NodeIndexEntry> {
  const index = new Map<string, NodeIndexEntry>()

  function walk(node: Node, pos: number, isDoc: boolean) {
    index.set(node.id, { node, pos, isDoc })
    if (!node.isLeaf) {
      // For the doc node, content starts at pos (no opening token).
      // For all other block nodes, content starts at pos + 1.
      const contentStart = isDoc ? pos : pos + 1
      node.forEach((child, offset) => {
        walk(child, contentStart + offset, false)
      })
    }
  }

  walk(doc, 0, true)
  return index
}

// ─── DOM ↔ Node ID mapping ──────────────────────────────────────────────
//
// Instead of storing full position info (pos + node) on DOM elements, we
// only store the **node ID** — a string that never changes for a given DOM
// element (KeyedFor reconciles by ID). Actual positions and node references
// are resolved from the current document model via buildNodeIndex().
//
// This eliminates staleness: the WeakMap is written once in a ref callback
// and never needs updating.

const nodeIdMap = new WeakMap<globalThis.Node, string>()
const reverseNodeMap = new Map<string, HTMLElement>()

/**
 * Register a DOM element as representing a model node.
 * Call this once in a `ref` callback — the node ID never changes for a
 * given DOM element, so no reactive updates are needed.
 *
 * Also populates the reverse map (node ID → DOM element) so we can find
 * elements by their model node ID for overlays, block selection, etc.
 */
export function registerNodeId(domNode: globalThis.Node, nodeId: string): void {
  nodeIdMap.set(domNode, nodeId)
  if (domNode instanceof HTMLElement) {
    reverseNodeMap.set(nodeId, domNode)
  }
}

/**
 * Get the node ID registered on a DOM element, if any.
 */
export function getNodeId(domNode: globalThis.Node): string | undefined {
  return nodeIdMap.get(domNode)
}

/**
 * Get the DOM element for a given node ID, if registered.
 */
export function getElementByNodeId(nodeId: string): HTMLElement | undefined {
  return reverseNodeMap.get(nodeId)
}

/**
 * Remove entries from the reverse map whose IDs are no longer in the document.
 * Call this on document changes to prevent detached elements from accumulating.
 */
export function pruneReverseMap(activeIds: Set<string>): void {
  for (const id of reverseNodeMap.keys()) {
    if (!activeIds.has(id)) {
      reverseNodeMap.delete(id)
    }
  }
}

/**
 * Get the content start position for a node.
 * Doc node: contentStart = pos (no opening token).
 * Other block nodes: contentStart = pos + 1.
 * Inline nodes: contentStart = pos.
 */
function getContentStart(entry: NodeIndexEntry): number {
  if (entry.isDoc) return entry.pos
  return entry.node.isBlock ? entry.pos + 1 : entry.pos
}

/**
 * Look up the index entry for a DOM node, if it has a registered node ID.
 */
function lookupEntry(
  domNode: globalThis.Node,
  index: Map<string, NodeIndexEntry>,
): NodeIndexEntry | undefined {
  const id = nodeIdMap.get(domNode)
  if (id === undefined) return undefined
  return index.get(id)
}

/**
 * Find the nearest ancestor with a registered node ID and resolve its
 * current position from the index.
 */
function findNearestEntry(
  node: globalThis.Node | null,
  index: Map<string, NodeIndexEntry>,
): { domNode: globalThis.Node; entry: NodeIndexEntry } | null {
  while (node) {
    const entry = lookupEntry(node, index)
    if (entry) return { domNode: node, entry }
    node = node.parentNode
  }
  return null
}

/**
 * Count content size before a node within a subtree, up to (but not including) the target.
 * This accounts for:
 * - Text nodes: count their length
 * - Inline atom nodes with a registered ID: count their nodeSize
 * - Block nodes with a registered ID: count their nodeSize (includes opening/closing tags)
 * - Mark wrappers without an ID (like <strong>): walk into children
 * Returns null if target is not found.
 */
function countContentBefore(
  container: globalThis.Node,
  target: globalThis.Node,
  index: Map<string, NodeIndexEntry>,
): number | null {
  let count = 0

  function walk(node: globalThis.Node): boolean {
    if (node === target) {
      return true // Found it
    }

    if (node.nodeType === 3) {
      // Text node - count its length
      count += node.textContent?.length ?? 0
      return false
    }

    if (node.nodeType === 1) {
      const element = node as Element

      // Cursor target spans don't contribute to content count, but we still
      // need to check if the target is inside them
      if (element.hasAttribute('data-cursor-target')) {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (node.childNodes[i] === target) {
            return true
          }
        }
        return false
      }

      // Widget spans don't contribute to content count - they're decorations, not content
      if (element.hasAttribute('data-widget')) {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (node.childNodes[i] === target) {
            return true
          }
          if (node.childNodes[i].contains(target)) {
            return true
          }
        }
        return false
      }

      // Element node - check if it has a registered node ID
      const entry = lookupEntry(node, index)
      if (entry) {
        if (entry.node.isInline && entry.node.isAtom) {
          // Inline atom node (mention, image, etc.) - count its nodeSize
          count += entry.node.nodeSize
          return false // Don't walk into it
        }

        if (entry.node.isBlock) {
          // Block node — check if the target is inside it.
          if (node.contains(target)) {
            // Target is inside this block — walk into children to find it.
            for (let i = 0; i < node.childNodes.length; i++) {
              if (walk(node.childNodes[i])) {
                return true
              }
            }
            return false
          }
          // Target is not inside this block — count the block's full nodeSize
          count += entry.node.nodeSize
          return false
        }

        // Non-atom inline node — walk into children
      }

      // Element without registered ID (mark wrapper) or non-block with ID — walk children
      for (let i = 0; i < node.childNodes.length; i++) {
        if (walk(node.childNodes[i])) {
          return true
        }
      }
    }

    return false
  }

  // Walk children of container (not the container itself)
  for (let i = 0; i < container.childNodes.length; i++) {
    if (walk(container.childNodes[i])) {
      return count
    }
  }

  return null // Target not found
}

/**
 * Calculate the document position from a DOM position.
 * Builds a fresh node index from the current document to avoid stale data.
 */
export function posFromDOM(doc: Node, domNode: globalThis.Node, domOffset: number): number | null {
  const index = buildNodeIndex(doc)

  // Find nearest ancestor with a registered node ID
  const nearest = findNearestEntry(domNode, index)
  if (!nearest) return null

  const { domNode: ancestorNode, entry } = nearest
  const contentStartPos = getContentStart(entry)

  // If we're in a text node, add the offset
  if (domNode.nodeType === 3) {
    if (domNode === ancestorNode) {
      // Direct text node with registered ID (rare case)
      return contentStartPos + domOffset
    }

    // Text node is somewhere within the ancestor's subtree
    const contentBefore = countContentBefore(ancestorNode, domNode, index)
    if (contentBefore === null) return null

    return contentStartPos + contentBefore + domOffset
  }

  // For element nodes, traverse children to find position
  if (domNode.nodeType === 1 && domNode === ancestorNode) {
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
        const childEntry = lookupEntry(child, index)
        if (childEntry) {
          offset = childEntry.pos - contentStartPos + childEntry.node.nodeSize
        } else {
          // Element without registered ID (mark wrapper) - count text content
          offset += child.textContent?.length ?? 0
        }
      }
    }
    return contentStartPos + offset
  }

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
 * Find the DOM position for a document position.
 * Builds a fresh node index from the current document to avoid stale data.
 */
export function domFromPos(
  container: HTMLElement,
  pos: number,
  doc?: Node,
): { node: globalThis.Node; offset: number } | null {
  // Build node index if doc is provided; otherwise fall back to looking up
  // the doc node from the container's registered ID (the container should
  // be the doc element).
  let index: Map<string, NodeIndexEntry> | undefined
  if (doc) {
    index = buildNodeIndex(doc)
  }

  function walk(node: globalThis.Node, currentPos: number): { node: globalThis.Node; offset: number } | null {
    const entry = index ? lookupEntry(node, index) : undefined

    if (node.nodeType === 3) {
      // Text node
      const textLength = node.textContent?.length ?? 0
      if (pos >= currentPos && pos <= currentPos + textLength) {
        return { node, offset: pos - currentPos }
      }
      return null
    }

    if (node.nodeType === 1) {
      const element = node as HTMLElement

      // If this node has a registered ID and we have index data, use it
      if (entry) {
        const contentStart = getContentStart(entry)
        const contentEnd = contentStart + entry.node.content.size
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
      }

      // Search children
      let childPos = entry ? getContentStart(entry) : currentPos
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
          const childEntry = index ? lookupEntry(child, index) : undefined
          if (childEntry) {
            childPos = childEntry.pos + childEntry.node.nodeSize
          } else {
            // Element without registered ID (like mark wrappers) - count its text content
            childPos += child.textContent?.length ?? 0
          }
        }
      }
    }

    return null
  }

  return walk(container, 0)
}

/**
 * Check if a DOM position is inside a widget element.
 * If so, return an adjusted position before the widget.
 */
function adjustPositionOutsideWidget(
  domNode: globalThis.Node,
  offset: number,
): { node: globalThis.Node; offset: number } {
  // If we're inside a widget span, find its parent and our position relative to it
  let current: globalThis.Node | null = domNode
  while (current) {
    if (current.nodeType === 1 && (current as Element).hasAttribute('data-widget')) {
      // We're inside a widget - return position before this widget in its parent
      const parent = current.parentNode
      if (parent) {
        const children = Array.from(parent.childNodes)
        const widgetIndex = children.indexOf(current as ChildNode)
        if (widgetIndex >= 0) {
          return { node: parent, offset: widgetIndex }
        }
      }
      break
    }
    current = current.parentNode
  }

  // If the offset points to a widget child, adjust to before the widget
  if (domNode.nodeType === 1 && offset < domNode.childNodes.length) {
    const child = domNode.childNodes[offset]
    if (child.nodeType === 1 && (child as Element).hasAttribute('data-widget')) {
      return { node: domNode, offset }
    }
  }

  return { node: domNode, offset }
}

/**
 * Set the DOM selection to match a model Selection.
 * Requires the current document for building the node index.
 */
export function selectionToDOM(container: HTMLElement, selection: Selection, doc?: Node): boolean {
  const domSelection = container.ownerDocument.getSelection()
  if (!domSelection) return false

  const anchor = domFromPos(container, selection.anchor, doc)
  const head = domFromPos(container, selection.head, doc)

  if (!anchor || !head) return false

  // Ensure positions are not inside widget elements
  const adjustedAnchor = adjustPositionOutsideWidget(anchor.node, anchor.offset)
  const adjustedHead = adjustPositionOutsideWidget(head.node, head.offset)

  try {
    domSelection.setBaseAndExtent(
      adjustedAnchor.node,
      adjustedAnchor.offset,
      adjustedHead.node,
      adjustedHead.offset,
    )
    return true
  } catch {
    return false
  }
}

// ─── Backwards compatibility ────────────────────────────────────────────
//
// setPosInfo / getPosInfo are kept for external consumers and custom node
// views that haven't migrated yet. They delegate to registerNodeId under
// the hood — storing the node ID, not the full PosInfo.

/**
 * @deprecated Use `registerNodeId(domNode, node.id)` instead.
 * Kept for backwards compatibility with custom node views.
 */
export interface PosInfo {
  pos: number
  node: Node
  contentStart?: number
}

/**
 * @deprecated Use `registerNodeId(domNode, node.id)` instead.
 */
export function setPosInfo(domNode: globalThis.Node, info: PosInfo): void {
  registerNodeId(domNode, info.node.id)
}

/**
 * @deprecated Use `getNodeId(domNode)` instead.
 */
export function getPosInfo(domNode: globalThis.Node): PosInfo | undefined {
  const id = nodeIdMap.get(domNode)
  if (id === undefined) return undefined
  // We can't reconstruct full PosInfo without a doc — return a stub
  // that at least has the node ID for identification purposes.
  return undefined
}
