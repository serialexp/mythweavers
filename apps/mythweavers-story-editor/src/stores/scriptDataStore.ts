import type { ParagraphInventoryAction } from '@mythweavers/shared'
import { produce } from 'immer'
import { batch, createEffect } from 'solid-js'
import { createStore } from 'solid-js/store'
import { Character, ContextItem } from '../types/core'
import { getCharacterDisplayName } from '../utils/character'
import { getMessagesInStoryOrder } from '../utils/nodeTraversal'
import { builtInFunctions, executeScript } from '../utils/scriptEngine'
import { calendarStore } from './calendarStore'
import { charactersStore } from './charactersStore'
import { contextItemsStore } from './contextItemsStore'
import { currentStoryStore } from './currentStoryStore'
import { messagesStore } from './messagesStore'
import { nodeStore } from './nodeStore'
import { plotPointsStore } from './plotPointsStore'

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

interface ScriptError {
  messageId: string
  paragraphId?: string // Optional: for paragraph-level script errors
  nodeId: string
  error: string
}

interface ParagraphScriptState {
  paragraphId: string
  messageId: string
  before: ScriptDataObject
  after: ScriptDataObject
  error?: string
}

interface ScriptDataStore {
  // Map from message ID to the data state before and after that message's script
  dataStates: Record<string, ScriptDataState>
  // Map from paragraph ID to the data state before and after that paragraph's script
  paragraphStates: Record<string, ParagraphScriptState>
  // Map from node ID to cumulative changes in that node
  nodeChanges: Record<string, NodeChangeSummary>
  // Track script execution errors by node ID
  scriptErrors: Record<string, ScriptError[]>
  // Track if we need to recalculate
  isDirty: boolean
}

