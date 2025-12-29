import { Alert, Button, Card, CardBody, Grid, Modal, Stack, Tab, TabList, TabPanel, Tabs } from '@mythweavers/ui'
import { Component, For, Show, createMemo, createSignal } from 'solid-js'
import { calendarStore } from '../stores/calendarStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { plotPointsStore } from '../stores/plotPointsStore'
import { Message } from '../types/core'
import { getAllNodesUpToNode, getMessagesInStoryOrder } from '../utils/nodeTraversal'
import { executeScript, executeScriptsUpToMessage } from '../utils/scriptEngine'
import { CodeEditor } from './CodeEditor'
import * as styles from './MessageScriptModal.css'

interface MessageScriptModalProps {
  message: Message
  onClose: () => void
}

// Plot Points Override Editor for a specific message
function PlotPointsOverrideEditor(props: { messageId: string }) {
  const [editingKey, setEditingKey] = createSignal<string | null>(null)
  const [editValue, setEditValue] = createSignal('')

  // Get messages in story order up to this message
  const messagesInOrder = createMemo(() => {
    return getMessagesInStoryOrder(messagesStore.messages, nodeStore.nodesArray, props.messageId)
  })

  // Get message IDs in order (up to and including this message)
  const messageIdsInOrder = createMemo(() => {
    const msgs = messagesInOrder()
    const idx = msgs.findIndex((m) => m.id === props.messageId)
    return msgs.slice(0, idx + 1).map((m) => m.id)
  })

  // Get accumulated values at this message
  const accumulatedValues = createMemo(() => {
    return plotPointsStore.getAccumulatedValues(messageIdsInOrder(), props.messageId)
  })

  const startEdit = (key: string) => {
    const currentValue = accumulatedValues()[key]
    setEditingKey(key)
    setEditValue(String(currentValue ?? ''))
  }

  const saveEdit = (key: string) => {
    plotPointsStore.setStateAtMessage(props.messageId, key, editValue())
    setEditingKey(null)
  }

  const cancelEdit = () => {
    setEditingKey(null)
  }

  const clearOverride = (key: string) => {
    plotPointsStore.removeStateAtMessage(props.messageId, key)
  }

  // For enum types, directly set the value without entering edit mode
  const handleEnumChange = (key: string, value: string) => {
    plotPointsStore.setStateAtMessage(props.messageId, key, value)
  }

  // For boolean types, toggle the value
  const handleBooleanChange = (key: string, value: boolean) => {
    plotPointsStore.setStateAtMessage(props.messageId, key, String(value))
  }

  return (
    <Stack gap="md">
      <p class={styles.plotPointsDescription}>
        Override plot point values at this message. Changes will affect all subsequent messages. Values in{' '}
        <span class={styles.plotPointsHint}>blue</span> are set at this message.
      </p>

      <Show
        when={plotPointsStore.definitions.length > 0}
        fallback={<p class={styles.emptyState}>No plot points defined. Add them in the Global Script editor.</p>}
      >
        <div class={styles.plotPointsList}>
          <For each={plotPointsStore.definitions}>
            {(def) => {
              const isSetHere = () => plotPointsStore.isStateSetAtMessage(props.messageId, def.key)
              const currentValue = () => accumulatedValues()[def.key]

              return (
                <div
                  class={isSetHere() ? styles.plotPointRowActive : styles.plotPointRow}
                  style={{ 'flex-wrap': def.type === 'enum' ? 'wrap' : undefined }}
                >
                  <code class={styles.plotPointKey}>{def.key}</code>
                  <span class={styles.plotPointType}>{def.type}</span>

                  {/* Enum type: show radio buttons directly */}
                  <Show when={def.type === 'enum' && def.options}>
                    <div class={styles.radioGroup}>
                      <For each={def.options}>
                        {(option) => (
                          <label
                            class={currentValue() === option ? styles.radioLabelSelected : styles.radioLabel}
                            onClick={() => handleEnumChange(def.key, option)}
                          >
                            <input type="radio" name={`enum-${def.key}`} class={styles.radioInput} checked={currentValue() === option} />
                            {option}
                          </label>
                        )}
                      </For>
                    </div>
                    <Show when={isSetHere()}>
                      <Button variant="ghost" size="sm" onClick={() => clearOverride(def.key)}>
                        Clear
                      </Button>
                    </Show>
                  </Show>

                  {/* Boolean type: show toggle buttons */}
                  <Show when={def.type === 'boolean'}>
                    <div class={styles.toggleContainer}>
                      <button
                        type="button"
                        class={currentValue() === true || currentValue() === 'true' ? styles.toggleButtonSelected : styles.toggleButton}
                        onClick={() => handleBooleanChange(def.key, true)}
                      >
                        true
                      </button>
                      <button
                        type="button"
                        class={currentValue() === false || currentValue() === 'false' ? styles.toggleButtonSelected : styles.toggleButton}
                        onClick={() => handleBooleanChange(def.key, false)}
                      >
                        false
                      </button>
                    </div>
                    <Show when={isSetHere()}>
                      <Button variant="ghost" size="sm" onClick={() => clearOverride(def.key)}>
                        Clear
                      </Button>
                    </Show>
                  </Show>

                  {/* String/Number types: show edit mode */}
                  <Show when={def.type !== 'enum' && def.type !== 'boolean'}>
                    <Show
                      when={editingKey() === def.key}
                      fallback={
                        <>
                          <span class={isSetHere() ? styles.plotPointValueActive : styles.plotPointValue}>
                            = {JSON.stringify(currentValue())}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => startEdit(def.key)}>
                            {isSetHere() ? 'Edit' : 'Override'}
                          </Button>
                          <Show when={isSetHere()}>
                            <Button variant="ghost" size="sm" onClick={() => clearOverride(def.key)}>
                              Clear
                            </Button>
                          </Show>
                        </>
                      }
                    >
                      <input
                        type={def.type === 'number' ? 'number' : 'text'}
                        value={editValue()}
                        onInput={(e) => setEditValue(e.currentTarget.value)}
                        class={styles.input}
                      />
                      <Button variant="primary" size="sm" onClick={() => saveEdit(def.key)}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </Show>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </Stack>
  )
}

const DEFAULT_MESSAGE_SCRIPT = `(data, functions) => {
  // Modify data based on this story turn
  // Data is immutable - write normal mutation code but original data is preserved!
  // Functions from global script are available in the 'functions' object

  // Example: Use functions from global script
  // With Immer, you can just call functions without reassigning!
  // functions.advanceTime(data, 7); // Advance time by a week
  // functions.updateAges(data); // Update all character ages
  // functions.addEvent(data, 'Battle of Yavin', { importance: 'high' });

  // Example: Check values without modifying
  // const daysPassed = functions.getDaysSinceStart(data);
  // if (functions.hasCharacter(data, 'Luke')) {
  //   console.log('Luke is in the story!');
  // }

  // Example: Direct data mutation (Immer makes it safe!)
  // data.locationName = 'Death Star';
  // data.tension = (data.tension || 0) + 10;

  // Example: Complex mutations are easy
  // if (!data.inventory) data.inventory = {};
  // data.inventory.lightsaber = { color: 'blue', owner: 'Luke' };

  // Increment turn counter
  // data.turnNumber = (data.turnNumber || 0) + 1;

  // No need to return data unless you're replacing the whole object
  // Immer will handle all the mutations you made above
}`

export const MessageScriptModal: Component<MessageScriptModalProps> = (props) => {
  const [scriptContent, setScriptContent] = createSignal(props.message.script || DEFAULT_MESSAGE_SCRIPT)
  const [error, setError] = createSignal<string | null>(null)
  const [previewData, setPreviewData] = createSignal<any>(null)
  const [showPreview, setShowPreview] = createSignal(false)
  const [activeTab, setActiveTab] = createSignal('script')

  const validateScript = (script: string): boolean => {
    if (!script.trim()) {
      setError(null)
      return true
    }

    try {
      // Try to evaluate the script as a function
      const scriptFunction = eval(`(${script})`)
      if (typeof scriptFunction !== 'function') {
        setError('Script must be a function that takes data and returns data')
        return false
      }
      setError(null)
      return true
    } catch (e) {
      setError(`Invalid JavaScript: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return false
    }
  }

  const handlePreview = () => {
    // Toggle preview if already showing
    if (showPreview()) {
      setShowPreview(false)
      return
    }

    if (!validateScript(scriptContent())) return

    try {
      // Get data state before this message's script executes
      // This means: execute all scripts up to (but not including) this message
      // But we DO want the chapter's storyTime to be set if we've entered a new chapter
      // So we pass this message's ID to executeScriptsUpToMessage, which will:
      // 1. Process all previous messages
      // 2. Detect we've entered this message's chapter and set currentTime
      // 3. Update character/context states for this message
      // 4. But NOT execute this message's script (we'll do that separately)

      // Execute scripts up to but not including this message
      const allMessagesInOrder = getMessagesInStoryOrder(messagesStore.messages, nodeStore.nodesArray, props.message.id)

      // Find the index of the current message
      const currentIndex = allMessagesInOrder.findIndex((m) => m.id === props.message.id)

      // Get data state before this message by executing up to the previous message
      // Then manually update currentTime if we're in a new chapter
      let dataBefore: any = {}
      if (currentIndex > 0) {
        const previousMessageId = allMessagesInOrder[currentIndex - 1].id
        const previousMessage = allMessagesInOrder[currentIndex - 1]

        console.log('[MessageScriptModal] Executing scripts up to previous message', {
          currentMessageId: props.message.id.substring(0, 8),
          currentNodeId: props.message.sceneId?.substring(0, 8),
          previousMessageId: previousMessageId.substring(0, 8),
          previousNodeId: previousMessage.sceneId?.substring(0, 8),
        })

        dataBefore = executeScriptsUpToMessage(
          messagesStore.messages,
          previousMessageId,
          nodeStore.nodesArray,
          currentStoryStore.globalScript,
        )

        console.log('[MessageScriptModal] Data before after executeScriptsUpToMessage', {
          currentTime: dataBefore.currentTime,
          hasGlobalScript: !!currentStoryStore.globalScript,
        })

        // If this message is in a different chapter than the previous one,
        // we need to update currentTime to reflect the new chapter's storyTime
        if (props.message.sceneId && previousMessage.sceneId !== props.message.sceneId) {
          const currentNode = nodeStore.nodesArray.find((n) => n.id === props.message.sceneId)
          console.log('[MessageScriptModal] Detected node change', {
            currentNodeId: props.message.sceneId.substring(0, 8),
            currentNodeStoryTime: currentNode?.storyTime,
            currentNodeTitle: currentNode?.title,
          })

          if (currentNode?.storyTime != null) {
            dataBefore = {
              ...dataBefore,
              currentTime: currentNode.storyTime,
              currentDate: calendarStore.formatStoryTime(currentNode.storyTime) || '',
            }
            console.log('[MessageScriptModal] Set currentTime from node storyTime:', currentNode.storyTime)
          } else {
            // Node doesn't have storyTime - reset to last chapter's base time
            // Find the last node before the current one that has a storyTime set
            const allNodesUpToCurrent = getAllNodesUpToNode(nodeStore.nodesArray, props.message.sceneId)
            console.log(
              '[MessageScriptModal] Nodes up to current:',
              allNodesUpToCurrent.map((n) => ({
                id: n.id.substring(0, 8),
                title: n.title,
                storyTime: n.storyTime,
              })),
            )

            let lastChapterBaseTime = 0
            for (const node of allNodesUpToCurrent) {
              if (node.storyTime != null) {
                lastChapterBaseTime = node.storyTime
              }
            }
            dataBefore = {
              ...dataBefore,
              currentTime: lastChapterBaseTime,
              currentDate: calendarStore.formatStoryTime(lastChapterBaseTime) || '',
            }
            console.log('[MessageScriptModal] Set currentTime from lastChapterBaseTime:', lastChapterBaseTime)
          }
        }
      } else if (currentStoryStore.globalScript) {
        // First message - execute global script and set up initial state
        const globalResult = executeScript(currentStoryStore.globalScript, {}, {}, true)
        dataBefore = globalResult.data

        // Set currentTime from this message's chapter
        if (props.message.sceneId) {
          const currentNode = nodeStore.nodesArray.find((n) => n.id === props.message.sceneId)
          if (currentNode?.storyTime != null) {
            dataBefore = {
              ...dataBefore,
              currentTime: currentNode.storyTime,
              currentDate: calendarStore.formatStoryTime(currentNode.storyTime) || '',
            }
          } else if (dataBefore.currentTime == null) {
            dataBefore = {
              ...dataBefore,
              currentTime: 0,
              currentDate: calendarStore.formatStoryTime(0) || '',
            }
          }
        }
      }

      // Create a deep copy of the data to preserve the "before" state
      const dataAfter = JSON.parse(JSON.stringify(dataBefore))

      // Get functions from global script if it exists
      let functions = {}
      if (currentStoryStore.globalScript) {
        const globalResult = executeScript(currentStoryStore.globalScript, {}, {}, true)
        functions = globalResult.functions || {}
      }

      // Execute this message's script on the copy with the functions
      let result = dataAfter
      if (scriptContent().trim()) {
        const scriptResult = executeScript(scriptContent(), dataAfter, functions, false)
        result = scriptResult.data
      }

      setPreviewData({ before: dataBefore, after: result })
      setShowPreview(true)
    } catch (e) {
      setError(`Error executing script: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  const handleSave = () => {
    if (validateScript(scriptContent())) {
      messagesStore.updateMessage(props.message.id, {
        script: scriptContent().trim() || undefined,
      })
      props.onClose()
    }
  }

  return (
    <Modal open={true} onClose={props.onClose} title="Turn Script & Plot Points" size="xl">
      <div class={styles.modalContent}>
        <Tabs activeTab={activeTab()} onTabChange={setActiveTab}>
          <TabList>
            <Tab id="script">Script</Tab>
            <Tab id="plot-points">Plot Points</Tab>
          </TabList>

          <TabPanel id="script">
            <div class={styles.tabPanelContent}>
              <p class={styles.description}>
                This script runs when generating context for this turn. It receives the data object after all previous
                scripts have run, and should return the modified data object.
              </p>

              <CodeEditor
                value={scriptContent()}
                onChange={(value) => {
                  setScriptContent(value)
                  validateScript(value)
                  setShowPreview(false)
                }}
                error={error()}
                height="350px"
              />

              <Show when={error()}>
                <Alert variant="error" style={{ 'margin-top': '0.5rem' }}>
                  {error()}
                </Alert>
              </Show>

              <Stack gap="md" style={{ 'margin-top': '1rem' }}>
                <Button variant="secondary" onClick={handlePreview} disabled={!!error()}>
                  {showPreview() ? 'Hide Preview' : 'Preview Data State'}
                </Button>

                <Show when={showPreview() && previewData()}>
                  <Grid cols={2} gap="md" style={{ 'margin-top': '1rem' }}>
                    <Card variant="flat">
                      <CardBody>
                        <h4 class={styles.previewHeader}>Data Before This Turn</h4>
                        <pre class={styles.previewContent}>{JSON.stringify(previewData().before, null, 2)}</pre>
                      </CardBody>
                    </Card>
                    <Card variant="flat">
                      <CardBody>
                        <h4 class={styles.previewHeader}>Data After This Turn</h4>
                        <pre class={styles.previewContent}>{JSON.stringify(previewData().after, null, 2)}</pre>
                      </CardBody>
                    </Card>
                  </Grid>
                </Show>
              </Stack>
            </div>
          </TabPanel>

          <TabPanel id="plot-points">
            <div class={styles.tabPanelContent}>
              <PlotPointsOverrideEditor messageId={props.message.id} />
            </div>
          </TabPanel>
        </Tabs>
      </div>

      <div class={styles.footer}>
        <Button variant="ghost" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  )
}
