import type { ContentNode, Paragraph } from '@mythweavers/shared'
import type { Node } from 'prosemirror-model'
import shortUUID from 'short-uuid'
import { contentSchema } from '../schema'

/**
 * Convert an array of Paragraphs to a single ProseMirror document
 *
 * Reads from `contentSchema` (rich text) if available, otherwise uses `body` (plain text)
 */
export function paragraphsToDoc(paragraphs: Paragraph[]): Node {
  // Handle empty paragraphs array
  if (!paragraphs || paragraphs.length === 0) {
    return contentSchema.node('doc', null, [contentSchema.node('paragraph', { id: shortUUID.generate() }, [])])
  }

  const paragraphNodes = paragraphs
    .map((paragraph) => {
      try {
        // Try to use contentSchema (rich text) first
        if (paragraph.contentSchema) {
          try {
            const contentNode = JSON.parse(paragraph.contentSchema) as ContentNode
            const fullDoc = contentSchema.nodeFromJSON(contentNode)
            if (fullDoc.content.childCount > 0) {
              const firstParagraph = fullDoc.content.child(0)
              return contentSchema.node(
                'paragraph',
                {
                  id: paragraph.id || shortUUID.generate(),
                  extra: paragraph.extra || null,
                  extraLoading: paragraph.extraLoading ? 'true' : null,
                },
                firstParagraph.content,
              )
            }
          } catch (error) {
            console.warn('Failed to parse contentSchema, falling back to body:', error)
          }
        }

        // Fall back to body (plain text)
        const textContent = (paragraph.body || '').trim()
        return contentSchema.node(
          'paragraph',
          {
            id: paragraph.id || shortUUID.generate(),
            extra: paragraph.extra || null,
            extraLoading: paragraph.extraLoading ? 'true' : null,
          },
          textContent ? [contentSchema.text(textContent)] : [],
        )
      } catch (error) {
        console.warn('Failed to create paragraph node for:', paragraph, error)
        return contentSchema.node(
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
    return contentSchema.node('doc', null, paragraphNodes)
  } catch (error) {
    console.error('Error creating document:', error)
    console.error('Paragraph nodes:', paragraphNodes)
    console.error('Original paragraphs:', paragraphs)

    // Fallback: create empty document
    return contentSchema.node('doc', null, [contentSchema.node('paragraph', { id: shortUUID.generate() }, [])])
  }
}

/**
 * Convert a ProseMirror document back to Paragraphs
 *
 * Writes to both `body` (plain text) and `contentSchema` (rich text if there are marks)
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

  doc.content.forEach((node) => {
    if (node.type.name !== 'paragraph') return

    const paragraphId = node.attrs.id || shortUUID.generate()

    // Extract plain text
    const plainText = node.textContent

    // Build ContentNode structure
    const textNodes: Array<{ type: 'text'; text: string; marks?: Array<{ type: string; attrs: unknown }> }> = []
    node.content.forEach((child) => {
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
        extra: node.attrs.extra || existingParagraph.extra,
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
        extra: node.attrs.extra || undefined,
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
      return node.attrs.id
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
  })

  return result
}
