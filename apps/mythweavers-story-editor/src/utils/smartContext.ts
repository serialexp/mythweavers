import { Character, ContextItem, Message, SceneAnalysis } from '../types/core'
import { getCharacterDisplayName } from './character'
import { generateMessageId } from './id'

interface InputAnalysis {
  mentionedCharacters: string[]
  mentionedLocations: string[]
  themes: string[]
}

interface StoryBeatContext {
  message: Message
  sceneAnalysis: SceneAnalysis
  relevanceScore: number // Deterministic relevance score (0-10)
  positionFromEnd: number // How many beats ago this occurred
  temporalWeight: number // Combined relevance + recency score
}

interface KnownEntities {
  characters: string[]
  themes: string[]
  locations: string[]
}

interface NewEntityDiscovery {
  newCharacters: string[]
  newThemes: string[]
  newLocations: string[]
}

/**
 * Extract known entities from existing stores
 */
export const extractKnownEntities = (characters: Character[], contextItems: ContextItem[]): KnownEntities => {
  const safeCharacters = characters || []
  const safeContextItems = contextItems || []

  return {
    characters: safeCharacters.map((c) => (c ? getCharacterDisplayName(c) : null)).filter(Boolean) as string[],
    themes: safeContextItems
      .filter((item) => item?.type === 'theme')
      .map((item) => item?.name)
      .filter(Boolean),
    locations: safeContextItems
      .filter((item) => item?.type === 'location')
      .map((item) => item?.name)
      .filter(Boolean),
  }
}

/**
 * Detect new entities discovered in scene analysis
 */
export const detectNewEntities = (sceneAnalysis: SceneAnalysis, knownEntities: KnownEntities): NewEntityDiscovery => {
  const newCharacters = Object.keys(sceneAnalysis.characterRelevance).filter(
    (char) => !knownEntities.characters.includes(char),
  )

  const newThemes = Object.keys(sceneAnalysis.themeRelevance).filter((theme) => !knownEntities.themes.includes(theme))

  const newLocations = sceneAnalysis.locations.filter((location) => !knownEntities.locations.includes(location))

  return {
    newCharacters,
    newThemes,
    newLocations,
  }
}

/**
 * Add discovered entities to the appropriate stores
 */
export const addDiscoveredEntitiesToStores = (
  characterDescriptions: Record<string, string>,
  themeDescriptions: Record<string, string>,
  locationDescriptions: Record<string, string>,
  addCharacterFn: (character: Character) => void,
  addContextItemFn: (item: ContextItem) => void,
  existingCharacters: Character[],
  existingContextItems: ContextItem[],
) => {
  // Add new characters
  Object.entries(characterDescriptions).forEach(([name, description]) => {
    const exists = existingCharacters.some((char) => getCharacterDisplayName(char) === name)
    if (!exists) {
      const newCharacter: Character = {
        id: generateMessageId(),
        firstName: name,
        description,
        isMainCharacter: false,
      }
      addCharacterFn(newCharacter)
      console.log(`Discovered new character: ${name}`)
    }
  })

  // Add new themes
  Object.entries(themeDescriptions).forEach(([name, description]) => {
    const exists = existingContextItems.some((item) => item.type === 'theme' && item.name === name)
    if (!exists) {
      const newTheme: ContextItem = {
        id: generateMessageId(),
        name,
        description,
        isGlobal: false,
        type: 'theme',
      }
      addContextItemFn(newTheme)
      console.log(`Discovered new theme: ${name}`)
    }
  })

  // Add new locations
  Object.entries(locationDescriptions).forEach(([name, description]) => {
    const exists = existingContextItems.some((item) => item.type === 'location' && item.name === name)
    if (!exists) {
      const newLocation: ContextItem = {
        id: generateMessageId(),
        name,
        description,
        isGlobal: false,
        type: 'location',
      }
      addContextItemFn(newLocation)
      console.log(`Discovered new location: ${name}`)
    }
  })
}

/**
 * Generate descriptions for newly discovered entities
 */
