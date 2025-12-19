import ejs from 'ejs'
import { enableMapSet, produce } from 'immer'

// Enable support for Maps and Sets in Immer
enableMapSet()

export interface ScriptData {
  [key: string]: any
}

export interface ScriptFunctions {
  [key: string]: (...args: any[]) => any
}

export interface ScriptResult {
  data: ScriptData
  functions?: ScriptFunctions
}

export interface Message {
  id: string
  content: string
  role: string
  script?: string | null
  [key: string]: any
}

/**
 * Execute a script function with the given data object and functions
 * Scripts can now return either:
 * 1. Just the modified data object (backward compatible)
 * 2. An object with { data, functions } to define reusable functions (global script only)
 *
 * Data is made immutable using Immer - scripts can write mutative code
 * but the original data object is never modified
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
 */
export function executeScriptsUpToMessage(
  messages: Message[],
  targetMessageId: string,
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

  // Find the index of the target message
  const targetIndex = messages.findIndex((m) => m.id === targetMessageId)
  if (targetIndex === -1) {
    console.warn('Target message not found, executing all scripts')
  }

  // Execute scripts for each message up to and including the target
  const messagesToProcess = targetIndex >= 0 ? messages.slice(0, targetIndex + 1) : messages

  for (const message of messagesToProcess) {
    if (message.script) {
      const result = executeScript(message.script, data, functions, false)
      data = result.data
    }
  }

  return data
}

/**
 * Evaluate an EJS template with the given data
 */
export function evaluateTemplate(template: string, data: ScriptData): string {
  try {
    return ejs.render(template, data)
  } catch (error) {
    console.error('Error evaluating template:', error)
    return template // Return original template on error
  }
}

/**
 * Get a preview of how character/context templates will be evaluated
 * for a given message
 */
export function getTemplatePreview(
  template: string,
  messages: Message[],
  messageId: string,
  globalScript?: string,
): { result: string; data: ScriptData; error?: string } {
  try {
    const data = executeScriptsUpToMessage(messages, messageId, globalScript)
    const result = evaluateTemplate(template, data)
    return { result, data }
  } catch (error) {
    return {
      result: template,
      data: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
