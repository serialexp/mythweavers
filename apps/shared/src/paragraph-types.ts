// ============================================================================
// Editor Paragraph Types
// ============================================================================
// These types are used by the Editor and Story frontend for simplified
// paragraph handling. For API/validation, use the Zod schemas from schema.ts.

import type { ContentNode } from './schema.js'

// Re-export ContentNode for convenience
export type { ContentNode } from './schema.js'

/**
 * Comment on a paragraph (simplified for editor use)
 */
export interface ParagraphComment {
  id: string
  text: string
  user: string
  createdAt: string
}

/**
 * Plot point action for a paragraph
 */
export interface ParagraphPlotPointAction {
  plot_point_id: string
  action: 'introduce' | 'mentioned' | 'partially resolved' | 'resolved'
}

/**
 * Inventory action for a paragraph
 */
export interface ParagraphInventoryAction {
  type: 'add' | 'remove'
  character_name: string
  item_name: string
  item_amount: number
  item_description?: string
}

// ============================================================================
// Paragraph Types
// ============================================================================

/**
 * Paragraph state in the writing workflow
 */
export type ParagraphState = 'ai' | 'draft' | 'revise' | 'final' | 'sdt'

/**
 * Paragraph - the core content unit
 *
 * This type matches the backend ParagraphRevision schema:
 * - `body` contains plain text (always present, used for display/search)
 * - `contentSchema` contains ProseMirror JSON string (optional, for rich text editing)
 */
export interface Paragraph {
  /** Unique paragraph ID */
  id: string

  /** Plain text content (always present) */
  body: string

  /** ProseMirror JSON structure as string (for rich text with formatting) */
  contentSchema?: string | null

  /** Workflow state */
  state: ParagraphState

  /** Comments on this paragraph */
  comments: ParagraphComment[]

  /** Plot point actions triggered by this paragraph @deprecated Use script instead */
  plotPointActions?: ParagraphPlotPointAction[]

  /** Inventory changes triggered by this paragraph @deprecated Use script instead */
  inventoryActions?: ParagraphInventoryAction[]

  /** JavaScript to execute for this paragraph. Receives (data, functions) parameters. */
  script?: string | null

  // ---- Editor-specific fields (not persisted to backend) ----

  /** AI suggestion overlay text */
  extra?: string

  /** Whether AI suggestion is loading */
  extraLoading?: boolean

  /** Translation overlay text */
  translation?: string

  /** Word count */
  words?: number

  /** Character count from AI-generated content */
  aiCharacters?: number

  /** Character count from human-written content */
  humanCharacters?: number
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract plain text from a ContentNode
 */
export function contentNodeToText(contentNode: ContentNode): string {
  return contentNode.content.map((block) => block.content?.map((textNode) => textNode.text).join('') || '').join('\n')
}

/**
 * Extract plain text from a paragraph (handles both plain text and rich text)
 */
export function paragraphToText(paragraph: Paragraph): string {
  return paragraph.body
}

/**
 * Convert an array of paragraphs to plain text
 */
export function paragraphsToText(paragraphs: Paragraph[]): string {
  return paragraphs.map((p) => p.body).join('\n\n')
}

/**
 * Parse contentSchema string to ContentNode object
 * Returns null if contentSchema is not present or invalid
 */
export function parseContentSchema(paragraph: Paragraph): ContentNode | null {
  if (!paragraph.contentSchema) return null
  try {
    return JSON.parse(paragraph.contentSchema) as ContentNode
  } catch {
    return null
  }
}
