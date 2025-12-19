/**
 * Migration utilities shared between Writer and Story migrations
 */

import { createId } from '@paralleldrive/cuid2'

// ID generation utilities
export const generateCuid = () => createId()

// Transform perspective values
export const transformPerspective = (perspective: string | undefined | null): 'FIRST' | 'THIRD' | null => {
  if (!perspective) return null
  const lower = perspective.toLowerCase()
  if (lower === 'first') return 'FIRST'
  if (lower === 'third') return 'THIRD'
  return null
}

// Transform paragraph state
export const transformParagraphState = (
  state: string | undefined | null,
): 'AI' | 'DRAFT' | 'REVISE' | 'FINAL' | 'SDT' | null => {
  if (!state) return null
  const lower = state.toLowerCase()
  switch (lower) {
    case 'ai':
      return 'AI'
    case 'draft':
      return 'DRAFT'
    case 'revise':
      return 'REVISE'
    case 'final':
      return 'FINAL'
    case 'sdt':
      return 'SDT'
    default:
      return null
  }
}

// Transform plot point action type
export const transformPlotPointActionType = (action: string | undefined): string | null => {
  if (!action) return null
  const lower = action.toLowerCase()
  switch (lower) {
    case 'introduce':
      return 'INTRODUCE'
    case 'mentioned':
      return 'MENTIONED'
    case 'partially resolved':
      return 'PARTIALLY_RESOLVED'
    case 'resolved':
      return 'RESOLVED'
    default:
      return null
  }
}

// Transform inventory action type
export const transformInventoryActionType = (type: string | undefined): 'ADD' | 'REMOVE' | null => {
  if (!type) return null
  const lower = type.toLowerCase()
  if (lower === 'add') return 'ADD'
  if (lower === 'remove') return 'REMOVE'
  return null
}

// Transform story status
export const transformStoryStatus = (status: string | undefined): 'COMPLETED' | 'ONGOING' | 'HIATUS' => {
  if (!status) return 'ONGOING'
  const lower = status.toLowerCase()
  switch (lower) {
    case 'completed':
      return 'COMPLETED'
    case 'hiatus':
      return 'HIATUS'
    default:
      return 'ONGOING'
  }
}

// Transform node type
export const transformNodeType = (nodeType: string | undefined): 'story' | 'non-story' | 'context' => {
  if (!nodeType) return 'story'
  const lower = nodeType.toLowerCase()
  if (lower === 'context') return 'context'
  if (lower === 'non-story') return 'non-story'
  return 'story'
}

// Content schema to plain text
export const contentSchemaToText = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (!content || typeof content !== 'object') return ''

  const doc = content as {
    type?: string
    content?: Array<{
      type?: string
      content?: Array<{
        text?: string
      }>
    }>
  }

  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return ''

  return doc.content
    .map((block) => {
      if (!block.content) return ''
      return block.content.map((node) => node.text || '').join('')
    })
    .join('\n')
}

// Batch processing helper
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: { batchSize?: number; onProgress?: (processed: number, total: number) => void } = {},
): Promise<R[]> {
  const { batchSize = 100, onProgress } = options
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)

    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length)
    }
  }

  return results
}

// Create a mapping table for ID transformations
export class IdMapper {
  private maps: Map<string, Map<string, string>> = new Map()

  setMapping(type: string, oldId: string, newId: string): void {
    if (!this.maps.has(type)) {
      this.maps.set(type, new Map())
    }
    this.maps.get(type)!.set(oldId, newId)
  }

  getMapping(type: string, oldId: string): string | undefined {
    return this.maps.get(type)?.get(oldId)
  }

  getMappingOrThrow(type: string, oldId: string): string {
    const newId = this.getMapping(type, oldId)
    if (!newId) {
      throw new Error(`No mapping found for ${type}:${oldId}`)
    }
    return newId
  }

  getMappingOrSame(type: string, oldId: string): string {
    return this.getMapping(type, oldId) ?? oldId
  }

  getAllMappings(type: string): Map<string, string> {
    return this.maps.get(type) ?? new Map()
  }

  toJSON(): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {}
    for (const [type, map] of this.maps) {
      result[type] = Object.fromEntries(map)
    }
    return result
  }

  static fromJSON(json: Record<string, Record<string, string>>): IdMapper {
    const mapper = new IdMapper()
    for (const [type, mappings] of Object.entries(json)) {
      for (const [oldId, newId] of Object.entries(mappings)) {
        mapper.setMapping(type, oldId, newId)
      }
    }
    return mapper
  }
}

// Logger utility
export interface MigrationLogger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string, error?: unknown) => void
  progress: (current: number, total: number, label?: string) => void
}

export const createConsoleLogger = (): MigrationLogger => ({
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message, error) => {
    console.error(`[ERROR] ${message}`)
    if (error) console.error(error)
  },
  progress: (current, total, label) => {
    const pct = Math.round((current / total) * 100)
    const labelStr = label ? ` ${label}` : ''
    process.stdout.write(`\r[PROGRESS]${labelStr} ${current}/${total} (${pct}%)`)
    if (current === total) console.log()
  },
})

// Validation result type
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// Combine validation results
export const combineValidationResults = (...results: ValidationResult[]): ValidationResult => {
  return {
    valid: results.every((r) => r.valid),
    errors: results.flatMap((r) => r.errors),
    warnings: results.flatMap((r) => r.warnings),
  }
}
