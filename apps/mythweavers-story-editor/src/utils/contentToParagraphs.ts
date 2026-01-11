import type { Paragraph } from '@mythweavers/shared'

/**
 * Convert raw text content to Paragraph objects for the editor.
 *
 * This is used when message.paragraphs is empty (e.g., during streaming)
 * but we want to display content in the SceneEditor.
 *
 * Uses index-based IDs prefixed with messageId to ensure stability during streaming.
 * This way, paragraph IDs don't change as content updates, which prevents
 * the editor from recreating its state on every streaming update.
 *
 * @param content - Raw text content (will be split on double newlines)
 * @param messageId - Message ID used as prefix for stable paragraph IDs
 * @returns Array of Paragraph objects suitable for SceneEditor
 */
export function contentToParagraphs(content: string, messageId: string): Paragraph[] {
  if (!content || !content.trim()) {
    return []
  }

  // Split on double newlines (like the backend does)
  const paragraphTexts = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  return paragraphTexts.map((text, index): Paragraph => ({
    // Use message ID + index for stable IDs during streaming
    // This ensures the same paragraph keeps the same ID as content streams in
    id: `${messageId}-p${index}`,
    body: text,
    state: 'ai', // Mark as AI-generated since this is streaming content
    comments: [],
  }))
}
