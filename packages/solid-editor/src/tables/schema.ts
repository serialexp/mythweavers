/**
 * Table schema definitions.
 *
 * Provides node specs for table, table_row, table_cell, and table_header nodes,
 * plus a utility to look up table node types by their tableRole.
 */

import type { AttributeSpec, NodeSpec, NodeType, Schema } from '../model/schema'

/** The four table roles used to discriminate table node types. */
export type TableRole = 'table' | 'row' | 'cell' | 'header_cell'

/** Options for creating table node specs. */
export interface TableNodesOptions {
  /** A group name (e.g. "block") to add to the table node type. */
  tableGroup?: string
  /** The content expression for table cells (e.g. "block+" or "paragraph+"). */
  cellContent: string
  /** Additional attributes to add to cell nodes. */
  cellAttributes?: { [key: string]: { default: unknown; validate?: string | ((value: unknown) => void) } }
}

/** The four table node specs. */
export type TableNodes = Record<'table' | 'table_row' | 'table_cell' | 'table_header', NodeSpec>

function validateColwidth(value: unknown) {
  if (value === null) return
  if (!Array.isArray(value)) {
    throw new TypeError('colwidth must be null or an array')
  }
  for (const item of value) {
    if (typeof item !== 'number') {
      throw new TypeError('colwidth must be null or an array of numbers')
    }
  }
}

/**
 * Create a set of node specs for table, table_row, table_cell, and table_header.
 * The result can be spread into a schema's node spec object.
 *
 * ```ts
 * const schema = new Schema({
 *   nodes: {
 *     doc: { content: 'block+' },
 *     paragraph: { content: 'inline*', group: 'block' },
 *     ...tableNodes({ tableGroup: 'block', cellContent: 'block+' }),
 *     text: { group: 'inline' },
 *   },
 * })
 * ```
 */
export function tableNodes(options: TableNodesOptions): TableNodes {
  const extraAttrs = options.cellAttributes || {}
  const cellAttrs: Record<string, AttributeSpec> = {
    colspan: { default: 1, validate: 'number' },
    rowspan: { default: 1, validate: 'number' },
    colwidth: { default: null, validate: validateColwidth },
  }
  for (const prop in extraAttrs) {
    cellAttrs[prop] = {
      default: extraAttrs[prop].default,
      validate: extraAttrs[prop].validate,
    }
  }

  return {
    table: {
      content: 'table_row+',
      tableRole: 'table',
      isolating: true,
      group: options.tableGroup,
    },
    table_row: {
      content: '(table_cell | table_header)*',
      tableRole: 'row',
    },
    table_cell: {
      content: options.cellContent,
      attrs: cellAttrs,
      tableRole: 'cell',
      isolating: true,
    },
    table_header: {
      content: options.cellContent,
      attrs: cellAttrs,
      tableRole: 'header_cell',
      isolating: true,
    },
  }
}

/**
 * Look up table node types by their `tableRole` spec property.
 * Results are cached on the schema object.
 *
 * Returns a record mapping each TableRole to its NodeType:
 * - `table` -> the table node type
 * - `row` -> the table_row node type
 * - `cell` -> the table_cell node type
 * - `header_cell` -> the table_header node type
 */
export function tableNodeTypes(schema: Schema): Record<TableRole, NodeType> {
  // Cache on schema via a module-level WeakMap
  let result = tableNodeTypesCache.get(schema)
  if (!result) {
    result = {} as Record<TableRole, NodeType>
    for (const name in schema.nodes) {
      const type = schema.nodes[name]
      const role = type.spec.tableRole as TableRole | undefined
      if (role) result[role] = type
    }
    tableNodeTypesCache.set(schema, result)
  }
  return result
}

const tableNodeTypesCache = new WeakMap<Schema, Record<TableRole, NodeType>>()
