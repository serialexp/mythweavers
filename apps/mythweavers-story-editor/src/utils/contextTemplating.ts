import { Character, ContextItem, Message, Node } from '../types/core'
import { executeScriptsUpToMessage, evaluateTemplate, ScriptData } from './scriptEngine'
import { scriptDataStore } from '../stores/scriptDataStore'
import { calculateAge, formatAge } from './coruscantCalendar'
import { getCharacterDisplayName } from './character'

/**
 * Filter characters to only those active in the given chapter node
 */
function filterActiveCharacters(characters: Character[], chapterNode: Node | undefined): Character[] {
  if (!chapterNode || chapterNode.type !== 'chapter') {
    return []
  }

  if (!chapterNode.activeCharacterIds || chapterNode.activeCharacterIds.length === 0) {
    return []
  }

  const activeIds = new Set(chapterNode.activeCharacterIds)
  return characters.filter(char => activeIds.has(char.id))
}

/**
 * Filter context items to only those active in the given chapter node or marked as global
 */
function filterActiveContextItems(contextItems: ContextItem[], chapterNode: Node | undefined): ContextItem[] {
  if (!chapterNode || chapterNode.type !== 'chapter') {
    // Still include global items even if no chapter is selected
    return contextItems.filter(item => item.isGlobal)
  }

  const activeIds = new Set(chapterNode.activeContextItemIds || [])
  return contextItems.filter(item => item.isGlobal || activeIds.has(item.id))
}

/**
 * Clean up duplicate newlines in a string, replacing multiple consecutive newlines with just two
 */
function cleanupNewlines(text: string): string {
  // Replace 3+ newlines with just 2 newlines
  return text.replace(/\n{3,}/g, '\n\n')
}

/**
 * Evaluate character templates with script data
 * @param forceRefresh - If true, forces re-execution of scripts instead of using cache
 */
export function evaluateCharacterTemplates(
  characters: Character[],
  messages: Message[],
  messageId: string,
  nodes: Node[],
  globalScript?: string,
  forceRefresh: boolean = false
): Character[] {
  // Try to get cached data first
  let data = scriptDataStore.getCumulativeDataAtMessage(messageId, forceRefresh)

  // Fall back to executing scripts if cache lookup failed
  if (data === null) {
    data = executeScriptsUpToMessage(messages, messageId, nodes, globalScript)
  }

  // Add utility functions to the data context
  const dataWithUtils: ScriptData = {
    ...data,
    calculateAge,
    formatAge
  }

  return characters.map(char => {
    try {
      const evaluatedFirstName = evaluateTemplate(char.firstName, dataWithUtils)
      const evaluatedLastName = char.lastName ? evaluateTemplate(char.lastName, dataWithUtils) : null
      const evaluatedDescription = char.description ? cleanupNewlines(evaluateTemplate(char.description, dataWithUtils)) : null

      return {
        ...char,
        firstName: evaluatedFirstName,
        lastName: evaluatedLastName,
        description: evaluatedDescription
      }
    } catch (error) {
      // Add context about which character failed
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Error evaluating template for character "${getCharacterDisplayName(char)}":\n${errorMessage}`)
    }
  })
}

/**
 * Evaluate context item templates with script data
 * @param forceRefresh - If true, forces re-execution of scripts instead of using cache
 */
export function evaluateContextItemTemplates(
  contextItems: ContextItem[],
  messages: Message[],
  messageId: string,
  nodes: Node[],
  globalScript?: string,
  forceRefresh: boolean = false
): ContextItem[] {
  // Try to get cached data first
  let data = scriptDataStore.getCumulativeDataAtMessage(messageId, forceRefresh)

  // Fall back to executing scripts if cache lookup failed
  if (data === null) {
    data = executeScriptsUpToMessage(messages, messageId, nodes, globalScript)
  }

  // Add utility functions to the data context
  const dataWithUtils: ScriptData = {
    ...data,
    calculateAge,
    formatAge
  }

  return contextItems.map(item => {
    try {
      return {
        ...item,
        name: evaluateTemplate(item.name, dataWithUtils),
        description: cleanupNewlines(evaluateTemplate(item.description, dataWithUtils))
      }
    } catch (error) {
      // Add context about which context item failed
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Error evaluating template for context item "${item.name}":\n${errorMessage}`)
    }
  })
}

/**
 * Generate character context with evaluated templates
 * @param forceRefresh - If true, forces re-execution of scripts instead of using cache
 */
export function getTemplatedCharacterContext(
  characters: Character[],
  messages: Message[],
  messageId: string,
  nodes: Node[],
  chapterNode: Node | undefined,
  globalScript?: string,
  forceRefresh: boolean = false
): string {
  if (characters.length === 0) return ''

  // Filter to only active characters in this chapter
  const activeCharacters = filterActiveCharacters(characters, chapterNode)
  if (activeCharacters.length === 0) return ''

  const evaluatedCharacters = evaluateCharacterTemplates(activeCharacters, messages, messageId, nodes, globalScript, forceRefresh)

  const characterList = evaluatedCharacters
    .map(char => `${getCharacterDisplayName(char)}${char.isMainCharacter ? ' (protagonist)' : ''}: ${char.description}`)
    .join('\n')

  return `Known characters in this story:\n${characterList}\n\n`
}

/**
 * Get active characters with evaluated templates for a chapter
 * @param forceRefresh - If true, forces re-execution of scripts instead of using cache
 */
export function getTemplatedActiveCharacters(
  characters: Character[],
  messages: Message[],
  messageId: string,
  nodes: Node[],
  chapterNode: Node | undefined,
  globalScript?: string,
  forceRefresh: boolean = false,
): Character[] {
  const activeCharacters = filterActiveCharacters(characters, chapterNode);
  if (activeCharacters.length === 0) {
    return [];
  }

  return evaluateCharacterTemplates(
    activeCharacters,
    messages,
    messageId,
    nodes,
    globalScript,
    forceRefresh,
  );
}

/**
 * Generate context items with evaluated templates
 * @param forceRefresh - If true, forces re-execution of scripts instead of using cache
 */
export function getTemplatedContextItems(
  contextItems: ContextItem[],
  messages: Message[],
  messageId: string,
  nodes: Node[],
  chapterNode: Node | undefined,
  globalScript?: string,
  forceRefresh: boolean = false
): string {
  // Filter to only active context items in this chapter (or global items)
  const activeItems = filterActiveContextItems(contextItems, chapterNode)
  if (activeItems.length === 0) return ''

  const evaluatedItems = evaluateContextItemTemplates(activeItems, messages, messageId, nodes, globalScript, forceRefresh)

  const contextList = evaluatedItems
    .map(item => `${item.name}: ${item.description}`)
    .join('\n')

  return `World/Setting Context:\n${contextList}\n\n`
}
