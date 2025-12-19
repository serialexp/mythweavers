import { produce } from 'immer'
import { batch, createEffect } from 'solid-js'
import { createStore } from 'solid-js/store'
import { Character, ContextItem } from '../types/core'
import { getCharacterDisplayName } from '../utils/character'
import { getMessagesInStoryOrder } from '../utils/nodeTraversal'
import { executeScript } from '../utils/scriptEngine'
import { calendarStore } from './calendarStore'
import { charactersStore } from './charactersStore'
import { contextItemsStore } from './contextItemsStore'
import { currentStoryStore } from './currentStoryStore'
import { messagesStore } from './messagesStore'
import { nodeStore } from './nodeStore'

// Script data can be arbitrary user-defined values
type ScriptDataValue = string | number | boolean | null | undefined | ScriptDataObject | ScriptDataValue[]
type ScriptDataObject = { [key: string]: ScriptDataValue }

interface ScriptDataState {
  before: ScriptDataObject
  after: ScriptDataObject
}

interface NodeChangeSummary {
  nodeId: string
  nodeTitle: string
  changes: Array<{
    key: string
    oldValue: ScriptDataValue
    newValue: ScriptDataValue
  }>
  // Cumulative data state at the end of this node
  finalState: ScriptDataObject
}

interface ScriptDataStore {
  // Map from message ID to the data state before and after that message's script
  dataStates: Record<string, ScriptDataState>
  // Map from node ID to cumulative changes in that node
  nodeChanges: Record<string, NodeChangeSummary>
  // Track if we need to recalculate
  isDirty: boolean
}

const [store, setStore] = createStore<ScriptDataStore>({
  dataStates: {},
  nodeChanges: {},
  isDirty: true,
})

// Helper function to detect changes between two objects
const detectChanges = (
  before: ScriptDataObject,
  after: ScriptDataObject,
): Array<{ key: string; oldValue: ScriptDataValue; newValue: ScriptDataValue }> => {
  const changes: Array<{ key: string; oldValue: ScriptDataValue; newValue: ScriptDataValue }> = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])

  for (const key of allKeys) {
    const oldVal = before[key]
    const newVal = after[key]

    // Simple comparison - could be enhanced for deep object comparison
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ key, oldValue: oldVal, newValue: newVal })
    }
  }

  return changes
}

// Initialize character data with static properties from character entities
function initializeCharacterData(data: ScriptDataObject) {
  const characters = charactersStore.characters

  // Guard: If characters store is empty or not initialized, skip initialization
  if (!characters || characters.length === 0) {
    return
  }

  // Initialize characters object if it doesn't exist
  if (!data.characters || typeof data.characters !== 'object' || Array.isArray(data.characters)) {
    data.characters = {}
  }

  const charactersObj = data.characters as Record<string, any>

  // Initialize each character with static properties from Character entities
  characters.forEach((character: Character) => {
    const displayName = getCharacterDisplayName(character)
    if (!charactersObj[displayName]) {
      charactersObj[displayName] = {}
    }

    // Add static properties from the Character entity
    charactersObj[displayName].name = displayName

    if (character.birthdate !== undefined) {
      charactersObj[displayName].birthdate = character.birthdate
    }

    charactersObj[displayName].isMainCharacter = character.isMainCharacter || false
  })
}

// Initialize context item data
function initializeContextItemData(data: ScriptDataObject) {
  const contextItems = contextItemsStore.contextItems

  // Guard: If contextItems store is empty or not initialized, skip initialization
  if (!contextItems || contextItems.length === 0) {
    return
  }

  // Initialize contextItems object if it doesn't exist
  if (!data.contextItems || typeof data.contextItems !== 'object' || Array.isArray(data.contextItems)) {
    data.contextItems = {}
  }

  const contextItemsObj = data.contextItems as Record<string, any>

  // Initialize each context item
  contextItems.forEach((item: ContextItem) => {
    if (!contextItemsObj[item.name]) {
      contextItemsObj[item.name] = {}
    }

    // Add static properties from the ContextItem entity
    contextItemsObj[item.name].name = item.name
    contextItemsObj[item.name].type = item.type
    contextItemsObj[item.name].isGlobal = item.isGlobal
  })
}

