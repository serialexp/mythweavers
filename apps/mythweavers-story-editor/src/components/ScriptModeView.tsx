import { Button, Card, CardBody, Stack } from '@mythweavers/ui'
import { BsCodeSlash, BsExclamationTriangle, BsPencil } from 'solid-icons/bs'
import { For, Show, createMemo, createSignal } from 'solid-js'
import { nodeStore } from '../stores/nodeStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import { Message as MessageType } from '../types/core'
import { createDisplayMessagesMemo } from '../utils/messageFiltering'
import { InsertControls } from './InsertControls'
import { MessageScriptModal } from './MessageScriptModal'
import { NodeHeader } from './NodeHeader'
import { ScriptDataDiff } from './ScriptDataDiff'
import * as styles from './ScriptModeView.css'
import * as viewStyles from './ViewStyles.css'

interface ScriptModeViewProps {
  isGenerating: boolean
}

export function ScriptModeView(_props: ScriptModeViewProps) {
  // Get the filtered messages to display
  const displayMessages = createDisplayMessagesMemo()

  // State for script modal
  const [editingMessage, setEditingMessage] = createSignal<MessageType | null>(null)

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

      {/* Display script messages */}
      <For each={scriptMessages()}>
        {(message) => (
          <>
            <Card class={styles.scriptCard}>
              <CardBody>
                <Stack gap="md">
                  {/* Header with summary and edit button */}
                  <div class={styles.scriptHeader}>
                    <div class={styles.summaryPreview}>
                      {message.summary ||
                        message.paragraphSummary ||
                        message.content.slice(0, 200) + (message.content.length > 200 ? '...' : '')}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingMessage(message)}
                      title="Edit script"
                    >
                      <BsPencil /> Edit Script
                    </Button>
                  </div>

                  {/* Show script code */}
                  <Show when={message.script}>
                    <div>
                      <div class={styles.codeHeading}>
                        Script Code:
                      </div>
                      <pre class={styles.codeBlock}>
                        <code class={styles.codeContent}>
                          {message
                            .script!.split('\n')
                            .filter((line) => {
                              const trimmedLine = line.trim()
                              return trimmedLine && !trimmedLine.startsWith('//')
                            })
                            .join('\n')}
                        </code>
                      </pre>
                    </div>
                  </Show>

                  {/* Show script data changes */}
                  <Show when={scriptDataStore.getDataStateForMessage(message.id)}>
                    {(dataState) => (
                      <div class={styles.dataStateDivider}>
                        <ScriptDataDiff before={dataState().before} after={dataState().after} messageId={message.id} />
                      </div>
                    )}
                  </Show>
                </Stack>
              </CardBody>
            </Card>
            <InsertControls afterMessageId={message.id} nodeId={message.nodeId || selectedNode()?.id} />
          </>
        )}
      </For>

      {/* Script Edit Modal */}
      <Show when={editingMessage()}>
        {(message) => <MessageScriptModal message={message()} onClose={() => setEditingMessage(null)} />}
      </Show>
    </>
  )
}
