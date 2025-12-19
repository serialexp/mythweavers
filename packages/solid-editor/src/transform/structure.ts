import { Node, NodeRange, NodeType, Slice } from '../model'
import type { Attrs } from '../model/types'

/**
 * Determine if content can be lifted out of its parent into the parent's parent.
 * Returns the depth to which the content can be lifted, or null if not liftable.
 */
export function liftTarget(range: NodeRange): number | null {
  const parent = range.parent
  const content = parent.content.cutByIndex(range.startIndex, range.endIndex)

  for (let depth = range.depth; ; --depth) {
    const node = range.$from.node(depth)
    const index = range.$from.index(depth)
    const endIndex = range.$to.indexAfter(depth)

    if (depth < range.depth && node.canReplace(index, endIndex, content)) {
      return depth
    }

    if (depth === 0 || node.type.spec.isolating || !canCut(node, index, endIndex)) {
      break
    }
  }

  return null
}

/**
 * Check if the node can be cut at the given indices.
 */
function canCut(node: Node, start: number, end: number): boolean {
  return (
    (start === 0 || node.canReplace(0, start)) && (end === node.childCount || node.canReplace(end, node.childCount))
  )
}

/**
 * Find a valid wrapping for the given range with the specified node type.
 * Returns an array of node types to wrap with, innermost first, or null if not possible.
 */
export function findWrapping(
  range: NodeRange,
  nodeType: NodeType,
  attrs?: Attrs | null,
  innerRange: NodeRange = range,
): { type: NodeType; attrs: Attrs | null }[] | null {
  const around = findWrappingOutside(range, nodeType)
  const inner = around && findWrappingInside(innerRange, nodeType)

  if (!inner) return null

  const result = around
    .map((t) => ({ type: t, attrs: null as Attrs | null }))
    .concat({ type: nodeType, attrs: attrs || null })
    .concat(inner.map((t) => ({ type: t, attrs: null as Attrs | null })))

  return result
}

/**
 * Find wrapping needed outside the range.
 */
function findWrappingOutside(range: NodeRange, type: NodeType): NodeType[] | null {
  const { parent, startIndex, endIndex } = range
  const around = parent.contentMatchAt(startIndex).findWrapping(type)

  if (!around) return null

  const outer = around.length ? around[around.length - 1] : type
  return parent.canReplaceWith(startIndex, endIndex, outer) ? around : null
}

/**
 * Find wrapping needed inside the range.
 */
function findWrappingInside(range: NodeRange, type: NodeType): NodeType[] | null {
  const { parent, startIndex, endIndex } = range
  const inner = parent.child(startIndex)
  if (!type.contentMatch) return null
  const inside = type.contentMatch.findWrapping(inner.type)

  if (!inside) return null

  const lastType = inside.length ? inside[inside.length - 1] : type
  let innerMatch = lastType.contentMatch

  for (let i = startIndex; innerMatch && i < endIndex; i++) {
    innerMatch = innerMatch.matchType(parent.child(i).type)
  }

  return innerMatch?.validEnd ? inside : null
}

/**
 * Check if the content in the range can be joined with adjacent content
 * when lifted.
 */
export function canSplit(
  doc: Node,
  pos: number,
  depth = 1,
  typesAfter?: { type: NodeType; attrs?: Attrs | null }[] | null,
): boolean {
  const $pos = doc.resolve(pos)
  const base = $pos.depth - depth

  const innerType = typesAfter?.length ? typesAfter[0] : { type: $pos.parent.type, attrs: $pos.parent.attrs }

  if (
    base < 0 ||
    $pos.parent.type.spec.isolating ||
    !$pos.parent.canReplace($pos.index(), $pos.parent.childCount) ||
    !innerType.type.validContent($pos.parent.content.cutByIndex($pos.index(), $pos.parent.childCount))
  ) {
    return false
  }

  for (let d = $pos.depth - 1, i = depth - 2; d > base; d--, i--) {
    const node = $pos.node(d)
    const index = $pos.index(d)

    if (node.type.spec.isolating) return false

    let rest = node.content.cutByIndex(index, node.childCount)
    const overrideChild = typesAfter?.[i + 1]

    if (overrideChild) {
      rest = rest.replaceChild(0, overrideChild.type.create(overrideChild.attrs))
    }

    const after = typesAfter?.[i] ? typesAfter[i] : node
    if (!node.canReplace(index + 1, node.childCount) || !after.type.validContent(rest)) {
      return false
    }
  }

  const index = $pos.indexAfter(base)
  const baseType = typesAfter?.[0]
  return $pos.node(base).canReplaceWith(index, index, baseType ? baseType.type : $pos.node(base + 1).type)
}

