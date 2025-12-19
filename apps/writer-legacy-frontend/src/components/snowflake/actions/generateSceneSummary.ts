import type { Node } from '@writer/shared'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { charactersState } from '../../../lib/stores/characters'
import { addNotification } from '../../../lib/stores/notifications'
import { scenesState } from '../../../lib/stores/scenes'
import { updateNode } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates, setRefinementPreview } from '../store'
import { determineRefinementLevel } from './determineRefinementLevel'

export const generateSceneSummary = async (node: Node) => {
  setLoadingStates({ [`${node.id}_summary`]: true })
  try {
    const scene = scenesState.scenes[node.id]
    if (!scene?.paragraphs.length) {
      addNotification({
        type: 'error',
        title: 'No Content',
        message: 'Please add some content to the scene first.',
      })
      return
    }

    const content = scene.paragraphs
      .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
      .join('\n\n')

    // Get the current refinement level based on history and text length
    const currentLevel = determineRefinementLevel(node)

    // Build character context
    const characterLines: string[] = []
    if (scene.protagonistId) {
      const protagonist = charactersState.characters[scene.protagonistId]
      if (protagonist) {
        characterLines.push(
          `<perspective>${protagonist.firstName}'s ${scene.perspective ?? 'third'} person perspective - ${protagonist.summary}</perspective>`,
        )
      }
    }
    for (const charId of scene?.characterIds ?? []) {
      const char = charactersState.characters[charId]
      if (!char) continue
      const charText = `${[char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')}: ${char.summary}`
      characterLines.push(`<present_character>${charText}</present_character>`)
    }
    for (const charId of scene?.referredCharacterIds ?? []) {
      const char = charactersState.characters[charId]
      if (!char) continue
      const charText = `${[char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')}: ${char.summary}`
      characterLines.push(`<referred_character>${charText}</referred_character>`)
    }

    const prompt = [
      {
        text: [
          '<scene_setup>',
          characterLines.join('\n'),
          '</scene_setup>',
          '<scene_content>',
          content,
          '</scene_content>',
        ].join('\n'),
        canCache: true,
      },
      {
        text: `<target_level>${currentLevel}</target_level>`,
        canCache: false,
      },
    ]

    const summary = await useAi('snowflake_refine_scene', prompt)

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
          message: 'Scene summary has been updated.',
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
