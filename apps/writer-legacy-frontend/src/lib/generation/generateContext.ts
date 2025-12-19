import { contentSchemaToText } from '@writer/shared'
import { booksStore } from '../stores/books'
import { chaptersState } from '../stores/chapters'
import { charactersState } from '../stores/characters'
import { locationsState } from '../stores/locations'
import { scenesState } from '../stores/scenes'
import { findPathToNode, getContextNodes, getItemsInOrderContainedInId } from '../stores/tree'

type InputSection = {
  text: string
  canCache: boolean
}

type TextSection = {
  text: string
}

// store cached indexes by sceneId
const cachedIndexes: Record<string, number[]> = {}

// Function to generate and show the prompt preview
// Helper function to generate context for both preview and final generation
export const generateContext = async (
  sceneId: string,
  options: {
    instruction: string
  },
): Promise<{
  inputSections: InputSection[]
} | null> => {
  const scene = scenesState.scenes[sceneId]
  if (!scene) return null

  const [bookNode, _arcNode, chapterNode, _sceneNode] = findPathToNode(sceneId)

  // Get all scenes from current chapter
  const currentChapterScenes =
    chapterNode.children?.map((scene) => {
      return scenesState.scenes[scene.id]
    }) ?? []

  const allChapters = getItemsInOrderContainedInId('chapter', bookNode.id, {
    onlyStoryNodes: true,
  })
  const currentChapterIndex = allChapters.findIndex((c) => c.id === chapterNode.id)
  const lastChapterIndex = currentChapterIndex - 1

  // Build context based on selected scenes and their highlights
  const recentContentChunks: InputSection[] = []

  // Traditional mode - use full scene content for everything
  const allParagraphs: TextSection[] = []

  // Get summary of the whole book
  allParagraphs.push({
    text: booksStore.books[bookNode.id].summary
      ? `<book_summary>${booksStore.books[bookNode.id].summary}</book_summary>`
      : `No Summary for book ${bookNode.name}!`,
  })

  // Get summaries from all chapters
  for (const chapter of allChapters.slice(0, currentChapterIndex - 3)) {
    allParagraphs.push({
      text: chaptersState.chapters[chapter.id].summary
        ? `<chapter title="${chapter.name}">${chaptersState.chapters[chapter.id].summary}</chapter>`
        : `No Summary for chapter ${chapter.name}!`,
    })
  }

  // Get summaries from scenes in previous two chapters
  const previousTwoChapters = allChapters.slice(currentChapterIndex - 3, currentChapterIndex - 1)
  for (const chapter of previousTwoChapters) {
    const chapterScenes = chapter.children?.map((scene) => scenesState.scenes[scene.id]) ?? []
    for (const scene of chapterScenes) {
      allParagraphs.push({
        text: scene.summary
          ? `<scene title="${scene.title}">${scene.summary}</scene>`
          : `No Summary for scene ${scene.title}!`,
      })
    }
  }

  // Get content from previous chapter regardless of arc
  if (currentChapterIndex > 0) {
    const previousChapter = allChapters[lastChapterIndex]
    const chapterScenes = previousChapter.children?.map((scene) => scenesState.scenes[scene.id]) ?? []
    for (const scene of chapterScenes) {
      allParagraphs.push(
        ...scene.paragraphs.map((p) => ({
          text: typeof p.text === 'string' ? p.text : contentSchemaToText(p.text),
        })),
      )
    }
  }

  // Add current chapter's content
  for (const scene of currentChapterScenes) {
    if (scene?.paragraphs) {
      allParagraphs.push(
        ...scene.paragraphs.map((p) => ({
          text: typeof p.text === 'string' ? p.text : contentSchemaToText(p.text),
        })),
      )
    }
    // break when we hit the selected scene (regardless of whether there are scenes after it)
    if (scene.id === sceneId) {
      break
    }
  }

  if (!cachedIndexes[sceneId]) {
    cachedIndexes[sceneId] = []
  }
  for (let i = 0; i < allParagraphs.length; i++) {
    const paragraph = allParagraphs[i]
    const cachedIndexesEmpty = cachedIndexes[sceneId].length === 0
    const isIndexCached = cachedIndexes[sceneId].includes(i)

    recentContentChunks.push({
      text: paragraph.text,
      canCache: isIndexCached || (cachedIndexesEmpty && allParagraphs.length - 1 === i),
    })
  }

  const lastIndex = allParagraphs.length - 1
  cachedIndexes[sceneId].push(lastIndex)
  // keep only the last 3 elements in the array
  cachedIndexes[sceneId] = cachedIndexes[sceneId].slice(-3)

  console.log({
    paragraphCount: allParagraphs.length,
    cachedIndexes: cachedIndexes[sceneId],
  })

  // Build character and location context
  const characterLines: string[] = []
  const protagonist = scene.protagonistId ? charactersState.characters[scene.protagonistId] : undefined
  if (protagonist) {
    // Add comprehensive character information for the protagonist
    const protagonistDetails = [
      `<name>${protagonist.firstName} ${protagonist.lastName || ''}</name>`,
      `<personality>${protagonist.personality || 'Not provided'}</personality>`,
      `<personality_quirks>${protagonist.personalityQuirks || 'Not provided'}</personality_quirks>`,
      `<likes>${protagonist.likes || 'Not provided'}</likes>`,
      `<dislikes>${protagonist.dislikes || 'Not provided'}</dislikes>`,
      `<background>${protagonist.background || 'Not provided'}</background>`,
      `<distinguishing_features>${protagonist.distinguishingFeatures || 'Not provided'}</distinguishing_features>`,
      `<age>${protagonist.age || 'Not provided'}</age>`,
      `<gender>${protagonist.gender || 'Not provided'}</gender>`,
      `<sexual_orientation>${protagonist.sexualOrientation || 'Not provided'}</sexual_orientation>`,
    ]
      .filter((line) => !line.endsWith('Not provided'))
      .join('\n')

    if (protagonistDetails) {
      characterLines.push(`<protagonist_details>${protagonistDetails}</protagonist_details>`)
    }
    if (protagonist.writingStyle && scene.perspective === 'first') {
      characterLines.push(`<protagonist_writing_style>${protagonist.writingStyle}</protagonist_writing_style>`)
    }
  }
  for (const charId of scene?.characterIds ?? []) {
    const char = charactersState.characters[charId]
    if (!char) continue

    // Basic character info for present characters
    const charText = `${[char.firstName, char.middleName, char.lastName]
      .filter(Boolean)
      .join(' ')} (${char.age} years old): ${char.personality}`
    characterLines.push(`<present_character>${charText}</present_character>`)
  }
  for (const charId of scene?.referredCharacterIds ?? []) {
    const char = charactersState.characters[charId]
    if (!char) continue

    // Basic character info for referred characters
    const charText = `${[char.firstName, char.middleName, char.lastName]
      .filter(Boolean)
      .join(' ')}: ${char.personality}`
    characterLines.push(`<referred_character>${charText}</referred_character>`)
  }

  const locationLines: string[] = []
  if (scene?.locationId) {
    locationLines.push(`<current_location>${locationsState.locations[scene.locationId].description}</current_location>`)
  }

  const contextNodes = getContextNodes()
  // const storyNodes = getStoryNodes();

  // Add selected context nodes
  const contextNodeIds = scene?.selectedContextNodes ?? []
  const contextNodeLines: string[] = []
  for (const nodeId of contextNodeIds) {
    const contextNode = contextNodes.find((node) => node.id === nodeId)

    if (contextNode) {
      const sceneData = scenesState.scenes[contextNode.id]
      const content = sceneData.paragraphs
        .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
        .join('\n')
      contextNodeLines.push(`<context name="${contextNode.name}">${content}</context>`)
    }

    // const storyNode = storyNodes.find((node) => node.id === nodeId);
    // if (storyNode) {
    //   const sceneData = scenesState.scenes[storyNode.id];
    //   const content = sceneData.paragraphs
    //     .map((p) =>
    //       typeof p.text === "string" ? p.text : contentSchemaToText(p.text),
    //     )
    //     .join("\n");
    //   contextNodeLines.push(
    //     `<story_node_context name="${storyNode.name}">${content}</story_node_context>`,
    //   );
    // }
  }

  const sceneContext = {
    text: [
      '<scene_setup>',
      characterLines.join('\n'),
      locationLines.join('\n'),
      '</scene_setup>',
      contextNodeLines.length > 0 ? contextNodeLines.join('\n') : '',
      `<perspective>${scene.perspective === 'first' ? `Write in first person from ${protagonist?.firstName}'s perspective` : 'Write in third person from an omniscient perspective'}</perspective>`,
    ]
      .filter(Boolean)
      .join('\n'),
    canCache: true,
  }

  const result: InputSection[] = [
    ...recentContentChunks,
    sceneContext,
    {
      text: options.instruction,
      canCache: false,
    },
  ]

  console.log({
    result,
  })

  return {
    inputSections: result,
  }
}