const [store, setStore] = createStore<ScriptDataStore>({
  dataStates: {},
  paragraphStates: {},
  nodeChanges: {},
  scriptErrors: {},
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

// Initialize plot points with default values from definitions
function initializePlotPointData(data: ScriptDataObject) {
  const definitions = plotPointsStore.definitions

  // Initialize plotPoints object
  if (!data.plotPoints || typeof data.plotPoints !== 'object' || Array.isArray(data.plotPoints)) {
    data.plotPoints = {}
  }

  const plotPointsObj = data.plotPoints as Record<string, string | number | boolean>

  // Set default values from definitions
  definitions.forEach((def) => {
    // Only set if not already defined (global script may have modified it)
    if (plotPointsObj[def.key] === undefined) {
      plotPointsObj[def.key] = def.default
    }
  })
}

// Apply plot point state overrides for a specific message
function applyPlotPointOverrides(data: ScriptDataObject, messageId: string) {
  const states = plotPointsStore.getStatesForMessage(messageId)
  const definitions = plotPointsStore.definitions

  if (states.length === 0) return

  // Ensure plotPoints object exists
  if (!data.plotPoints || typeof data.plotPoints !== 'object') {
    data.plotPoints = {}
  }

  const plotPointsObj = data.plotPoints as Record<string, string | number | boolean>

  // Apply each state override
  states.forEach((state) => {
    const def = definitions.find((d) => d.key === state.key)
    if (def) {
      // Parse value based on type
      if (def.type === 'number') {
        plotPointsObj[state.key] = Number(state.value)
      } else if (def.type === 'boolean') {
        plotPointsObj[state.key] = state.value === 'true'
      } else {
        plotPointsObj[state.key] = state.value
      }
    }
  })
}

// Apply inventory actions for a paragraph
// Uses the built-in inventory functions from scriptEngine
function applyInventoryActions(data: ScriptDataObject, actions: ParagraphInventoryAction[]) {
  if (!actions || actions.length === 0) return

  for (const action of actions) {
    if (action.type === 'add') {
      // Use the built-in addItem function
      ;(builtInFunctions.addItem as any)(data, action.character_name, {
        name: action.item_name,
        amount: action.item_amount,
        description: action.item_description,
      })
    } else if (action.type === 'remove') {
      // Use the built-in removeItem function
      ;(builtInFunctions.removeItem as any)(data, action.character_name, action.item_name, action.item_amount)
    }
  }
}

// Function to evaluate all scripts in sequence
const evaluateAllScripts = () => {
  const messages = messagesStore.messages
  const nodes = nodeStore.nodesArray
  const globalScript = currentStoryStore.globalScript

  let currentData: ScriptDataObject = {}
  let functions: Record<string, (...args: unknown[]) => unknown> = {}
  const newDataStates: Record<string, ScriptDataState> = {}
  const newParagraphStates: Record<string, ParagraphScriptState> = {}
  const newNodeChanges: Record<string, NodeChangeSummary> = {}
  const newScriptErrors: Record<string, ScriptError[]> = {}

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

      // Initialize characters, context items, and plot points from entity stores
      // This makes character.birthdate and other entity properties available to scripts
      initializeCharacterData(draft)
      initializeContextItemData(draft)
      initializePlotPointData(draft)
    })

    functions = result.functions || {}
    // Store this under a special key
    newDataStates.__global__ = {
      before: beforeGlobal,
      after: JSON.parse(JSON.stringify(currentData)),
    }
  } else {
    // Even if there's no global script, initialize characters, context items, and plot points
    currentData = produce(currentData, (draft: any) => {
      // Initialize currentTime to 0
      draft.currentTime = 0
      draft.currentDate = calendarStore.formatStoryTime(0) || ''

      // Initialize characters, context items, and plot points from entity stores
      initializeCharacterData(draft)
      initializeContextItemData(draft)
      initializePlotPointData(draft)
    })

    // Store this as the global state so getCumulativeDataAtMessage can find it
    newDataStates.__global__ = {
      before: {},
      after: JSON.parse(JSON.stringify(currentData)),
    }
  }

  // Get the last message to process all messages in story order
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) {
    batch(() => {
      setStore('dataStates', newDataStates)
      setStore('nodeChanges', newNodeChanges)
      setStore('scriptErrors', newScriptErrors)
      setStore('isDirty', false)
    })
    return
  }

  // Log which message we're using as the target for script processing
  if (!lastMessage.sceneId) {
    console.warn('[scriptDataStore] Last message has no nodeId', {
      messageId: lastMessage.id,
      type: lastMessage.type,
      role: lastMessage.role,
      chapterId: lastMessage.sceneId,
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
      nodeId: m.sceneId?.substring(0, 8),
      order: m.order,
      hasScript: !!m.script,
      content: `${m.content?.substring(0, 30)}...`,
    })),
  )

  // Track changes per scene (use sceneId, fall back to nodeId for legacy)
  let currentSceneId: string | null = null
  let nodeStartData: ScriptDataObject = JSON.parse(JSON.stringify(currentData))
  let currentNode = nodes.find((n) => n.id === currentSceneId)

  // Execute each message's script in story order
  for (const message of messagesInOrder) {
    // Check if we've moved to a new scene
    const messageSceneId = message.sceneId
    if (messageSceneId && messageSceneId !== currentSceneId) {
      // Save the changes for the previous scene if there was one
      if (currentSceneId && currentNode) {
        const changes = detectChanges(nodeStartData, currentData)
        if (changes.length > 0) {
          newNodeChanges[currentSceneId] = {
            nodeId: currentSceneId,
            nodeTitle: currentNode.title,
            changes,
            finalState: JSON.parse(JSON.stringify(currentData)),
          }
        }
      }

      // Start tracking the new scene
      currentSceneId = messageSceneId
      currentNode = nodes.find((n) => n.id === currentSceneId)
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

    // Apply plot point state overrides for this message (before script execution)
    const plotPointStatesForMessage = plotPointsStore.getStatesForMessage(message.id)
    if (plotPointStatesForMessage.length > 0) {
      currentData = produce({ ...currentData }, (draft: any) => {
        applyPlotPointOverrides(draft, message.id)
      })
    }

    // Process paragraph inventory actions and scripts FIRST (in sortOrder), before message script
    if (message.paragraphs && message.paragraphs.length > 0 && message.role === 'assistant' && !message.isQuery) {
      // Sort paragraphs by sortOrder (they may already be sorted, but ensure it)
      const sortedParagraphs = [...message.paragraphs].sort((a, b) => {
        // Get sortOrder - paragraphs from API should have this via the Paragraph interface
        const orderA = (a as any).sortOrder ?? 0
        const orderB = (b as any).sortOrder ?? 0
        return orderA - orderB
      })

      for (const paragraph of sortedParagraphs) {
        const hasInventoryActions = paragraph.inventoryActions && paragraph.inventoryActions.length > 0
        const hasScript = !!paragraph.script

        // Skip if neither inventory actions nor script
        if (!hasInventoryActions && !hasScript) continue

        const beforeData = JSON.parse(JSON.stringify(currentData))

        // 1. Apply inventory actions FIRST (if any)
        if (hasInventoryActions) {
          currentData = produce({ ...currentData }, (draft: any) => {
            applyInventoryActions(draft, paragraph.inventoryActions!)
          })
        }

        // 2. Execute paragraph script AFTER inventory actions (if any)
        let scriptError: string | undefined
        if (hasScript) {
          const result = executeScript(paragraph.script!, currentData, functions, false)
          currentData = result.data
          scriptError = result.error
        }

        // Store paragraph state (for both inventory actions and scripts)
        newParagraphStates[paragraph.id] = {
          paragraphId: paragraph.id,
          messageId: message.id,
          before: beforeData,
          after: JSON.parse(JSON.stringify(currentData)),
          error: scriptError,
        }

        // Track paragraph script errors
        const errorNodeId = message.sceneId
        if (scriptError && errorNodeId) {
          if (!newScriptErrors[errorNodeId]) {
            newScriptErrors[errorNodeId] = []
          }
          newScriptErrors[errorNodeId].push({
            messageId: message.id,
            paragraphId: paragraph.id,
            nodeId: errorNodeId,
            error: scriptError,
          })
        }
      }
    }

    // Process message script AFTER paragraph scripts
    if (message.script && message.role === 'assistant' && !message.isQuery) {
      // Deep copy the current state as "before"
      const beforeData = JSON.parse(JSON.stringify(currentData))

      // Execute the script with the functions from global script
      const result = executeScript(message.script, currentData, functions, false)
      currentData = result.data

      // Track script errors by scene
      const errorNodeId = message.sceneId
      if (result.error && errorNodeId) {
        if (!newScriptErrors[errorNodeId]) {
          newScriptErrors[errorNodeId] = []
        }
        newScriptErrors[errorNodeId].push({
          messageId: message.id,
          nodeId: errorNodeId,
          error: result.error,
        })
      }

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

  // Save changes for the last scene
  if (currentSceneId && currentNode) {
    const changes = detectChanges(nodeStartData, currentData)
    if (changes.length > 0) {
      newNodeChanges[currentSceneId] = {
        nodeId: currentSceneId,
        nodeTitle: currentNode.title,
        changes,
        finalState: JSON.parse(JSON.stringify(currentData)),
      }
    }
  }

  batch(() => {
    setStore('dataStates', newDataStates)
    setStore('paragraphStates', newParagraphStates)
    setStore('nodeChanges', newNodeChanges)
    setStore('scriptErrors', newScriptErrors)
    setStore('isDirty', false)
  })
}

// Mark as dirty when scripts, nodes, characters, or context items change
createEffect(() => {
  // Track global script changes
  currentStoryStore.globalScript

  // Track message count changes (for deletions)
  messagesStore.messages.length

  // Track message script changes - create a derived value to ensure reactivity
  // Using JSON.stringify on the scripts array ensures we detect any script content changes
  JSON.stringify(
    messagesStore.messages
      .filter((m) => m.role === 'assistant' && !m.isQuery)
      .map((m) => ({ id: m.id, script: m.script }))
  )

  // Track paragraph script changes
  JSON.stringify(
    messagesStore.messages
      .filter((m) => m.role === 'assistant' && !m.isQuery && m.paragraphs)
      .flatMap((m) =>
        (m.paragraphs || []).map((p) => ({ paragraphId: p.id, messageId: m.id, script: p.script })),
      ),
  )

  // Track paragraph inventory action changes
  JSON.stringify(
    messagesStore.messages
      .filter((m) => m.role === 'assistant' && !m.isQuery && m.paragraphs)
      .flatMap((m) =>
        (m.paragraphs || []).map((p) => ({ paragraphId: p.id, inventoryActions: p.inventoryActions })),
      ),
  )

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

  // Track plot point changes - definitions and states affect script data
  plotPointsStore.definitions.length
  plotPointsStore.definitions.forEach((d) => {
    d.key
    d.type
    d.default
  })
  plotPointsStore.states.length
  plotPointsStore.states.forEach((s) => {
    s.messageId
    s.key
    s.value
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

  get paragraphStates() {
    return store.paragraphStates
  },

  get nodeChanges() {
    return store.nodeChanges
  },

  get isDirty() {
    return store.isDirty
  },

  get scriptErrors() {
    return store.scriptErrors
  },

  getDataStateForMessage(messageId: string): ScriptDataState | undefined {
    return store.dataStates[messageId]
  },

  getDataStateForParagraph(paragraphId: string): ParagraphScriptState | undefined {
    return store.paragraphStates[paragraphId]
  },

  getNodeChanges(nodeId: string): NodeChangeSummary | undefined {
    return store.nodeChanges[nodeId]
  },

  // Get script errors for a specific node
  getScriptErrors(nodeId: string): ScriptError[] {
    return store.scriptErrors[nodeId] || []
  },

  // Check if a node has any script errors
  hasScriptErrors(nodeId: string): boolean {
    const errors = store.scriptErrors[nodeId]
    return errors !== undefined && errors.length > 0
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
    if (!targetMessage.sceneId) {
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

    // Track current scene to detect scene changes
    let currentSceneId: string | null = null
    // Track the last explicitly set chapter time (separate from script-modified currentTime)
    let lastChapterBaseTime = 0

    // Walk through messages in order and find the last one with script data
    for (const message of messagesInOrder) {
      // Check if we've moved to a new scene - update currentTime if needed
      const messageSceneId = message.sceneId
      if (messageSceneId && messageSceneId !== currentSceneId) {
        currentSceneId = messageSceneId
        const currentNode = nodes.find((n) => n.id === currentSceneId)

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
