import ejs from 'ejs'
import { enableMapSet, produce } from 'immer'
import { calendarStore } from '../stores/calendarStore'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { plotPointsStore } from '../stores/plotPointsStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import { Character, ContextItem, Message, Node } from '../types/core'
import { getCharacterDisplayName } from './character'
import { getMessagesInStoryOrder } from './nodeTraversal'

// Enable support for Maps and Sets in Immer
enableMapSet()

// Initialize character data with static properties from character entities
function initializeCharacterData(data: ScriptData) {
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
function initializeContextItemData(data: ScriptData) {
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
function initializePlotPointData(data: ScriptData) {
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

export interface ScriptData {
  [key: string]: any
}

export interface ScriptFunctions {
  [key: string]: (...args: unknown[]) => unknown
}

export interface ScriptResult {
  data: ScriptData
  functions?: ScriptFunctions
  error?: string
}

/**
 * Inventory item structure
 */
export interface InventoryItem {
  name: string
  amount: number
  description?: string
}

/**
 * Built-in inventory helper functions
 * These are always available in scripts and work with the Immer draft
 * Note: Using 'any' cast because ScriptFunctions has generic signature but these have typed params
 */
export const builtInFunctions: ScriptFunctions = {
  /**
   * Add an item to a character's inventory
   * @param data - The script data object (Immer draft)
   * @param characterName - Display name of the character
   * @param item - Item to add { name, amount?, description? }
   */
  addItem: ((data: ScriptData, characterName: string, item: { name: string; amount?: number; description?: string }) => {
    if (!data.characters?.[characterName]) {
      console.warn(`[addItem] Character "${characterName}" not found`)
      return
    }
    if (!data.characters[characterName].inventory) {
      data.characters[characterName].inventory = []
    }
    const inv = data.characters[characterName].inventory as InventoryItem[]
    const existing = inv.find((i) => i.name === item.name)
    if (existing) {
      existing.amount = (existing.amount || 1) + (item.amount || 1)
      if (item.description) existing.description = item.description
    } else {
      inv.push({
        name: item.name,
        amount: item.amount || 1,
        description: item.description || '',
      })
    }
  }) as (...args: unknown[]) => unknown,

  /**
   * Remove an item from a character's inventory
   * @param data - The script data object (Immer draft)
   * @param characterName - Display name of the character
   * @param itemName - Name of the item to remove
   * @param amount - Amount to remove (default: 1)
   * @returns true if item was found and removed, false otherwise
   */
  removeItem: ((data: ScriptData, characterName: string, itemName: string, amount: number = 1): boolean => {
    const inv = data.characters?.[characterName]?.inventory as InventoryItem[] | undefined
    if (!inv) return false
    const item = inv.find((i) => i.name === itemName)
    if (item) {
      item.amount = (item.amount || 1) - amount
      if (item.amount <= 0) {
        const index = inv.indexOf(item)
        inv.splice(index, 1)
      }
      return true
    }
    return false
  }) as (...args: unknown[]) => unknown,

  /**
   * Check if a character has an item in their inventory
   * @param data - The script data object
   * @param characterName - Display name of the character
   * @param itemName - Name of the item to check
   * @param minAmount - Minimum amount required (default: 1)
   * @returns true if character has at least minAmount of the item
   */
  hasItem: ((data: ScriptData, characterName: string, itemName: string, minAmount: number = 1): boolean => {
    const inv = data.characters?.[characterName]?.inventory as InventoryItem[] | undefined
    const item = inv?.find((i) => i.name === itemName)
    return (item?.amount || 0) >= minAmount
  }) as (...args: unknown[]) => unknown,

  /**
   * Get an item from a character's inventory
   * @param data - The script data object
   * @param characterName - Display name of the character
   * @param itemName - Name of the item to get
   * @returns The item object or null if not found
   */
  getItem: ((data: ScriptData, characterName: string, itemName: string): InventoryItem | null => {
    const inv = data.characters?.[characterName]?.inventory as InventoryItem[] | undefined
    return inv?.find((i) => i.name === itemName) || null
  }) as (...args: unknown[]) => unknown,

  /**
   * List all items in a character's inventory
   * @param data - The script data object
   * @param characterName - Display name of the character
   * @returns Array of inventory items or empty array
   */
  listInventory: ((data: ScriptData, characterName: string): InventoryItem[] => {
    return (data.characters?.[characterName]?.inventory as InventoryItem[]) || []
  }) as (...args: unknown[]) => unknown,
}

/**
 * Execute a script function with the given data object and functions
 * Scripts can now return either:
 * 1. Just the modified data object (backward compatible)
 * 2. An object with { data, functions } to define reusable functions (global script only)
 *
 * Data is made immutable using Immer - scripts can write mutative code
 * but the original data object is never modified. Returns a frozen object.
 */
export function executeScript(
  script: string,
  data: ScriptData,
  userFunctions: ScriptFunctions = {},
  allowFunctionReturn = false,
): ScriptResult {
  // Merge built-in functions with user-provided functions (user can override)
  let functions = { ...builtInFunctions, ...userFunctions }

  try {
    // Wrap the script in a function if it's not already
    const scriptFunction = eval(`(${script})`)

    if (typeof scriptFunction !== 'function') {
      console.error('Script must be a function')
      return { data, functions }
    }

    let scriptError: Error | null = null

    // Create an immutable draft of the data using Immer
    const newData = produce(data, (draft: ScriptData) => {
      // Create wrapped functions that work with Immer drafts
      const wrappedFunctions: ScriptFunctions = {}
      Object.keys(functions).forEach((key) => {
        wrappedFunctions[key] = (...args: any[]) => {
          // If the first argument looks like our draft data, pass it through
          // Otherwise, pass the original function with all arguments
          if (args[0] && typeof args[0] === 'object' && args[0] === draft) {
            return functions[key](draft, ...args.slice(1))
          }
          return functions[key](...args)
        }
      })

      try {
        // Execute the script with the draft data and wrapped functions
        const result = scriptFunction(draft, wrappedFunctions)

        // Only process return value for global scripts that can define functions
        if (allowFunctionReturn && result && typeof result === 'object' && 'data' in result && 'functions' in result) {
          // This is a global script returning { data, functions }
          if (result.data && typeof result.data === 'object') {
            // Replace all properties in draft with result.data
            // First remove all existing keys
            Object.keys(draft).forEach((key) => delete draft[key])
            // Then add all keys from result.data
            Object.entries(result.data).forEach(([key, value]) => {
              draft[key] = value
            })
          }
          // Store functions for return (they don't go in the draft)
          functions = result.functions || {}
        } else if (!allowFunctionReturn && result && typeof result === 'object' && result !== draft) {
          // For message scripts: if they return a different object, warn them
          // This catches cases where someone creates a new object instead of mutating
          console.warn(
            'Message scripts should mutate data directly, not return new objects. The returned object will be ignored.',
          )
        }
        // If script returned draft, undefined, or nothing - that's fine!
        // Immer will use the mutations made to draft
      } catch (error) {
        scriptError = error as Error
        throw error // Re-throw to let Immer handle rollback
      }
    })

    if (scriptError) {
      throw scriptError
    }

    return { data: newData, functions }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error executing script:', error)
    return { data, functions, error: errorMessage }
  }
}

/**
 * Execute all scripts up to and including the specified message
 * Returns the final data object after all script executions
 *
 * @param messages - All messages in the story
 * @param targetMessageId - The ID of the message to execute scripts up to
 * @param nodes - Nodes array to determine story order
 * @param globalScript - Optional global script to execute first
 */
export function executeScriptsUpToMessage(
  messages: Message[],
  targetMessageId: string | null,
  nodes: Node[],
  globalScript?: string,
): ScriptData {
  let data: ScriptData = {}
  let functions: ScriptFunctions = {}

  // Execute global script first if it exists
  // Global script can define reusable functions
  if (globalScript) {
    const result = executeScript(globalScript, data, {}, true)
    data = result.data
    functions = result.functions || {}
  }

  // Initialize currentTime, characters, context items, and plot points
  // This mirrors the initialization done in scriptDataStore.evaluateAllScripts
  data = produce({ ...data }, (draft: ScriptData) => {
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

  // If no target message, just return initialized state with global script applied
  if (!targetMessageId) {
    return data
  }

  // Get messages to process in story order based on nodes
  const messagesToProcess = getMessagesInStoryOrder(messages, nodes, targetMessageId)
  console.log(`[executeScriptsUpToMessage] Processing ${messagesToProcess.length} messages in story order`)

  // Track current node for time updates
  let currentNodeId: string | null = null
  // Track the last explicitly set chapter time (separate from script-modified currentTime)
  let lastChapterBaseTime = 0

  // Execute scripts for each message
  for (const message of messagesToProcess) {
    // Check if we've moved to a new node - update currentTime if needed
    if (message.sceneId && message.sceneId !== currentNodeId) {
      currentNodeId = message.sceneId
      const currentNode = nodes.find((n) => n.id === currentNodeId)

      // Handle storyTime for the new node
      if (currentNode?.storyTime != null) {
        // Node has explicit storyTime - use it and update the base time
        lastChapterBaseTime = currentNode.storyTime
        data = produce(data, (draft: ScriptData) => {
          draft.currentTime = lastChapterBaseTime
          draft.currentDate = calendarStore.formatStoryTime(lastChapterBaseTime) || ''
        })
      } else {
        // Node doesn't have storyTime - reset to last chapter's base time
        data = produce(data, (draft: ScriptData) => {
          draft.currentTime = lastChapterBaseTime
          draft.currentDate = calendarStore.formatStoryTime(lastChapterBaseTime) || ''
        })
      }
    }

    if (message.script) {
      const result = executeScript(message.script, data, functions, false)
      data = result.data
    }
  }

  return data
}

/**
 * Evaluate an EJS template with the given data
 * Throws an error if template evaluation fails
 */
export function evaluateTemplate(template: string, data: ScriptData): string {
  return ejs.render(template, data)
}

/**
 * Get a preview of how character/context templates will be evaluated
 * for a given message
 * @param forceRefresh - If true, forces re-execution of scripts instead of using cache
 */
export function getTemplatePreview(
  template: string,
  messages: Message[],
  messageId: string,
  nodes: Node[],
  globalScript?: string,
  forceRefresh = false,
): { result: string; data: ScriptData; error?: string } {
  try {
    let data: ScriptData

    // Try to get cached data first (unless forced refresh)
    if (!forceRefresh) {
      const cachedData = scriptDataStore.getCumulativeDataAtMessage(messageId, false)
      if (cachedData !== null) {
        // Successfully got cached data
        data = cachedData
      } else {
        // Fall back to executing scripts if cache lookup failed (no nodes or nodeId)
        data = executeScriptsUpToMessage(messages, messageId, nodes, globalScript)
      }
    } else {
      // Force refresh requested - execute scripts
      data = executeScriptsUpToMessage(messages, messageId, nodes, globalScript)
    }

    // Add utility functions to the data context
    // These use the current story's calendar for calculations
    const dataWithUtils: ScriptData = {
      ...data,
      calculateAge: (birthdate: number, currentTime: number) => calendarStore.calculateAge(birthdate, currentTime),
      formatAge: (birthdate: number, currentTime: number) => calendarStore.formatAge(birthdate, currentTime),
    }

    // Try to evaluate the template and capture detailed errors
    try {
      const result = ejs.render(template, dataWithUtils)
      return { result, data: dataWithUtils }
    } catch (ejsError: any) {
      // EJS errors have a special format with line context
      let errorMessage = ''

      if (ejsError.message) {
        // EJS provides detailed error messages with line numbers and context
        errorMessage = ejsError.message

        // If it's a reference error, add helpful context about available data
        if (ejsError.message.includes('is not defined')) {
          const match = ejsError.message.match(/(\w+) is not defined/)
          if (match) {
            const missingVar = match[1]
            errorMessage += `\n\nHint: '${missingVar}' is not available in the data context.`
            errorMessage += `\nAvailable top-level properties: ${Object.keys(dataWithUtils).join(', ')}`

            // Check if it might be nested under characters or contextItems
            if (dataWithUtils.characters && Object.keys(dataWithUtils.characters).length > 0) {
              errorMessage += `\nCharacter properties: ${JSON.stringify(Object.values(dataWithUtils.characters)[0], null, 2).slice(0, 200)}...`
            }
          }
        }
      } else {
        errorMessage = String(ejsError)
      }

      return {
        result: template,
        data: dataWithUtils,
        error: errorMessage,
      }
    }
  } catch (error) {
    return {
      result: template,
      data: {
        calculateAge: (birthdate: number, currentTime: number) => calendarStore.calculateAge(birthdate, currentTime),
        formatAge: (birthdate: number, currentTime: number) => calendarStore.formatAge(birthdate, currentTime),
        characters: {},
        contextItems: {},
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
