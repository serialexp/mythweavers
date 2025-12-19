import type { Node } from '@writer/shared'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { updateArc } from '../../../lib/stores/arcs'
import { addNotification } from '../../../lib/stores/notifications'
import { scenesState } from '../../../lib/stores/scenes'
import { findPathToNode, treeState } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import { setHighlightsPreview, setLoadingStates } from '../store'

export const extractArcHighlights = async (node: Node) => {
  setLoadingStates({ [`${node.id}_highlights`]: true })
  try {
    // Get all scenes in this arc
    const allScenes = node.children?.flatMap((chapter) => chapter.children ?? []) ?? []
    if (!allScenes.length) {
      addNotification({
        type: 'error',
        title: 'No Content',
        message: 'This arc has no scenes to analyze.',
      })
      return
    }

    // Get the content of all scenes
    const sceneContents = allScenes
      .map((scene) => {
        const sceneData = scenesState.scenes[scene.id]
        if (!sceneData?.paragraphs.length) return ''

        return sceneData.paragraphs
          .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
          .join('\n\n')
      })
      .filter(Boolean)

    // Get the path to understand context
    const path = findPathToNode(node.id)
    if (!path) return

    const [bookNode] = path
    const book = treeState.structure.find((b) => b.id === bookNode.id)

    const prompt = [
      {
        text: [
          '<story_context>',
          `Book Summary: ${book?.oneliner ?? ''}`,
          `Arc Summary: ${node.oneliner ?? ''}`,
          '</story_context>',
          '<arc_content>',
          ...sceneContents,
          '</arc_content>',
          '<instructions>',
          'Extract key highlights from this arc that might be important for future chapters/scenes. Focus on:',
          '- Character developments or revelations',
          '- Plot points that might have future implications',
          '- Setting details that could be relevant later',
          '- Thematic elements that should be consistent',
          'For each highlight, specify:',
          '- The highlight text',
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
          throw new Error(`Invalid category: ${highlight.category}`)
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
    }

    // Update the arc with the new highlights
    updateArc(node.id, {
      highlights,
    })

    // Show the preview
    setHighlightsPreview({
      id: node.id,
      title: node.name,
      summary: node.oneliner || '',
      highlights,
      modifiedAt: Date.now(),
    })

    addNotification({
      type: 'success',
      title: 'Highlights Extracted',
      message: `Found ${highlights.length} key elements in this arc.`,
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to extract highlights',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [`${node.id}_highlights`]: false })
  }
}
