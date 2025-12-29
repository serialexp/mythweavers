import { BsCodeSlash, BsExclamationTriangle } from 'solid-icons/bs'
import { For, Show, createMemo } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { createDisplayMessagesMemo } from '../utils/messageFiltering'
import { InsertControls } from './InsertControls'
import { Message } from './Message'
import { NodeHeader } from './NodeHeader'
import * as viewStyles from './ViewStyles.css'

interface ScriptModeViewProps {
  isGenerating: boolean
}

export function ScriptModeView(props: ScriptModeViewProps) {
  // Get the filtered messages to display
  const displayMessages = createDisplayMessagesMemo()

  // Get the currently selected node
  const selectedNode = createMemo(() => {
    const node = nodeStore.getSelectedNode()
    if (node && node.type === 'scene') {
      return node
    }
    return null
  })

  // Filter messages that have scripts
  const scriptMessages = createMemo(() => {
    return displayMessages().filter((msg) => msg.script && msg.script.trim() !== '')
  })

  const hasSceneNode = createMemo(() => nodeStore.nodesArray.some((n) => n.type === 'scene'))
  const isSceneSelected = createMemo(() => selectedNode() !== null)

  return (
    <>
      {/* Show the node header at the top if a node is selected */}
      <Show when={selectedNode()}>{(node) => <NodeHeader node={node()} messageCount={scriptMessages().length} />}</Show>

      {/* Show warning if no scene is selected but scenes exist */}
      <Show when={!isSceneSelected() && hasSceneNode()}>
        <div class={viewStyles.infoMessage}>
          <BsExclamationTriangle class={viewStyles.warningIcon} />
          <div>
            <h3 class={viewStyles.infoMessageTitle}>No Scene Selected</h3>
            <p class={viewStyles.infoMessageText}>Please select a scene from the navigation panel to view script content.</p>
          </div>
        </div>
      </Show>

      {/* Show special message when no scripts exist */}
      <Show when={scriptMessages().length === 0 && isSceneSelected()}>
        <div class={viewStyles.infoMessage}>
          <BsCodeSlash class={viewStyles.primaryIcon} />
          <div>
            <h3 class={viewStyles.infoMessageTitle}>No Messages with Scripts</h3>
            <p class={viewStyles.infoMessageText}>There are no messages with scripts in this chapter.</p>
          </div>
        </div>
      </Show>

      {/* Insert controls at the beginning if there are script messages */}
      <Show when={scriptMessages().length > 0 && selectedNode()}>
        <InsertControls afterMessageId={null} nodeId={selectedNode()?.id} />
      </Show>

      {/* Display script messages using the same Message component as normal mode */}
      <For each={scriptMessages()}>
        {(message) => (
          <>
            <div class="message-wrapper">
              <Message
                message={message}
                storyTurnNumber={messagesStore.getStoryTurnNumbers().get(message.id) || 0}
                totalStoryTurns={messagesStore.getTotalStoryTurns()}
                isGenerating={props.isGenerating}
              />
            </div>
            <InsertControls afterMessageId={message.id} nodeId={message.sceneId || selectedNode()?.id} />
          </>
        )}
      </For>
    </>
  )
}
