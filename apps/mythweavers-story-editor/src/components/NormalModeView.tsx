import { BsExclamationTriangle } from 'solid-icons/bs'
import { For, Show, createMemo } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { uiStore } from '../stores/uiStore'
import { createDisplayMessagesMemo } from '../utils/messageFiltering'
import { InsertControls } from './InsertControls'
import { Message } from './Message'
import { NodeHeader } from './NodeHeader'
import { TargetingBanner } from './TargetingBanner'
import * as viewStyles from './ViewStyles.css'

interface NormalModeViewProps {
  isGenerating: boolean
}

export function NormalModeView(props: NormalModeViewProps) {
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

  const hasSceneNode = createMemo(() => nodeStore.nodesArray.some((n) => n.type === 'scene'))
  const isSceneSelected = createMemo(() => selectedNode() !== null)

  return (
    <>
      {/* Show the node header at the top if a node is selected */}
      <Show when={selectedNode()}>
        {(node) => <NodeHeader node={node()} messageCount={displayMessages().length} />}
      </Show>

      {/* Show targeting mode banner when targeting is active */}
      <Show when={uiStore.isTargeting()}>
        <TargetingBanner />
      </Show>

      {/* Show warning if no scene is selected but scenes exist */}
      <Show when={!isSceneSelected() && hasSceneNode()}>
        <div class={viewStyles.infoMessage}>
          <BsExclamationTriangle class={viewStyles.warningIcon} />
          <div>
            <h3 class={viewStyles.infoMessageTitle}>No Scene Selected</h3>
            <p class={viewStyles.infoMessageText}>Please select a scene from the navigation panel to view and generate story content.</p>
          </div>
        </div>
      </Show>

      {/* Insert controls at the beginning of chapter */}
      <Show when={selectedNode()}>
        <InsertControls afterMessageId={null} nodeId={selectedNode()?.id} />
      </Show>

      {/* Show messages for the selected chapter */}
      <For each={displayMessages()}>
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
