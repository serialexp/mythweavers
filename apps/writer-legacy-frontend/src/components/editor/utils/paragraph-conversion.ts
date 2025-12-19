import type { ContentNode, SceneParagraph } from '@writer/shared'
import type { Node } from 'prosemirror-model'
import shortUUID from 'short-uuid'
import { contentSchema } from '../schema'

/**
 * Convert an array of SceneParagraphs to a single ProseMirror document
 */
export function sceneParagraphsToDoc(paragraphs: SceneParagraph[]): Node {
  // Handle empty paragraphs array
  if (!paragraphs || paragraphs.length === 0) {
    return contentSchema.node('doc', null, [contentSchema.node('paragraph', { id: shortUUID.generate() }, [])])
  }

  const paragraphNodes = paragraphs
    .map((sceneParagraph) => {
      try {
        if (typeof sceneParagraph.text === 'string') {
          // Convert string to paragraph node
          const textContent = sceneParagraph.text.trim()
          return contentSchema.node(
            'paragraph',
            {
              id: sceneParagraph.id || shortUUID.generate(),
              extra: sceneParagraph.extra || null,
              extraLoading: sceneParagraph.extraLoading ? 'true' : null,
            },
            textContent ? [contentSchema.text(textContent)] : [],
          )
        }
        // Convert ContentNode to paragraph node
        const contentNode = sceneParagraph.text as ContentNode
        try {
          // Use nodeFromJSON to parse the ContentNode, then extract the first paragraph
          const fullDoc = contentSchema.nodeFromJSON(contentNode)
          if (fullDoc.content.childCount > 0) {
            const firstParagraph = fullDoc.content.child(0)
            // Clone the paragraph but with our ID and suggestion data
            return contentSchema.node(
              'paragraph',
              {
                id: sceneParagraph.id || shortUUID.generate(),
                extra: sceneParagraph.extra || null,
                extraLoading: sceneParagraph.extraLoading ? 'true' : null,
              },
              firstParagraph.content,
            )
          }
          // Empty document, create empty paragraph
          return contentSchema.node(
            'paragraph',
            {
              id: sceneParagraph.id || shortUUID.generate(),
              extra: sceneParagraph.extra || null,
              extraLoading: sceneParagraph.extraLoading ? 'true' : null,
            },
            [],
          )
        } catch (error) {
          console.warn('Failed to parse ContentNode, creating empty paragraph:', error)
          return contentSchema.node(
            'paragraph',
            {
              id: sceneParagraph.id || shortUUID.generate(),
              extra: sceneParagraph.extra || null,
              extraLoading: sceneParagraph.extraLoading ? 'true' : null,
            },
            [],
          )
        }
      } catch (error) {
        console.warn('Failed to create paragraph node for:', sceneParagraph, error)
        return contentSchema.node(
          'paragraph',
          {
            id: sceneParagraph.id || shortUUID.generate(),
            extra: sceneParagraph.extra || null,
            extraLoading: sceneParagraph.extraLoading ? 'true' : null,
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
 * Convert a ProseMirror document back to SceneParagraphs
 * Preserves existing paragraph metadata and only updates text content
 */
export function docToSceneParagraphs(
  doc: Node,
  existingParagraphs: SceneParagraph[],
): {
  paragraphs: SceneParagraph[]
  changedIds: string[]
} {
  const changedIds: string[] = []
  const existingById = new Map(existingParagraphs.map((p) => [p.id, p]))
  const processedIds = new Set<string>()

  const paragraphs: SceneParagraph[] = []

  doc.content.forEach((node, _offset, _index) => {
    if (node.type.name !== 'paragraph') return

    const paragraphId = node.attrs.id || shortUUID.generate()
    processedIds.add(paragraphId)

    // Convert to text first for simpler handling
    const nodeText = node.textContent

    // Convert node content to ContentNode format
    const textNodes: any[] = []
    node.content.forEach((child: any) => {
      if (child.type.name === 'text') {
        const textNode: any = {
          type: 'text',
          text: child.text || '',
        }
        if (child.marks && child.marks.length > 0) {
          textNode.marks = child.marks.map((mark: any) => ({
            type: mark.type.name,
            attrs: mark.attrs,
          }))
        }
        textNodes.push(textNode)
      }
    })

    const contentNode: ContentNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: textNodes,
        },
      ],
    }

    const existingParagraph = existingById.get(paragraphId)

    if (existingParagraph) {
      // Check if content actually changed by comparing text content
      const existingText =
        typeof existingParagraph.text === 'string' ? existingParagraph.text : contentNodeToText(existingParagraph.text)
      const newText = nodeText

      // More robust change detection - consider changes if:
      // 1. Text content differs (including empty to non-empty transitions)
      // 2. Paragraph attributes changed (extra, extraLoading)
      // 3. Formatting changed (marks)
      const textChanged = existingText !== newText
      const attrsChanged =
        (node.attrs.extra || null) !== (existingParagraph.extra || null) ||
        (node.attrs.extraLoading === 'true') !== (existingParagraph.extraLoading || false)

      const existingHasMarks = typeof existingParagraph.text === 'object'
      const newHasMarks = textNodes.some((textNode) => textNode.marks && textNode.marks.length > 0)
      const marksChanged = existingHasMarks !== newHasMarks

      if (textChanged || attrsChanged || marksChanged) {
        changedIds.push(paragraphId)
      }

      // Decide whether to store as string or ContentNode based on complexity
      const hasMarks = textNodes.some((textNode) => textNode.marks && textNode.marks.length > 0)
      const textToStore = hasMarks ? contentNode : nodeText

      paragraphs.push({
        ...existingParagraph,
        text: textToStore,
        extra: node.attrs.extra || existingParagraph.extra,
        extraLoading: node.attrs.extraLoading === 'true' || existingParagraph.extraLoading,
        modifiedAt: textChanged ? Date.now() : existingParagraph.modifiedAt,
      })
    } else {
      // New paragraph - always mark as changed and store appropriately
      const hasMarks = textNodes.some((textNode) => textNode.marks && textNode.marks.length > 0)
      const textToStore = hasMarks ? contentNode : nodeText

      changedIds.push(paragraphId)
      paragraphs.push({
        id: paragraphId,
        text: textToStore,
        state: 'draft',
        comments: [],
        modifiedAt: Date.now(),
        extra: node.attrs.extra || undefined,
        extraLoading: node.attrs.extraLoading === 'true' || undefined,
      })
    }
  })

  return { paragraphs, changedIds }
}

/**
 * Helper to extract plain text from ContentNode
 */
function contentNodeToText(contentNode: ContentNode): string {
  return contentNode.content.map((block) => block.content?.map((textNode) => textNode.text).join('') || '').join('\n')
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
