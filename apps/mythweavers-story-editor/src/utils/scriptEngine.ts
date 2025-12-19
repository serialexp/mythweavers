import ejs from 'ejs'
import { enableMapSet, produce } from 'immer'
import { calendarStore } from '../stores/calendarStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import { Message, Node } from '../types/core'
import { getMessagesInStoryOrder } from './nodeTraversal'

// Enable support for Maps and Sets in Immer
enableMapSet()

export interface ScriptData {
  [key: string]: any
}

export interface ScriptFunctions {
  [key: string]: (...args: unknown[]) => unknown
}

export interface ScriptResult {
  data: ScriptData
  functions?: ScriptFunctions
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
  functions: ScriptFunctions = {},
  allowFunctionReturn = false,
): ScriptResult {
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
    console.error('Error executing script:', error)
    return { data, functions }
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
  targetMessageId: string,
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

  // Initialize currentTime to 0 if not set by global script
  if (data.currentTime === undefined) {
    data = produce(data, (draft: ScriptData) => {
      draft.currentTime = 0
      draft.currentDate = calendarStore.formatStoryTime(0) || ''
    })
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
    if (message.nodeId && message.nodeId !== currentNodeId) {
      currentNodeId = message.nodeId
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
