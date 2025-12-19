import { contentSchemaToText } from '../persistence/content-schema-to-html'
import { addNotification } from '../stores/notifications'
import { scenesState, updateSceneData } from '../stores/scenes'
import { findPathToNode } from '../stores/tree'
import { useAi } from '../use-ai'

/**
 * Extracts key highlights from a scene that might be important for future scenes
 * @param sceneId The ID of the scene to extract highlights from
 * @returns The extracted highlights or null if extraction failed
 */
export const extractSceneHighlights = async (sceneId: string): Promise<{ highlights: any[] } | null> => {
  try {
    // Get the scene data
    const sceneData = scenesState.scenes[sceneId]
    if (!sceneData?.paragraphs.length) {
      addNotification({
        type: 'error',
        title: 'No Content',
        message: 'This scene has no content to analyze.',
      })
      return null
    }

    // Get the scene content
    const sceneContent = sceneData.paragraphs
      .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
      .join('\n\n')

    // Get the path to understand context
    const path = findPathToNode(sceneId)
    if (!path.length) return null

    const [bookNode, arcNode, chapterNode] = path

    const prompt = [
      {
        text: [
          '<story_context>',
          `Book: ${bookNode?.name ?? ''}`,
          `Arc: ${arcNode?.name ?? ''}`,
          `Chapter: ${chapterNode?.name ?? ''}`,
          `Scene: ${sceneData.title ?? ''}`,
          '</story_context>',
          '<scene_content>',
          sceneContent,
          '</scene_content>',
          '<instructions>',
          'Extract key highlights from this scene that might be important for future scenes. Focus on:',
          '- Character developments or revelations',
          '- Plot points that might have future implications',
          '- Setting details that could be relevant later',
          '- Thematic elements that should be consistent',
          'For each highlight, specify:',
          '- The highlight text (keep this brief and focused)',
          '- Its importance/potential future impact',
          '- Its category (character/plot/setting/theme)',
          '</instructions>',
        ].join('\n'),
        canCache: true,
      },
    ]

    const result = await useAi('snowflake_extract_highlights', prompt)

    // Parse the JSON results
    let highlights
    try {
      highlights = JSON.parse(result).map((h: any) => ({
        ...h,
        timestamp: Date.now(),
      }))

      // Validate the structure
      for (const highlight of highlights) {
        if (!highlight.text || !highlight.importance || !highlight.category) {
          throw new Error('Invalid highlight format from AI')
        }
        if (!['character', 'plot', 'setting', 'theme'].includes(highlight.category)) {
          highlight.category = 'plot' // Default to plot if invalid category
        }
      }

      // Update the scene with the new highlights
      updateSceneData(sceneId, {
        highlights,
        lastHighlightsGenerated: Date.now(),
      })

      addNotification({
        type: 'success',
        title: 'Highlights Extracted',
        message: `Found ${highlights.length} key elements in this scene.`,
      })

      return { highlights }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addNotification({
        type: 'error',
        title: 'Failed to parse AI response',
        message: errorMessage,
      })
      console.error('Failed to parse AI response:', error)
      return null
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addNotification({
      type: 'error',
      title: 'Failed to extract highlights',
      message: errorMessage,
    })
    console.error('Failed to extract highlights:', error)
    return null
  }
}

/**
 * Checks if a scene's highlights need to be regenerated due to content changes
 * @param sceneId The ID of the scene to check
 * @returns True if highlights need regeneration
 */
export const needsHighlightsRegeneration = (sceneId: string): boolean => {
  const scene = scenesState.scenes[sceneId]
  if (!scene) return true

  // If no highlights exist or lastHighlightsGenerated is missing, regenerate
  if (!scene.highlights || !scene.lastHighlightsGenerated) {
    return true
  }

  // Get the latest modification time of any paragraph
  const latestParagraphModification = scene.paragraphs.reduce((latest, p) => {
    const paragraphTimestamp = p.modifiedAt
      ? typeof p.modifiedAt === 'string'
        ? Number.parseInt(p.modifiedAt)
        : p.modifiedAt
      : 0
    return Math.max(latest, paragraphTimestamp)
  }, 0)

  // If paragraphs were modified after highlights were generated, regenerate
  return latestParagraphModification > scene.lastHighlightsGenerated
}
