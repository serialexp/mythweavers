import type { Node } from '@writer/shared'
import { updateArc } from '../../lib/stores/arcs'
import { updateBookValue } from '../../lib/stores/books'
import { updateChapter } from '../../lib/stores/chapters'
import { updateSceneData } from '../../lib/stores/scenes'
import { updateNode } from '../../lib/stores/tree'
import { AutoResizeTextarea } from '../AutoResizeTextarea'

export const SnowflakeInput = (props: { node: Node }) => {
  const placeholder = () => {
    switch (props.node.type) {
      case 'book':
        return 'Enter one-line book summary...'
      case 'arc':
        return 'Describe this story arc in 2-3 sentences...'
      case 'chapter':
        return 'Enter one-line chapter summary...'
      case 'scene':
        return 'Enter one-line scene summary...'
      default:
        return 'Enter one-line summary...'
    }
  }

  return (
    <AutoResizeTextarea
      class="textarea textarea-bordered w-full"
      value={props.node.oneliner ?? ''}
      placeholder={placeholder()}
      onInput={(e) => {
        if (e.currentTarget instanceof HTMLTextAreaElement) {
          if (props.node.type === 'scene') {
            // Update both oneliner and scene summary
            updateNode(props.node.id, {
              oneliner: e.currentTarget.value,
            })
            updateSceneData(props.node.id, {
              summary: e.currentTarget.value,
            })
          } else if (props.node.type === 'chapter') {
            updateNode(props.node.id, {
              oneliner: e.currentTarget.value,
            })
            updateChapter(props.node.id, {
              summary: e.currentTarget.value,
            })
          } else if (props.node.type === 'arc') {
            updateNode(props.node.id, {
              oneliner: e.currentTarget.value,
            })
            updateArc(props.node.id, {
              summary: e.currentTarget.value,
            })
          } else if (props.node.type === 'book') {
            updateNode(props.node.id, {
              oneliner: e.currentTarget.value,
            })
            updateBookValue(props.node.id, 'summary', e.currentTarget.value)
          }
        }
      }}
    />
  )
}