export const generateEntityDescriptions = async (
  newEntities: NewEntityDiscovery,
  storyContent: string,
  generateFn: (prompt: string) => Promise<string>,
): Promise<{
  characterDescriptions: Record<string, string>
  themeDescriptions: Record<string, string>
  locationDescriptions: Record<string, string>
}> => {
  const results = {
    characterDescriptions: {} as Record<string, string>,
    themeDescriptions: {} as Record<string, string>,
    locationDescriptions: {} as Record<string, string>,
  }

  // Generate character descriptions
  for (const character of newEntities.newCharacters) {
    try {
      const prompt = `Based on this story segment, describe the character "${character}":

Story segment: "${storyContent}"

If the character has substantial presence or development, write a two-sentence description based only on what is directly shown or stated. If the character only has brief dialogue or minimal presence, write just a few words describing their relation (e.g., "Classmate of Ren", "Ren's teacher", "Store clerk"). Do not make assumptions about their personality, habits, or typical behavior based on a single interaction. Stick to observable facts only. If there's no clear relation, return an empty response. Output ONLY the description with no extra commentary, labels, or formatting.`

      const description = await generateFn(prompt)
      const trimmedDescription = description.trim()

      // Only add characters with meaningful descriptions
      if (trimmedDescription.length > 0) {
        results.characterDescriptions[character] = trimmedDescription
      }
    } catch (error) {
      console.warn(`Failed to generate description for character ${character}:`, error)
      // Don't add characters with failed description generation
    }
  }

  // Generate theme descriptions
  for (const theme of newEntities.newThemes) {
    try {
      const prompt = `Based on this story segment, write a two-sentence description of the theme "${theme}":

Story segment: "${storyContent}"

Output ONLY the two-sentence description with no extra commentary, labels, or formatting. Do not include phrases like "Here's a description" or similar.`

      const description = await generateFn(prompt)
      results.themeDescriptions[theme] = description.trim()
    } catch (error) {
      console.warn(`Failed to generate description for theme ${theme}:`, error)
      results.themeDescriptions[theme] = `A thematic element of ${theme} present in the story.`
    }
  }

  // Generate location descriptions
  for (const location of newEntities.newLocations) {
    try {
      const prompt = `Based on this story segment, write a two-sentence description of the location "${location}":

Story segment: "${storyContent}"

Describe what this place looks like and its physical characteristics objectively. Do not explain its significance to the story. Output ONLY the two-sentence description with no extra commentary, labels, or formatting.`

      const description = await generateFn(prompt)
      results.locationDescriptions[location] = description.trim()
    } catch (error) {
      console.warn(`Failed to generate description for location ${location}:`, error)
      results.locationDescriptions[location] = `A location called ${location} that appears in the story.`
    }
  }

  return results
}

/**
 * Analyze user input to extract mentioned entities and themes
 */
export const analyzeUserInput = async (
  inputText: string,
  generateFn: (prompt: string) => Promise<string>,
): Promise<InputAnalysis> => {
  const prompt = `Analyze this user direction and extract:
1. Characters mentioned (names only, ONE CHARACTER PER LINE)
2. Locations mentioned (places only, ONE LOCATION PER LINE)  
3. Themes or topics (brief phrases, ONE THEME PER LINE)

User direction: "${inputText}"

Format your response as:
Characters:
- [name]
- [name]

Locations:
- [place]
- [place]

Themes:
- [theme]
- [theme]

IMPORTANT: Put each character, location, and theme on its own separate line with a dash. Do NOT combine multiple names with slashes or commas.`

  try {
    const response = await generateFn(prompt)
    return parseInputAnalysis(response)
  } catch (error) {
    console.warn('Failed to analyze user input:', error)
    return { mentionedCharacters: [], mentionedLocations: [], themes: [] }
  }
}

/**
 * Analyze a story beat to extract scene information with granular relevance
 */
export const analyzeStoryBeat = async (
  message: Message,
  knownEntities: KnownEntities,
  generateFn: (prompt: string) => Promise<string>,
): Promise<SceneAnalysis> => {
  const prompt = `Analyze this story segment for character and theme relevance:

Story segment: "${message.content}"

Known characters: ${knownEntities.characters.join(', ') || 'none yet'}
Known themes: ${knownEntities.themes.join(', ') || 'none yet'}
Known locations: ${knownEntities.locations.join(', ') || 'none yet'}

For each character that appears or is mentioned, rate their relevance to this scene:
For each theme that is present, rate its relevance to this scene:
Rate overall importance of this scene.

Format your response as:
Locations: [list each distinct location/place, separated by commas. If multiple locations are present, list them all]
Characters:
- [name]: High/Medium/Low
- [name]: High/Medium/Low
Themes:
- [theme]: High/Medium/Low  
- [theme]: High/Medium/Low
Overall: High/Medium/Low: [brief explanation]

Use known entities when possible for consistency.`

  try {
    const response = await generateFn(prompt)
    return parseSceneAnalysisGranular(response)
  } catch (error) {
    console.warn('Failed to analyze story beat:', error)
    throw error // Re-throw so caller can handle it properly
  }
}

