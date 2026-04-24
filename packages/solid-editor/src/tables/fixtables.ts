/**
 * Table validation and repair.
 *
 * Two strategies:
 *
 * 1. **validateTables** — Throws if a transaction produced invalid tables.
 *    This is the default for local editing. Our commands produce valid tables
 *    by construction, so any invalid table is a bug that should surface
 *    immediately rather than be silently papered over.
 *
 * 2. **fixTables** — Repairs invalid tables in-place. Reserved for explicitly
 *    untrusted input: collaborative rebasing, pasted content, or loaded JSON
 *    from external sources.
 *
 * Both use `changedDescendants` to only inspect tables that actually changed,
 * keeping the cost proportional to the edit — not the document size.
 */

import type { Node } from '../model/node'
import type { EditorState } from '../state/state'
import type { Transaction } from '../state/transaction'
import { PluginKey } from '../state/plugin'
import type { TableRole } from './schema'
import { tableNodeTypes } from './schema'
import { TableMap } from './tablemap'
import type { Problem } from './tablemap'
import type { CellAttrs } from './util'
import { removeColSpan } from './util'

/** Plugin key used to tag transactions that fix tables. */
export const fixTablesKey = new PluginKey<{ fixTables: boolean }>('fix-tables')

// ── Changed-descendants scanner ────────────────────────────────────────

/**
 * Iterate through nodes in `cur` that changed compared to `old`.
 * Uses reference equality (immutable persistent data structures) to
 * skip unchanged subtrees. Only calls `f` for nodes that are new or
 * whose content changed.
 */
function changedDescendants(
  old: Node,
  cur: Node,
  offset: number,
  f: (node: Node, pos: number) => void,
): void {
  const oldSize = old.childCount
  const curSize = cur.childCount
  outer: for (let i = 0, j = 0; i < curSize; i++) {
    const child = cur.child(i)
    for (let scan = j, e = Math.min(oldSize, i + 3); scan < e; scan++) {
      if (old.child(scan) === child) {
        j = scan + 1
        offset += child.nodeSize
        continue outer
      }
    }
    f(child, offset)
    if (j < oldSize && old.child(j).sameMarkup(child)) {
      changedDescendants(old.child(j), child, offset + 1, f)
    } else {
      child.nodesBetween(0, child.content.size, f, offset + 1)
    }
    offset += child.nodeSize
  }
}

// ── Validation (fail-fast) ─────────────────────────────────────────────

/**
 * Format a Problem into a human-readable string for error messages.
 */
function describeProblem(problem: Problem, tablePos: number): string {
  switch (problem.type) {
    case 'collision':
      return `Cell collision at row ${problem.row}, table-relative pos ${problem.pos} (document pos ~${tablePos + 1 + problem.pos}): ${problem.n} overlapping cell(s)`
    case 'missing':
      return `Row ${problem.row} is missing ${problem.n} cell(s)`
    case 'overlong_rowspan':
      return `Cell at table-relative pos ${problem.pos} has rowspan extending ${problem.n} row(s) past the table bottom`
    case 'colwidth mismatch':
      return `Cell at table-relative pos ${problem.pos} has inconsistent column widths`
    case 'zero_sized':
      return `Table has zero width or height`
  }
}

/**
 * Validate all tables in the new document that changed relative to the
 * old document. Throws a descriptive error if any table has structural
 * problems (overlapping cells, missing cells, invalid rowspans, etc).
 *
 * This should be called after applying a transaction to catch bugs in
 * commands or plugins that produce invalid table structures.
 *
 * Cost: proportional to the number of changed tables, not the document size.
 *
 * @param oldDoc - The document before the transaction.
 * @param newDoc - The document after the transaction.
 * @throws {RangeError} if any changed table is structurally invalid
 *         (ignoring colwidth mismatches, which are cosmetic).
 */
export function validateTables(oldDoc: Node, newDoc: Node): void {
  if (oldDoc === newDoc) return

  const errors: string[] = []

  changedDescendants(oldDoc, newDoc, 0, (node, pos) => {
    if (node.type.spec.tableRole !== 'table') return

    const map = TableMap.get(node)
    if (!map.problems) return

    // Colwidth mismatches are cosmetic, not structural — don't throw for those
    const structural = map.problems.filter((p) => p.type !== 'colwidth mismatch')
    if (structural.length === 0) return

    const descriptions = structural.map((p) => describeProblem(p, pos))
    errors.push(`Invalid table at position ${pos}:\n  - ${descriptions.join('\n  - ')}`)
  })

  if (errors.length > 0) {
    throw new RangeError(
      `Transaction produced invalid table structure:\n${errors.join('\n')}`,
    )
  }
}

/**
 * Validate all tables in a document (not just changed ones).
 * Useful for validating documents loaded from external sources.
 *
 * @throws {RangeError} if any table is structurally invalid.
 */
