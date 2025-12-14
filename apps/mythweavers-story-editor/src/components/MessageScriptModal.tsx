import { createSignal, Show, Component } from 'solid-js'
import { Message } from '../types/core'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { executeScriptsUpToMessage, executeScript } from '../utils/scriptEngine'
import { getMessagesInStoryOrder, getAllNodesUpToNode } from '../utils/nodeTraversal'
import { currentStoryStore } from '../stores/currentStoryStore'
import { CodeEditor } from './CodeEditor'
import styles from './MessageScriptModal.module.css'
import { calendarStore } from '../stores/calendarStore'

interface MessageScriptModalProps {
  message: Message
  onClose: () => void
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
}`;

export const MessageScriptModal: Component<MessageScriptModalProps> = (props) => {
  const [scriptContent, setScriptContent] = createSignal(props.message.script || DEFAULT_MESSAGE_SCRIPT)
  const [error, setError] = createSignal<string | null>(null)
  const [previewData, setPreviewData] = createSignal<any>(null)
  const [showPreview, setShowPreview] = createSignal(false)

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
      const allMessagesInOrder = getMessagesInStoryOrder(
        messagesStore.messages,
        nodeStore.nodesArray,
        props.message.id
      )

      // Find the index of the current message
      const currentIndex = allMessagesInOrder.findIndex(m => m.id === props.message.id)

      // Get data state before this message by executing up to the previous message
      // Then manually update currentTime if we're in a new chapter
      let dataBefore: any = {}
      if (currentIndex > 0) {
        const previousMessageId = allMessagesInOrder[currentIndex - 1].id
        const previousMessage = allMessagesInOrder[currentIndex - 1]

        console.log('[MessageScriptModal] Executing scripts up to previous message', {
          currentMessageId: props.message.id.substring(0, 8),
          currentNodeId: props.message.nodeId?.substring(0, 8),
          previousMessageId: previousMessageId.substring(0, 8),
          previousNodeId: previousMessage.nodeId?.substring(0, 8)
        })

        dataBefore = executeScriptsUpToMessage(
          messagesStore.messages,
          previousMessageId,
          nodeStore.nodesArray,
          currentStoryStore.globalScript
        )

        console.log('[MessageScriptModal] Data before after executeScriptsUpToMessage', {
          currentTime: dataBefore.currentTime,
          hasGlobalScript: !!currentStoryStore.globalScript
        })

        // If this message is in a different chapter than the previous one,
        // we need to update currentTime to reflect the new chapter's storyTime
        if (props.message.nodeId && previousMessage.nodeId !== props.message.nodeId) {
          const currentNode = nodeStore.nodesArray.find(n => n.id === props.message.nodeId)
          console.log('[MessageScriptModal] Detected node change', {
            currentNodeId: props.message.nodeId.substring(0, 8),
            currentNodeStoryTime: currentNode?.storyTime,
            currentNodeTitle: currentNode?.title
          })

          if (currentNode?.storyTime != null) {
            dataBefore = {
              ...dataBefore,
              currentTime: currentNode.storyTime,
              currentDate: calendarStore.formatStoryTime(currentNode.storyTime) || ''
            }
            console.log('[MessageScriptModal] Set currentTime from node storyTime:', currentNode.storyTime)
          } else {
            // Node doesn't have storyTime - reset to last chapter's base time
            // Find the last node before the current one that has a storyTime set
            const allNodesUpToCurrent = getAllNodesUpToNode(nodeStore.nodesArray, props.message.nodeId)
            console.log('[MessageScriptModal] Nodes up to current:', allNodesUpToCurrent.map(n => ({
              id: n.id.substring(0, 8),
              title: n.title,
              storyTime: n.storyTime
            })))

            let lastChapterBaseTime = 0
            for (const node of allNodesUpToCurrent) {
              if (node.storyTime != null) {
                lastChapterBaseTime = node.storyTime
              }
            }
            dataBefore = {
              ...dataBefore,
              currentTime: lastChapterBaseTime,
              currentDate: calendarStore.formatStoryTime(lastChapterBaseTime) || ''
            }
            console.log('[MessageScriptModal] Set currentTime from lastChapterBaseTime:', lastChapterBaseTime)
          }
        }
      } else if (currentStoryStore.globalScript) {
        // First message - execute global script and set up initial state
        const globalResult = executeScript(currentStoryStore.globalScript, {}, {}, true)
        dataBefore = globalResult.data

        // Set currentTime from this message's chapter
        if (props.message.nodeId) {
          const currentNode = nodeStore.nodesArray.find(n => n.id === props.message.nodeId)
          if (currentNode?.storyTime != null) {
            dataBefore = {
              ...dataBefore,
              currentTime: currentNode.storyTime,
              currentDate: calendarStore.formatStoryTime(currentNode.storyTime) || ''
            }
          } else if (dataBefore.currentTime == null) {
            dataBefore = {
              ...dataBefore,
              currentTime: 0,
              currentDate: calendarStore.formatStoryTime(0) || ''
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
        script: scriptContent().trim() || undefined
      })
      props.onClose()
    }
  }

  return (
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2>Edit Turn Script</h2>
          <button class={styles.closeButton} onClick={props.onClose}>×</button>
        </div>
        
        <div class={styles.content}>
          <p class={styles.help}>
            This script runs when generating context for this turn. It receives the data object 
            after all previous scripts have run, and should return the modified data object.
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
            <div class={styles.error}>{error()}</div>
          </Show>
          
          <div class={styles.previewSection}>
            <button 
              onClick={handlePreview} 
              class={styles.previewButton}
              disabled={!!error()}
            >
              {showPreview() ? 'Hide Preview' : 'Preview Data State'}
            </button>
            
            <Show when={showPreview() && previewData()}>
              <div class={styles.preview}>
                <div class={styles.previewColumn}>
                  <h4>Data Before This Turn</h4>
                  <pre>{JSON.stringify(previewData().before, null, 2)}</pre>
                </div>
                <div class={styles.previewColumn}>
                  <h4>Data After This Turn</h4>
                  <pre>{JSON.stringify(previewData().after, null, 2)}</pre>
                </div>
              </div>
            </Show>
          </div>
        </div>
        
        <div class={styles.footer}>
          <button onClick={handleSave} class={styles.saveButton}>Save</button>
          <button onClick={props.onClose} class={styles.cancelButton}>Cancel</button>
        </div>
      </div>
    </div>
  )
}