/**
 * Deterministically score how relevant a story beat is to the current input
 */
export const scoreRelevanceToInput = (sceneAnalysis: SceneAnalysis, inputAnalysis: InputAnalysis): number => {
  let score = 0

  // Character relevance scoring (0-4 points)
  const characterMatches = inputAnalysis.mentionedCharacters.filter((char) => sceneAnalysis.characterRelevance[char])
  for (const char of characterMatches) {
    const relevance = sceneAnalysis.characterRelevance[char]
    score += relevance === 'high' ? 2 : relevance === 'medium' ? 1.5 : 1
  }

  // Theme relevance scoring (0-3 points)
  const themeMatches = inputAnalysis.themes.filter((theme) => sceneAnalysis.themeRelevance[theme])
  for (const theme of themeMatches) {
    const relevance = sceneAnalysis.themeRelevance[theme]
    score += relevance === 'high' ? 1.5 : relevance === 'medium' ? 1 : 0.5
  }

  // Location relevance scoring (0-2 points)
  if (inputAnalysis.mentionedLocations.some((loc) => sceneAnalysis.locations.includes(loc))) {
    score += 2
  }

  // Overall importance bonus (0-1 points)
  const importanceBonus =
    sceneAnalysis.overallImportance === 'high' ? 1 : sceneAnalysis.overallImportance === 'medium' ? 0.5 : 0
  score += importanceBonus

  return Math.min(10, score) // Cap at 10
}

/**
 * Main function to build smart context using parallel analysis
 * Returns array of messages to include in context (not concatenated string)
 */
export const buildSmartContext = async (
  inputText: string,
  messages: Message[],
  characters: Character[],
  contextItems: ContextItem[],
  generateFn: (prompt: string) => Promise<string>,
  _targetMessageId?: string,
  _forceMissingSummaries = false,
): Promise<Message[]> => {
  const storyMessages = messages.filter((msg) => !msg.isQuery && msg.role === 'assistant' && msg.type !== 'chapter')

  if (storyMessages.length === 0) {
    return []
  }

  // Use all story messages for smart context analysis
  const recentBeats = storyMessages

  try {
    // First analyze the user input
    const inputAnalysis = await analyzeUserInput(inputText, generateFn)

    // Get known entities for consistency
    const knownEntities = extractKnownEntities(characters, contextItems)

    // Analyze story beats that don't have cached analysis
    const sceneAnalyses = await Promise.all(
      recentBeats.map((beat) =>
        beat.sceneAnalysis ? Promise.resolve(beat.sceneAnalysis) : analyzeStoryBeat(beat, knownEntities, generateFn),
      ),
    )

    // Combine scene analysis with relevance scores and calculate temporal positioning
    const contextBeats: StoryBeatContext[] = recentBeats.map((message, index) => {
      const positionFromEnd = recentBeats.length - index // How many beats ago (1 = most recent)
      const sceneAnalysis = sceneAnalyses[index]

      // Calculate deterministic relevance score
      const relevanceScore = scoreRelevanceToInput(sceneAnalysis, inputAnalysis)

      // Enhanced recency scoring - more aggressive decay for older content
      const recencyBonus =
        positionFromEnd === 1
          ? 2.0
          : // Most recent gets major boost
            positionFromEnd === 2
            ? 1.5
            : // Second most recent gets good boost
              positionFromEnd <= 5
              ? 1.0 - (positionFromEnd - 2) * 0.2
              : // Linear decay for next 3
                Math.max(0.1, 1.0 - (positionFromEnd - 1) / 8) // Gentle decay for rest, min 0.1

      const temporalWeight = relevanceScore + recencyBonus

      return {
        message,
        sceneAnalysis,
        relevanceScore,
        positionFromEnd,
        temporalWeight,
      }
    })

    // Sort by temporal weight (relevance + recency combined)
    const sortedBeats = contextBeats.sort((a, b) => {
      return b.temporalWeight - a.temporalWeight
    })

    // Debug logging to understand selection
    console.log(
      'Smart context selection:',
      sortedBeats.map((beat) => ({
        position: beat.positionFromEnd,
        relevanceScore: beat.relevanceScore.toFixed(2),
        temporalWeight: beat.temporalWeight.toFixed(2),
        preview: `${beat.message.content.substring(0, 50)}...`,
      })),
    )

    // Build context with temporal markers
    const relevantBeats = sortedBeats
      .filter(
        (beat) => beat.relevanceScore >= 2, // Include beats with score 2 or higher
      )
      .slice(0, 6)

    // Always include the last 2 beats regardless of relevance for continuity
    const lastTwoBeats = storyMessages.slice(-2)
    const lastTwoContextBeats = contextBeats.filter((beat) => lastTwoBeats.some((msg) => msg.id === beat.message.id))

    // Combine and deduplicate, preserving the best version of each
    const allSelectedBeats = new Map<string, StoryBeatContext>()

    // Add relevant beats first
    relevantBeats.forEach((beat) => {
      allSelectedBeats.set(beat.message.id, beat)
    })

    // Add last two beats (will override if already present)
    lastTwoContextBeats.forEach((beat) => {
      allSelectedBeats.set(beat.message.id, beat)
    })

    // Sort final selection by actual story order (not relevance)
    const finalBeats = Array.from(allSelectedBeats.values()).sort(
      (a, b) => a.message.timestamp.getTime() - b.message.timestamp.getTime(),
    )

    // Return the selected messages
    return finalBeats.map((beat) => beat.message)
  } catch (error) {
    console.error('Smart context analysis failed:', error)

    // Fallback to simple recent messages
    return storyMessages.slice(-5)
  }
}