export function validateAllTables(doc: Node): void {
  const errors: string[] = []

  doc.descendants((node, pos) => {
    if (node.type.spec.tableRole !== 'table') return true

    const map = TableMap.get(node)
    if (!map.problems) return true

    const structural = map.problems.filter((p) => p.type !== 'colwidth mismatch')
    if (structural.length === 0) return true

    const descriptions = structural.map((p) => describeProblem(p, pos))
    errors.push(`Invalid table at position ${pos}:\n  - ${descriptions.join('\n  - ')}`)
    return true
  })

  if (errors.length > 0) {
    throw new RangeError(
      `Document contains invalid table structure:\n${errors.join('\n')}`,
    )
  }
}

// ── Repair (for untrusted input) ───────────────────────────────────────

/**
 * Inspect all tables in the given state's document and return a
 * transaction that fixes them, if necessary. If `oldState` was
 * provided, that is assumed to hold a previous, known-good state,
 * which will be used to avoid re-scanning unchanged parts.
 *
 * Use this for untrusted input: collaborative rebasing, HTML paste,
 * or documents loaded from external sources. For local editing,
 * prefer `validateTables` which throws on invalid structure rather
 * than silently repairing.
 */
export function fixTables(state: EditorState, oldState?: EditorState): Transaction | undefined {
  let tr: Transaction | undefined
  const check = (node: Node, pos: number) => {
    if (node.type.spec.tableRole === 'table') {
      tr = fixTable(state, node, pos, tr)
    }
  }
  if (!oldState) {
    state.doc.descendants(check)
  } else if (oldState.doc !== state.doc) {
    changedDescendants(oldState.doc, state.doc, 0, check)
  }
  return tr
}

/**
 * Fix the given table, if necessary. Will append to the transaction
 * it was given, if non-null, or create a new one if necessary.
 */
export function fixTable(
  state: EditorState,
  table: Node,
  tablePos: number,
  tr: Transaction | undefined,
): Transaction | undefined {
  const map = TableMap.get(table)
  if (!map.problems) return tr
  if (!tr) tr = state.tr()

  // Track which rows we must add cells to
  const mustAdd: number[] = []
  for (let i = 0; i < map.height; i++) mustAdd.push(0)

  for (let i = 0; i < map.problems.length; i++) {
    const prob = map.problems[i]
    if (prob.type === 'collision') {
      const cell = table.nodeAt(prob.pos)
      if (!cell) continue
      const attrs = cell.attrs as CellAttrs
      for (let j = 0; j < attrs.rowspan; j++) mustAdd[prob.row + j] += prob.n
      tr.setNodeMarkup(
        tr.mapping.map(tablePos + 1 + prob.pos),
        null,
        removeColSpan(attrs, attrs.colspan - prob.n, prob.n),
      )
    } else if (prob.type === 'missing') {
      mustAdd[prob.row] += prob.n
    } else if (prob.type === 'overlong_rowspan') {
      const cell = table.nodeAt(prob.pos)
      if (!cell) continue
      tr.setNodeMarkup(tr.mapping.map(tablePos + 1 + prob.pos), null, {
        ...cell.attrs,
        rowspan: (cell.attrs.rowspan as number) - prob.n,
      })
    } else if (prob.type === 'colwidth mismatch') {
      const cell = table.nodeAt(prob.pos)
      if (!cell) continue
      tr.setNodeMarkup(tr.mapping.map(tablePos + 1 + prob.pos), null, {
        ...cell.attrs,
        colwidth: prob.colwidth,
      })
    } else if (prob.type === 'zero_sized') {
      const pos = tr.mapping.map(tablePos)
      tr.delete(pos, pos + table.nodeSize)
    }
  }

  let first: number | undefined
  let last: number | undefined
  for (let i = 0; i < mustAdd.length; i++) {
    if (mustAdd[i]) {
      if (first == null) first = i
      last = i
    }
  }

  // Add the necessary cells, using a heuristic for whether to add the
  // cells at the start or end of the rows
  for (let i = 0, pos = tablePos + 1; i < map.height; i++) {
    const row = table.child(i)
    const end = pos + row.nodeSize
    const add = mustAdd[i]
    if (add > 0) {
      let role: TableRole = 'cell'
      if (row.firstChild) {
        role = row.firstChild.type.spec.tableRole as TableRole
      }
      const nodes: Node[] = []
      for (let j = 0; j < add; j++) {
        const node = tableNodeTypes(state.schema)[role].createAndFill()
        if (node) nodes.push(node)
      }
      const side = (i === 0 || first === i - 1) && last === i ? pos + 1 : end - 1
      tr.insert(tr.mapping.map(side), nodes)
    }
    pos = end
  }

  return tr.setMeta(fixTablesKey, { fixTables: true })
}