// Function to evaluate all scripts in sequence
const evaluateAllScripts = () => {
  const messages = messagesStore.messages
  const nodes = nodeStore.nodesArray
  const globalScript = currentStoryStore.globalScript

  let currentData: ScriptDataObject = {}
  let functions: Record<string, (...args: unknown[]) => unknown> = {}
  const newDataStates: Record<string, ScriptDataState> = {}
  const newNodeChanges: Record<string, NodeChangeSummary> = {}

  // Track the last explicitly set chapter time (separate from script-modified currentTime)
  let lastChapterBaseTime = 0

  // Execute global script first
  if (globalScript) {
    const beforeGlobal = JSON.parse(JSON.stringify(currentData))
    const result = executeScript(globalScript, currentData, {}, true)

    // Apply all our post-global-script modifications in one produce
    // Unfreeze the result first with a shallow copy
    currentData = produce({ ...result.data }, (draft: any) => {
      // Initialize currentTime to 0 if not set by global script
      if (draft.currentTime === undefined) {
        draft.currentTime = 0
        draft.currentDate = calendarStore.formatStoryTime(0) || ''
      }

      // Initialize characters and context items from entity stores
      // This makes character.birthdate and other entity properties available to scripts
      initializeCharacterData(draft)
      initializeContextItemData(draft)
    })

    functions = result.functions || {}
    // Store this under a special key
    newDataStates.__global__ = {
      before: beforeGlobal,
      after: JSON.parse(JSON.stringify(currentData)),
    }
  } else {
    // Even if there's no global script, initialize characters and context items
    currentData = produce(currentData, (draft: any) => {
      // Initialize currentTime to 0
      draft.currentTime = 0
      draft.currentDate = calendarStore.formatStoryTime(0) || ''

      // Initialize characters and context items from entity stores
      initializeCharacterData(draft)
      initializeContextItemData(draft)
    })
  }

  // Get the last message to process all messages in story order
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) {
    batch(() => {
      setStore('dataStates', newDataStates)
      setStore('nodeChanges', newNodeChanges)
      setStore('isDirty', false)
    })
    return
  }

  // Log which message we're using as the target for script processing
  if (!lastMessage.nodeId) {
    console.warn('[scriptDataStore] Last message has no nodeId', {
      messageId: lastMessage.id,
      type: lastMessage.type,
      role: lastMessage.role,
      chapterId: lastMessage.chapterId,
      order: lastMessage.order,
      content: `${lastMessage.content?.substring(0, 50)}...`,
    })
  }

  // Get messages in story order using node traversal
  const messagesInOrder = nodes.length > 0 ? getMessagesInStoryOrder(messages, nodes, lastMessage.id) : messages

  // Debug: Log the order of messages being processed
  console.log(
    '[scriptDataStore] Processing messages in this order:',
    messagesInOrder.map((m) => ({
      id: m.id.substring(0, 8),
      nodeId: m.nodeId?.substring(0, 8),
      order: m.order,
      hasScript: !!m.script,
      content: `${m.content?.substring(0, 30)}...`,
    })),
  )

  // Track changes per node
  let currentNodeId: string | null = null
  let nodeStartData: ScriptDataObject = JSON.parse(JSON.stringify(currentData))
  let currentNode = nodes.find((n) => n.id === currentNodeId)

  // Execute each message's script in story order
  for (const message of messagesInOrder) {
    // Check if we've moved to a new node
    if (message.nodeId && message.nodeId !== currentNodeId) {
      // Save the changes for the previous node if there was one
      if (currentNodeId && currentNode) {
        const changes = detectChanges(nodeStartData, currentData)
        if (changes.length > 0) {
          newNodeChanges[currentNodeId] = {
            nodeId: currentNodeId,
            nodeTitle: currentNode.title,
            changes,
            finalState: JSON.parse(JSON.stringify(currentData)),
          }
        }
      }

      // Start tracking the new node
      currentNodeId = message.nodeId
      currentNode = nodes.find((n) => n.id === currentNodeId)
      nodeStartData = JSON.parse(JSON.stringify(currentData))

      // Handle storyTime for the new node
      if (currentNode?.storyTime != null) {
        // Node has explicit storyTime - use it and update the base time
        const nodeStoryTime = currentNode.storyTime
        lastChapterBaseTime = nodeStoryTime
        currentData = produce({ ...currentData }, (draft: any) => {
          draft.currentTime = nodeStoryTime
          draft.currentDate = calendarStore.formatStoryTime(nodeStoryTime) || ''
        })
      } else {
        // Node doesn't have storyTime - reset to last chapter's base time
        // This ensures chapters without storyTime use the last explicitly set time
        // instead of any script-modified time from previous chapters
        currentData = produce({ ...currentData }, (draft: any) => {
          draft.currentTime = lastChapterBaseTime
          draft.currentDate = calendarStore.formatStoryTime(lastChapterBaseTime) || ''
        })
      }
    }

    if (message.script && message.role === 'assistant' && !message.isQuery) {
      // Deep copy the current state as "before"
      const beforeData = JSON.parse(JSON.stringify(currentData))

      // Execute the script with the functions from global script
      const result = executeScript(message.script, currentData, functions, false)
      currentData = result.data

      // Debug: Log changes to character ages
      if (beforeData.characters && result.data.characters) {
        for (const charName of Object.keys(result.data.characters)) {
          const beforeAge = beforeData.characters[charName]?.age
          const afterAge = result.data.characters[charName]?.age
          if (beforeAge !== afterAge) {
            console.log(
              `[scriptDataStore] Age change for ${charName} in message ${message.id.substring(0, 8)}: ${beforeAge} -> ${afterAge}`,
            )
          }
        }
      }

      // Store the before and after states
      newDataStates[message.id] = {
        before: beforeData,
        after: JSON.parse(JSON.stringify(currentData)),
      }
    }
  }

  // Save changes for the last node
  if (currentNodeId && currentNode) {
    const changes = detectChanges(nodeStartData, currentData)
    if (changes.length > 0) {
      newNodeChanges[currentNodeId] = {
        nodeId: currentNodeId,
        nodeTitle: currentNode.title,
        changes,
        finalState: JSON.parse(JSON.stringify(currentData)),
      }
    }
  }

  batch(() => {
    setStore('dataStates', newDataStates)
    setStore('nodeChanges', newNodeChanges)
    setStore('isDirty', false)
  })
}

