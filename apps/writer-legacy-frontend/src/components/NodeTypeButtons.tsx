import { findNode, updateAllChildrenNodeType, updateNode } from '../lib/stores/tree'
import { FormField } from './styled/FormField'

interface NodeTypeButtonsProps {
  nodeId: string
}

export const NodeTypeButtons = (props: NodeTypeButtonsProps) => {
  const currentNode = findNode(props.nodeId)
  if (!currentNode) return null

  return (
    <FormField label="Node Type">
      <div class="flex flex-col gap-2">
        <div class="flex gap-2">
          <button
            type="button"
            class={`btn flex-1 ${currentNode.nodeType === 'story' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              updateNode(props.nodeId, { nodeType: 'story' })
            }}
          >
            Story Node
          </button>
          <button
            type="button"
            class={`btn flex-1 ${currentNode.nodeType === 'context' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              updateNode(props.nodeId, { nodeType: 'context' })
            }}
          >
            Context Node
          </button>
          <button
            type="button"
            class={`btn flex-1 ${currentNode.nodeType === 'non-story' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => {
              updateNode(props.nodeId, { nodeType: 'non-story' })
            }}
          >
            Non-story Node
          </button>
        </div>
        <button
          type="button"
          class="btn btn-outline w-full"
          onClick={() => {
            updateAllChildrenNodeType(props.nodeId, currentNode.nodeType)
          }}
        >
          Apply to All Children
        </button>
      </div>
    </FormField>
  )
}
