import { calendarStore } from '../stores/calendarStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import { Character, ContextItem, Message, Node } from '../types/core'
import { getCharacterDisplayName } from './character'
import { ScriptData, evaluateTemplate, executeScriptsUpToMessage } from './scriptEngine'

/**
 * Filter characters to only those active in the given scene/chapter node.
 * Active characters are typically set on scene nodes (where content lives).
 */
function filterActiveCharacters(characters: Character[], node: Node | undefined): Character[] {
  if (!node) {
    return []
  }

  // Scene nodes (and chapter nodes for legacy) can have activeCharacterIds
  if (!node.activeCharacterIds || node.activeCharacterIds.length === 0) {
    return []
  }

  const activeIds = new Set(node.activeCharacterIds)
  return characters.filter((char) => activeIds.has(char.id))
}

/**
 * Filter context items to only those active in the given scene/chapter node or marked as global.
 * Active context items are typically set on scene nodes (where content lives).
 */
function filterActiveContextItems(contextItems: ContextItem[], node: Node | undefined): ContextItem[] {
  if (!node) {
    // Still include global items even if no node is selected
    return contextItems.filter((item) => item.isGlobal)
  }

  // Scene nodes (and chapter nodes for legacy) can have activeContextItemIds
  const activeIds = new Set(node.activeContextItemIds || [])
  return contextItems.filter((item) => item.isGlobal || activeIds.has(item.id))
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
  forceRefresh = false,
): Character[] {
  // Try to get cached data first
  let data = scriptDataStore.getCumulativeDataAtMessage(messageId, forceRefresh)

  // Fall back to executing scripts if cache lookup failed
  if (data === null) {
    data = executeScriptsUpToMessage(messages, messageId, nodes, globalScript)
  }

  // Add utility functions to the data context (using the story's configured calendar)
  const dataWithUtils: ScriptData = {
    ...data,
    calculateAge: (birthdate: number, currentTime: number) => calendarStore.calculateAge(birthdate, currentTime),
    formatAge: (birthdate: number, currentTime: number) => calendarStore.formatAge(birthdate, currentTime),
  }

  return characters.map((char) => {
    try {
      const evaluatedFirstName = evaluateTemplate(char.firstName, dataWithUtils)
      const evaluatedLastName = char.lastName ? evaluateTemplate(char.lastName, dataWithUtils) : null
      const evaluatedDescription = char.description
        ? cleanupNewlines(evaluateTemplate(char.description, dataWithUtils))
        : null

      return {
        ...char,
        firstName: evaluatedFirstName,
        lastName: evaluatedLastName,
        description: evaluatedDescription,
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
  forceRefresh = false,
): ContextItem[] {
  // Try to get cached data first
  let data = scriptDataStore.getCumulativeDataAtMessage(messageId, forceRefresh)

  // Fall back to executing scripts if cache lookup failed
  if (data === null) {
    data = executeScriptsUpToMessage(messages, messageId, nodes, globalScript)
  }

  // Add utility functions to the data context (using the story's configured calendar)
  const dataWithUtils: ScriptData = {
    ...data,
    calculateAge: (birthdate: number, currentTime: number) => calendarStore.calculateAge(birthdate, currentTime),
    formatAge: (birthdate: number, currentTime: number) => calendarStore.formatAge(birthdate, currentTime),
  }

  return contextItems.map((item) => {
    try {
      return {
        ...item,
        name: evaluateTemplate(item.name, dataWithUtils),
        description: cleanupNewlines(evaluateTemplate(item.description, dataWithUtils)),
      }
    } catch (error) {
      // Add context about which context item failed
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Error evaluating template for context item "${item.name}":\n${errorMessage}`)
    }
  })
}

/**
 * Generate character context with evaluated templates in XML format
 * @param forceRefresh - If true, forces re-execution of scripts instead of using cache
 */
export function getTemplatedCharacterContext(
  characters: Character[],
  messages: Message[],
  messageId: string,
  nodes: Node[],
  chapterNode: Node | undefined,
  globalScript?: string,
  forceRefresh = false,
): string {
  if (characters.length === 0) return ''

  // Filter to only active characters in this chapter
  const activeCharacters = filterActiveCharacters(characters, chapterNode)
  if (activeCharacters.length === 0) return ''

  const evaluatedCharacters = evaluateCharacterTemplates(
    activeCharacters,
    messages,
    messageId,
    nodes,
    globalScript,
    forceRefresh,
  )

  const storyTime = chapterNode?.storyTime

  const characterElements = evaluatedCharacters
    .map((char) => {
      const name = getCharacterDisplayName(char)
      const role = char.isMainCharacter ? ' role="protagonist"' : ''

      // Build birthdate/age info if available (using the story's configured calendar)
      let ageInfo = ''
      if (char.birthdate != null && storyTime != null) {
        const birthDateStr = calendarStore.formatStoryTimeShort(char.birthdate)
        const ageYears = Math.floor(calendarStore.calculateAge(char.birthdate, storyTime))
        ageInfo = ` birthdate="${birthDateStr}" age="${ageYears}"`
      } else if (char.birthdate != null) {
        const birthDateStr = calendarStore.formatStoryTimeShort(char.birthdate)
        ageInfo = ` birthdate="${birthDateStr}"`
      }

      return `  <character name="${name}"${role}${ageInfo}>\n${char.description}\n  </character>`
    })
    .join('\n')

  return `<characters>\n${characterElements}\n</characters>\n`
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
  forceRefresh = false,
): Character[] {
  const activeCharacters = filterActiveCharacters(characters, chapterNode)
  if (activeCharacters.length === 0) {
    return []
  }

  return evaluateCharacterTemplates(activeCharacters, messages, messageId, nodes, globalScript, forceRefresh)
}

/**
 * Generate context items with evaluated templates in XML format
 * @param forceRefresh - If true, forces re-execution of scripts instead of using cache
 */
export function getTemplatedContextItems(
  contextItems: ContextItem[],
  messages: Message[],
  messageId: string,
  nodes: Node[],
  chapterNode: Node | undefined,
  globalScript?: string,
  forceRefresh = false,
): string {
  // Filter to only active context items in this chapter (or global items)
  const activeItems = filterActiveContextItems(contextItems, chapterNode)
  if (activeItems.length === 0) return ''

  const evaluatedItems = evaluateContextItemTemplates(
    activeItems,
    messages,
    messageId,
    nodes,
    globalScript,
    forceRefresh,
  )

  const contextElements = evaluatedItems
    .map((item) => `  <context-item name="${item.name}">\n${item.description}\n  </context-item>`)
    .join('\n')

  return `<world>\n${contextElements}\n</world>`
}

/**
 * Generate the current story date context
 * This should be placed after character and world context to avoid cache invalidation
 * Uses the story's configured calendar for formatting
 */
export function getStoryDateContext(chapterNode: Node | undefined): string {
  if (!chapterNode?.storyTime) return ''

  const formattedDate = calendarStore.formatStoryTime(chapterNode.storyTime)
  if (!formattedDate) return ''

  return `<current-date>${formattedDate}</current-date>\n`
}
