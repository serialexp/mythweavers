import type { Paragraph } from '@mythweavers/shared'
import type { Mark, Node } from '@writer/solid-editor'
import shortUUID from 'short-uuid'
import { storySchema } from './schema'

/**
 * Shape of a text node in the contentSchema JSON
 */
interface TextNodeJson {
  type: 'text'
  text: string
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
}

/**
 * Shape of a paragraph in the contentSchema JSON
 */
interface ParagraphNodeJson {
  type: 'paragraph'
  content?: TextNodeJson[]
}

/**
 * Shape of the full document in contentSchema JSON
 */
interface DocNodeJson {
  type: 'doc'
  content: ParagraphNodeJson[]
}

/**
 * Convert an array of Paragraphs to a solid-editor document
 */
export function paragraphsToDoc(paragraphs: Paragraph[]): Node {
  // Handle empty paragraphs array
  if (!paragraphs || paragraphs.length === 0) {
    return storySchema.node('doc', null, [storySchema.node('paragraph', { id: shortUUID.generate() }, [])])
  }

  const paragraphNodes = paragraphs
    .map((paragraph) => {
      try {
        // Try to use contentSchema (rich text) first
        if (paragraph.contentSchema) {
          try {
            const contentNode = JSON.parse(paragraph.contentSchema) as DocNodeJson
            const content = parseContent(contentNode)
            return storySchema.node(
              'paragraph',
              {
                id: paragraph.id || shortUUID.generate(),
                extra: paragraph.extra || null,
                extraLoading: paragraph.extraLoading ? 'true' : null,
              },
              content,
            )
          } catch (error) {
            console.warn('Failed to parse contentSchema, falling back to body:', error)
          }
        }

        // Fall back to body (plain text)
        const textContent = (paragraph.body || '').trim()
        return storySchema.node(
          'paragraph',
          {
            id: paragraph.id || shortUUID.generate(),
            extra: paragraph.extra || null,
            extraLoading: paragraph.extraLoading ? 'true' : null,
          },
          textContent ? [storySchema.text(textContent)] : [],
        )
      } catch (error) {
        console.warn('Failed to create paragraph node for:', paragraph, error)
        return storySchema.node(
          'paragraph',
          {
            id: paragraph.id || shortUUID.generate(),
            extra: paragraph.extra || null,
            extraLoading: paragraph.extraLoading ? 'true' : null,
          },
          [],
        )
      }
    })
    .filter(Boolean)

  try {
    return storySchema.node('doc', null, paragraphNodes)
  } catch (error) {
    console.error('Error creating document:', error)
    // Fallback: create empty document
    return storySchema.node('doc', null, [storySchema.node('paragraph', { id: shortUUID.generate() }, [])])
  }
}

/**
 * Parse DocNodeJson structure into solid-editor nodes
 */
function parseContent(contentNode: DocNodeJson): Node[] {
  if (contentNode.type === 'doc' && contentNode.content) {
    // Extract first paragraph's content
    const firstParagraph = contentNode.content[0]
    if (firstParagraph && firstParagraph.type === 'paragraph' && firstParagraph.content) {
      return parseInlineContent(firstParagraph.content)
    }
    return []
  }
  return []
}

/**
 * Parse inline content (text nodes with marks)
 */
function parseInlineContent(content: TextNodeJson[]): Node[] {
  return content
    .map((node) => {
      if (node.type === 'text' && node.text) {
        const marks = parseMarks(node.marks || [])
        return storySchema.text(node.text, marks)
      }
      return null
    })
    .filter((n): n is Node => n !== null)
}

/**
 * Parse marks from JSON
 */
function parseMarks(markData: Array<{ type: string; attrs?: Record<string, unknown> }>): Mark[] {
  return markData
    .map((m) => {
      const markType = storySchema.marks[m.type]
      if (!markType) return null
      return markType.create(m.attrs || null)
    })
    .filter((m): m is Mark => m !== null)
}

/**
 * Convert a solid-editor document back to Paragraphs
 */
export function docToParagraphs(
  doc: Node,
  existingParagraphs: Paragraph[],
): {
  paragraphs: Paragraph[]
  changedIds: string[]
} {
  const changedIds: string[] = []
  const existingById = new Map(existingParagraphs.map((p) => [p.id, p]))

  const paragraphs: Paragraph[] = []

  doc.forEach((node, _offset, _index) => {
    if (node.type.name !== 'paragraph') return

    const paragraphId = (node.attrs.id as string) || shortUUID.generate()

    // Extract plain text
    const plainText = node.textContent

    // Build ContentNode structure
    const textNodes: Array<{ type: 'text'; text: string; marks?: Array<{ type: string; attrs: unknown }> }> = []
    node.forEach((child) => {
      if (child.type.name === 'text') {
        const textNode: { type: 'text'; text: string; marks?: Array<{ type: string; attrs: unknown }> } = {
          type: 'text',
          text: child.text || '',
        }
        if (child.marks && child.marks.length > 0) {
          textNode.marks = child.marks.map((mark) => ({
            type: mark.type.name,
            attrs: mark.attrs,
          }))
        }
        textNodes.push(textNode)
      }
    })

    const hasMarks = textNodes.some((tn) => tn.marks && tn.marks.length > 0)

    // Build contentSchema only if there are marks (formatting)
    const contentSchemaValue = hasMarks
      ? JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: textNodes }],
        })
      : null

    const existingParagraph = existingById.get(paragraphId)

    if (existingParagraph) {
      // Check if content changed
      const textChanged = existingParagraph.body !== plainText
      const attrsChanged =
        (node.attrs.extra || null) !== (existingParagraph.extra || null) ||
        (node.attrs.extraLoading === 'true') !== (existingParagraph.extraLoading || false)
      const schemaChanged = existingParagraph.contentSchema !== contentSchemaValue

      if (textChanged || attrsChanged || schemaChanged) {
        changedIds.push(paragraphId)
      }

      paragraphs.push({
        ...existingParagraph,
        body: plainText,
        contentSchema: contentSchemaValue,
        extra: (node.attrs.extra as string) || existingParagraph.extra,
        extraLoading: node.attrs.extraLoading === 'true' || existingParagraph.extraLoading,
      })
    } else {
      // New paragraph
      changedIds.push(paragraphId)
      paragraphs.push({
        id: paragraphId,
        body: plainText,
        contentSchema: contentSchemaValue,
        state: 'draft',
        comments: [],
        extra: (node.attrs.extra as string) || undefined,
        extraLoading: node.attrs.extraLoading === 'true' || undefined,
      })
    }
  })

  return { paragraphs, changedIds }
}

/**
 * Get paragraph ID at a given document position
 */
export function getParagraphIdAtPos(doc: Node, pos: number): string | null {
  const resolved = doc.resolve(pos)

  // Walk up the tree to find a paragraph with an ID
  for (let depth = resolved.depth; depth >= 0; depth--) {
    const node = resolved.node(depth)
    if (node.type.name === 'paragraph' && node.attrs.id) {
      return node.attrs.id as string
    }
  }

  return null
}

/**
 * Get the document position range for a paragraph by ID
 */
export function getParagraphRange(doc: Node, paragraphId: string): { from: number; to: number } | null {
  let result: { from: number; to: number } | null = null

  doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph' && node.attrs.id === paragraphId) {
      result = { from: pos, to: pos + node.nodeSize }
      return false // Stop iteration
    }
    return true
  })

  return result
}