// Mark as dirty when scripts, nodes, characters, or context items change
createEffect(() => {
  // Track global script changes
  currentStoryStore.globalScript

  // Track message script changes - accessing them triggers reactivity
  messagesStore.messages.filter((m) => m.role === 'assistant' && !m.isQuery).forEach((m) => m.script)

  // Track node changes (for proper story order and storyTime changes)
  nodeStore.nodesArray.length
  nodeStore.nodesArray.forEach((n) => {
    n.order
    n.storyTime
  })

  // Track character changes - character data is initialized into script context
  charactersStore.characters.length
  charactersStore.characters.forEach((c) => {
    c.firstName
    c.lastName
    c.birthdate
    c.isMainCharacter
  })

  // Track context item changes - context items are initialized into script context
  contextItemsStore.contextItems.length
  contextItemsStore.contextItems.forEach((i) => {
    i.name
    i.type
    i.isGlobal
  })

  // This effect will re-run whenever scripts, node structure, or entities change
  setStore('isDirty', true)
})

// Re-evaluate when marked as dirty
createEffect(() => {
  if (store.isDirty) {
    evaluateAllScripts()
  }
})

export const scriptDataStore = {
  get dataStates() {
    return store.dataStates
  },

  get nodeChanges() {
    return store.nodeChanges
  },

  get isDirty() {
    return store.isDirty
  },

  getDataStateForMessage(messageId: string): ScriptDataState | undefined {
    return store.dataStates[messageId]
  },

  getNodeChanges(nodeId: string): NodeChangeSummary | undefined {
    return store.nodeChanges[nodeId]
  },

  // Get all nodes that have script changes
  getNodesWithChanges(): NodeChangeSummary[] {
    return Object.values(store.nodeChanges)
  },

  // Get the cumulative script data state at a specific message
  // This finds the last script execution at or before the target message
  getCumulativeDataAtMessage(targetMessageId: string, forceRefresh = false): ScriptDataObject | null {
    // If forced refresh or cache is dirty, re-evaluate first
    if (forceRefresh || store.isDirty) {
      evaluateAllScripts()
    }

    const messages = messagesStore.messages
    const nodes = nodeStore.nodesArray

    // Fail if no nodes exist
    if (nodes.length === 0) {
      return null
    }

    // Find the target message
    const targetMessage = messages.find((m) => m.id === targetMessageId)
    if (!targetMessage) {
      console.warn('[scriptDataStore] Target message not found', { targetMessageId })
      return null
    }

    // Fail if message has no nodeId
    if (!targetMessage.nodeId) {
      return null
    }

    // Get messages in story order up to target
    const messagesInOrder = getMessagesInStoryOrder(messages, nodes, targetMessageId)

    // Find the last message with script data at or before the target
    let lastScriptData: ScriptDataObject = {}

    // Start with global script data if it exists
    if (store.dataStates.__global__) {
      lastScriptData = store.dataStates.__global__.after
    }

    // Track current node to detect chapter changes
    let currentNodeId: string | null = null
    // Track the last explicitly set chapter time (separate from script-modified currentTime)
    let lastChapterBaseTime = 0

    // Walk through messages in order and find the last one with script data
    for (const message of messagesInOrder) {
      // Check if we've moved to a new node - update currentTime if needed
      if (message.nodeId && message.nodeId !== currentNodeId) {
        currentNodeId = message.nodeId
        const currentNode = nodes.find((n) => n.id === currentNodeId)

        // Handle storyTime for the new node
        if (currentNode?.storyTime != null) {
          // Node has explicit storyTime - use it and update the base time
          lastChapterBaseTime = currentNode.storyTime
          lastScriptData = {
            ...lastScriptData,
            currentTime: currentNode.storyTime,
            currentDate: calendarStore.formatStoryTime(currentNode.storyTime) || '',
          }
        } else {
          // Node doesn't have storyTime - reset to last chapter's base time
          lastScriptData = {
            ...lastScriptData,
            currentTime: lastChapterBaseTime,
            currentDate: calendarStore.formatStoryTime(lastChapterBaseTime) || '',
          }
        }
      }

      if (store.dataStates[message.id]) {
        lastScriptData = store.dataStates[message.id].after
      }

      // Stop if we've reached the target message
      if (message.id === targetMessageId) {
        break
      }
    }

    // Debug: Log what age we're returning for characters
    if (
      lastScriptData.characters &&
      typeof lastScriptData.characters === 'object' &&
      !Array.isArray(lastScriptData.characters)
    ) {
      for (const charName of Object.keys(lastScriptData.characters)) {
        const charData = lastScriptData.characters[charName]
        if (charData && typeof charData === 'object' && !Array.isArray(charData) && 'age' in charData) {
          const age = charData.age
          if (age !== undefined) {
            console.log(
              `[getCumulativeDataAtMessage] Returning age ${age} for ${charName} at message ${targetMessageId.substring(0, 8)}`,
            )
          }
        }
      }
    }

    return lastScriptData
  },

  // Force re-evaluation
  refresh() {
    setStore('isDirty', true)
  },
}
