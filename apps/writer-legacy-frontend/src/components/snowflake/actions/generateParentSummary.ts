import type { Node } from '@writer/shared'
import { addNotification } from '../../../lib/stores/notifications'
import { updateNode } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates, setRefinementPreview } from '../store'
import { determineRefinementLevel } from './determineRefinementLevel'

export const generateParentSummary = async (node: Node) => {
  setLoadingStates({ [`${node.id}_summary`]: true })
  try {
    if (!node.children?.length) return

    // Check if all children have oneliners
    const allChildrenHaveOneliners = node.children.every((child) => child.oneliner)
    if (!allChildrenHaveOneliners) {
      addNotification({
        type: 'error',
        title: 'Missing summaries',
        message: `All child elements must have a one-line summary first: ${node.children
          .filter((c) => !c.oneliner)
          .map((c) => c.name)
          .join(', ')} missing summaries.`,
      })
      return
    }

    // Get the current refinement level based on history and text length
    const currentLevel = determineRefinementLevel(node)

    const childSummaries = node.children.map((child) => child.oneliner).join('\n')

    const prompt = [
      {
        text: [
          '<child_summaries>',
          childSummaries,
          '</child_summaries>',
          '<current_level>',
          `Level ${currentLevel} summary requested:`,
          currentLevel === 1
            ? 'Generate a single, powerful sentence that captures the core content of all child elements.'
            : currentLevel === 2
              ? 'Generate a paragraph (4-5 sentences) that covers all child elements and their relationships.'
              : 'Generate a detailed synopsis (2-3 paragraphs) that thoroughly explores all child elements, their connections, and overall narrative flow.',
          '</current_level>',
        ].join('\n'),
        canCache: true,
      },
    ]

    const summary = await useAi('snowflake_parent', prompt)

    // Show the refinement preview
    setRefinementPreview({
      original: node.oneliner ?? '',
      refined: summary,
      level: currentLevel,
      onAccept: () => {
        // Add current oneliner to history if it exists
        if (node.oneliner) {
          updateNode(node.id, {
            summaries: [
              ...(node.summaries ?? []),
              {
                level: currentLevel,
                text: node.oneliner,
                timestamp: Date.now(),
              },
            ],
          })
        }

        // Update the oneliner
        updateNode(node.id, { oneliner: summary })

        addNotification({
          type: 'success',
          title: 'Summary Generated',
          message: 'Summary has been updated.',
        })

        setRefinementPreview(null)
      },
      onReject: () => {
        setRefinementPreview(null)
      },
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to generate summary',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [`${node.id}_summary`]: false })
  }
}
