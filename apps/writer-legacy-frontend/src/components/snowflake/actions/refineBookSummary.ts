import { Node } from '@writer/shared'
import { addNotification } from '../../../lib/stores/notifications'
import { findPathToNode, treeState } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import type { RefinementLevel } from '../constants'
import { setBookRefinements, setLoadingStates } from '../store'

export const refineBookSummary = async (node: Node, targetLevel: RefinementLevel) => {
  setLoadingStates({ [`${node.id}_refine`]: true })

  try {
    const path = findPathToNode(node.id)
    if (!path) return

    const promptParts: string[] = []

    // Add context based on node type
    switch (node.type) {
      case 'book': {
        const [bookNode] = path
        const bookIndex = treeState.structure.findIndex((b) => b.id === bookNode.id)
        const previousBook = bookIndex > 0 ? treeState.structure[bookIndex - 1] : null

        if (previousBook?.oneliner) {
          promptParts.push(`<previous_book_summary>${previousBook.oneliner}</previous_book_summary>`)
        }
        break
      }
      case 'arc': {
        const [bookNode] = path
        promptParts.push(`<book_context>${bookNode.oneliner}</book_context>`)
        break
      }
      case 'chapter': {
        const [bookNode, arcNode] = path
        promptParts.push(
          `<book_context>${bookNode.oneliner}</book_context>`,
          `<arc_context>${arcNode.oneliner}</arc_context>`,
        )
        break
      }
      case 'scene': {
        const [bookNode, arcNode, chapterNode] = path
        const scenes = chapterNode.children ?? []
        const sceneIndex = scenes.findIndex((s) => s.id === node.id)
        const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null
        const nextScene = sceneIndex < scenes.length - 1 ? scenes[sceneIndex + 1] : null

        promptParts.push(
          `<book_context>${bookNode.oneliner}</book_context>`,
          `<arc_context>${arcNode.oneliner}</arc_context>`,
          `<chapter_context>${chapterNode.oneliner}</chapter_context>`,
        )

        if (previousScene?.oneliner) {
          promptParts.push(`<previous_scene>${previousScene.oneliner}</previous_scene>`)
        }
        if (nextScene?.oneliner) {
          promptParts.push(`<next_scene>${nextScene.oneliner}</next_scene>`)
        }
        break
      }
    }

    promptParts.push(
      `<current_summary>${node.oneliner ?? ''}</current_summary>`,
      `<target_level>${targetLevel}</target_level>`,
    )

    const aiAction = `snowflake_refine_${node.type}` as const
    const refinedSummary = await useAi(aiAction, promptParts.join('\n'))

    setBookRefinements({
      [node.id]: {
        text: refinedSummary,
        level: targetLevel,
      },
    })
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to refine summary',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [`${node.id}_refine`]: false })
  }
}