/**
 * Test whether blocks before and after a given position can be joined.
 */
export function canJoin(doc: Node, pos: number): boolean {
  const $pos = doc.resolve(pos)
  const index = $pos.index()

  return joinable($pos.nodeBefore, $pos.nodeAfter) && $pos.parent.canReplace(index, index + 1)
}

/**
 * Check if two nodes can be joined.
 */
function joinable(a: Node | null, b: Node | null): boolean {
  return !!(a && b && !a.isLeaf && a.canAppend(b))
}

/**
 * Find an ancestor of the given position that can be joined to the
 * block before (or after if `dir` is positive). Returns the joinable
 * point, if any.
 */
export function joinPoint(doc: Node, pos: number, dir = -1): number | null {
  const $pos = doc.resolve(pos)

  for (let d = $pos.depth; ; d--) {
    let before: Node | null
    let after: Node | null
    let index: number

    if (d === $pos.depth) {
      before = $pos.nodeBefore
      after = $pos.nodeAfter
      index = $pos.index()
    } else if (dir > 0) {
      before = $pos.node(d + 1)
      index = $pos.index(d) + 1
      after = $pos.node(d).maybeChild(index)
    } else {
      before = $pos.node(d).maybeChild($pos.index(d) - 1)
      index = $pos.index(d)
      after = $pos.node(d + 1)
    }

    if (before && !before.isTextblock && joinable(before, after) && $pos.node(d).canReplace(index, index + 1)) {
      return $pos.before(d + 1)
    }

    if (d === 0) break
  }

  return null
}

/**
 * Find the point after which a node of the given type can be inserted.
 */
export function insertPoint(doc: Node, pos: number, nodeType: NodeType): number | null {
  const $pos = doc.resolve(pos)

  // First try finding a place right at pos
  if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), nodeType)) {
    return pos
  }

  if ($pos.parentOffset === 0) {
    for (let d = $pos.depth - 1; d >= 0; d--) {
      const index = $pos.index(d)
      if ($pos.node(d).canReplaceWith(index, index, nodeType)) {
        return $pos.before(d + 1)
      }
      if (index > 0) return null
    }
  }

  if ($pos.parentOffset === $pos.parent.content.size) {
    for (let d = $pos.depth - 1; d >= 0; d--) {
      const index = $pos.indexAfter(d)
      if ($pos.node(d).canReplaceWith(index, index, nodeType)) {
        return $pos.after(d + 1)
      }
      if (index < $pos.node(d).childCount) return null
    }
  }

  return null
}

/**
 * Finds a position at or around the given position where the given
 * slice can be inserted. Will look at parent nodes if needed.
 */
export function dropPoint(doc: Node, pos: number, slice: Slice): number | null {
  const $pos = doc.resolve(pos)

  if (!slice.content.size) return pos

  let content = slice.content
  for (let i = 0; i < slice.openStart; i++) {
    content = content.firstChild!.content
  }

  const pass = content.firstChild!

  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d)
    const index = d === $pos.depth ? $pos.index() : $pos.index(d) + 1

    if (node.canReplaceWith(index, index, pass.type, pass.marks)) {
      return d === $pos.depth ? pos : $pos.after(d + 1)
    }
  }

  return null
}