/**
 * Parse the input analysis response
 */
function parseInputAnalysis(response: string): InputAnalysis {
  const sections = response.split(/Characters:|Locations:|Themes:/)

  const parseList = (text: string): string[] => {
    return text
      .split('\n')
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 0)
      .flatMap((line) => line.split('/').map((item) => item.trim()))
      .filter((item) => item.length > 0)
  }

  return {
    mentionedCharacters: sections[1] ? parseList(sections[1]) : [],
    mentionedLocations: sections[2] ? parseList(sections[2]) : [],
    themes: sections[3] ? parseList(sections[3]) : [],
  }
}

/**
 * Parse the granular scene analysis response
 */
function parseSceneAnalysisGranular(response: string): SceneAnalysis {
  const locationMatch = response.match(/Locations?:\s*(.+)/i)
  const charactersSection = response.match(/Characters:\s*([\s\S]*?)(?=Themes:|Overall:|$)/i)
  const themesSection = response.match(/Themes:\s*([\s\S]*?)(?=Overall:|$)/i)
  const overallMatch = response.match(/Overall:\s*(High|Medium|Low):\s*(.+)/i)

  // Parse character relevance
  const characterRelevance: Record<string, 'high' | 'medium' | 'low'> = {}
  if (charactersSection?.[1]) {
    const charLines = charactersSection[1]
      .split('\n')
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 0)

    for (const line of charLines) {
      const match = line.match(/^(.+?):\s*(High|Medium|Low)/i)
      if (match) {
        const name = match[1].trim()
        const relevance = match[2].toLowerCase() as 'high' | 'medium' | 'low'
        characterRelevance[name] = relevance
      }
    }
  }

  // Parse theme relevance
  const themeRelevance: Record<string, 'high' | 'medium' | 'low'> = {}
  if (themesSection?.[1]) {
    const themeLines = themesSection[1]
      .split('\n')
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 0)

    for (const line of themeLines) {
      const match = line.match(/^(.+?):\s*(High|Medium|Low)/i)
      if (match) {
        const theme = match[1].trim()
        const relevance = match[2].toLowerCase() as 'high' | 'medium' | 'low'
        themeRelevance[theme] = relevance
      }
    }
  }

  // Parse locations into array
  const locationString = locationMatch?.[1]?.trim() || 'unknown'
  const locations =
    locationString !== 'unknown'
      ? locationString
          .split(',')
          .map((loc) => loc.trim())
          .filter((loc) => loc.length > 0)
      : []

  return {
    locations,
    characterRelevance,
    themeRelevance,
    overallImportance: (overallMatch?.[1]?.toLowerCase() as 'high' | 'medium' | 'low') || 'low',
    explanation: overallMatch?.[2]?.trim() || 'No explanation provided',
  }
}
