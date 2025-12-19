import { contentSchemaToText } from '../persistence/content-schema-to-html'
import { scenesState } from '../stores/scenes'
import { findPathToNode } from '../stores/tree'
import { uiState } from '../stores/ui'
import { extractSceneHighlights, needsHighlightsRegeneration } from './extractSceneHighlights'

type RecentContentSection = {
  text: string
  canCache: boolean
}

type SceneInfo = {
  id: string
  name: string
  chapter: string
  source: 'current' | 'previous' | 'previous-arc'
}

/**
 * Builds generation context using scene content for adjacent scenes and highlights for non-adjacent scenes
 * @param currentSceneId The current scene ID
 * @param availableScenes All available scenes that can be included in context
 * @param currentChapterScenes Scenes from the current chapter
 * @returns Content chunks to include in the generation context
 */
export async function buildGenerationContext(
  currentSceneId: string,
  availableScenes: SceneInfo[],
  _currentChapterScenes: { id: string }[],
): Promise<RecentContentSection[]> {
  const recentContentChunks: RecentContentSection[] = []
  const _currentScene = scenesState.scenes[currentSceneId]

  // Find current scene's position in the chapter
  const path = findPathToNode(currentSceneId)
  if (!path.length) return recentContentChunks

  const [_, __, chapterNode] = path
  const currentChapter = chapterNode?.children || []
  const currentSceneIndex = currentChapter.findIndex((s) => s.id === currentSceneId)

  // This will track scenes that are "directly preceding" the current scene
  // We'll include their full content rather than just highlights
  const precedingSceneIds = new Set<string>()

  // Get the directly preceding scene in the same chapter (if it exists)
  if (currentSceneIndex > 0) {
    const precedingSceneId = currentChapter[currentSceneIndex - 1]?.id
    if (precedingSceneId) {
      precedingSceneIds.add(precedingSceneId)
    }
  }

  // Track scenes we've already processed
  const processedScenes = new Set<string>()

  // Process remaining selected scenes in chronological order (oldest to most recent)

  // Group scenes by source
  const previousArcScenes = availableScenes.filter((s) => s.source === 'previous-arc')
  const previousChapterScenes = availableScenes.filter((s) => s.source === 'previous')
  const currentChapterScenesFromAvailable = availableScenes.filter((s) => s.source === 'current')

  // Process in order: previous arc (oldest) -> previous chapter -> current chapter (newest)

  // Previous arc scenes (oldest)
  for (const sceneInfo of previousArcScenes) {
    // Skip already processed scenes (those handled as preceding)
    if (!processedScenes.has(sceneInfo.id) && uiState.selectedChapterScenes[sceneInfo.id]) {
      await addSceneHighlights(sceneInfo.id, recentContentChunks)
    }
  }

  // Previous chapter scenes
  for (const sceneInfo of previousChapterScenes) {
    // Skip already processed scenes (those handled as preceding)
    if (!processedScenes.has(sceneInfo.id) && uiState.selectedChapterScenes[sceneInfo.id]) {
      await addSceneHighlights(sceneInfo.id, recentContentChunks)
    }
  }

  // Current chapter scenes (most recent)
  for (const sceneInfo of currentChapterScenesFromAvailable) {
    // Skip already processed scenes (those handled as preceding)
    if (precedingSceneIds.has(sceneInfo.id)) {
      await addFullSceneContent(sceneInfo.id, recentContentChunks)
      // Mark as processed
      processedScenes.add(sceneInfo.id)
    } else {
      if (!processedScenes.has(sceneInfo.id) && uiState.selectedChapterScenes[sceneInfo.id]) {
        await addSceneHighlights(sceneInfo.id, recentContentChunks)
      }
    }
  }

  return recentContentChunks
}

/**
 * Adds full scene content to the context chunks
 * @param sceneId Scene ID to add
 * @param contentChunks Array of content chunks to append to
 */
async function addFullSceneContent(sceneId: string, contentChunks: RecentContentSection[]): Promise<void> {
  const scene = scenesState.scenes[sceneId]
  if (!scene?.paragraphs?.length) return

  // Add scene header
  contentChunks.push({
    text: `<scene title="${scene.title}">\n`,
    canCache: false,
  })

  // Add content section
  contentChunks.push({
    text: '<content>\n',
    canCache: false,
  })

  const paragraphs = [...scene.paragraphs].reverse() // Newest first

  for (const paragraph of paragraphs) {
    contentChunks.push({
      text: `${typeof paragraph.text === 'string' ? paragraph.text : contentSchemaToText(paragraph.text)}\n\n`,
      canCache: false,
    })
  }

  // Close content section
  contentChunks.push({
    text: '</content>\n',
    canCache: false,
  })

  // Add scene footer
  contentChunks.push({
    text: '</scene>\n\n',
    canCache: false,
  })
}

/**
 * Adds scene highlights to the context chunks
 * @param sceneId Scene ID to add highlights for
 * @param contentChunks Array of content chunks to append to
 */
async function addSceneHighlights(sceneId: string, contentChunks: RecentContentSection[]): Promise<void> {
  const scene = scenesState.scenes[sceneId]
  if (!scene) return

  // Check if we need to generate/regenerate highlights
  if (needsHighlightsRegeneration(sceneId)) {
    await extractSceneHighlights(sceneId)
  }

  // Get the updated scene with highlights
  const updatedScene = scenesState.scenes[sceneId]

  // Start scene section
  contentChunks.push({
    text: `<scene title="${scene.title}">\n`,
    canCache: false,
  })

  if (updatedScene?.highlights?.length) {
    // Add highlights as a subsection of the scene
    contentChunks.push({
      text: `<highlights>\n${updatedScene.highlights
        .map((h) => `<highlight category="${h.category}">${h.text} (${h.importance})</highlight>`)
        .join('\n')}\n</highlights>\n\n`,
      canCache: false,
    })
  }

  // Always add scene summary if available
  if (scene.summary) {
    contentChunks.push({
      text: `<summary>${scene.summary}</summary>\n\n`,
      canCache: false,
    })
  } else {
    contentChunks.push({
      text: '<summary>No summary available.</summary>\n\n',
      canCache: false,
    })
  }

  // End scene section
  contentChunks.push({
    text: '</scene>\n\n',
    canCache: false,
  })
}
