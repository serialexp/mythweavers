import type { Paragraph } from '@mythweavers/shared'
import { getMyNodesByIdContent } from '../client/config'
import type { Message } from '../types/core'
import { messagesStore } from './messagesStore'

/**
 * Session cache for server-backed scene prose. The navigation tree is hydrated
 * independently, so this store only owns the prose that has actually been
 * opened. Requests are keyed by story+scene to prevent a late response from a
 * previous story contaminating the current editor.
 */
let storyId: string | null = null
let generation = 0
const loadedScenes = new Set<string>()
const scriptLoadedScenes = new Set<string>()
const inFlight = new Map<string, Promise<void>>()
const failures = new Map<string, string>()

export function contentMessagesFromNodeResponse(response: any): Message[] {
  const messages: Message[] = []
  for (const chapter of response.chapters ?? []) {
    for (const scene of chapter.scenes ?? []) {
      for (const message of scene.messages ?? []) {
        const paragraphs: Paragraph[] = (message.paragraphs ?? []).map((paragraph: any) => ({
          id: paragraph.id,
          body: paragraph.body,
          contentSchema: paragraph.contentSchema ?? null,
          state: (paragraph.state ?? 'draft').toLowerCase(),
          comments: [],
          plotPointActions: paragraph.plotPointActions ?? [],
          inventoryActions: paragraph.inventoryActions ?? [],
          script: paragraph.script ?? undefined,
        }))
        messages.push({
          id: message.id,
          role: 'assistant',
          content: paragraphs.map((paragraph) => paragraph.body).join('\n\n'),
          paragraphs,
          instruction: message.instruction ?? undefined,
          script: message.script ?? undefined,
          timestamp: new Date(message.createdAt),
          order: message.sortOrder,
          sceneId: scene.id,
          currentMessageRevisionId: message.currentMessageRevisionId,
          isQuery: message.isQuery,
          think: message.revision?.think ?? undefined,
          model: message.revision?.model ?? undefined,
          tokensPerSecond: message.revision?.tokensPerSecond ?? undefined,
          totalTokens: message.revision?.totalTokens ?? undefined,
          promptTokens: message.revision?.promptTokens ?? undefined,
          cacheCreationTokens: message.revision?.cacheCreationTokens ?? undefined,
          cacheReadTokens: message.revision?.cacheReadTokens ?? undefined,
          type: message.type ?? undefined,
          options: message.options ?? undefined,
          backgroundFileId: message.backgroundFileId ?? undefined,
          backgroundFile: message.backgroundFile ?? undefined,
          audioFileId: message.audioFileId ?? undefined,
          audioFile: message.audioFile ?? undefined,
        })
      }
    }
  }
  return messages
}

export const serverSceneContentStore = {
  beginStory(nextStoryId: string) {
    storyId = nextStoryId
    generation += 1
    loadedScenes.clear()
    scriptLoadedScenes.clear()
    inFlight.clear()
    failures.clear()
  },

  clear() {
    storyId = null
    generation += 1
    loadedScenes.clear()
    scriptLoadedScenes.clear()
    inFlight.clear()
    failures.clear()
  },

  isLoaded(sceneId: string) {
    return loadedScenes.has(sceneId)
  },

  isScriptLoaded(sceneId: string) {
    return loadedScenes.has(sceneId) || scriptLoadedScenes.has(sceneId)
  },

  getError(sceneId: string) {
    return failures.get(sceneId) ?? null
  },

  async load(sceneId: string, force = false, scriptsOnly = false, includePreceding = false): Promise<void> {
    if (!storyId) return
    if (!force && (loadedScenes.has(sceneId) || (scriptsOnly && scriptLoadedScenes.has(sceneId)))) return
    const requestKey = `${sceneId}:${scriptsOnly ? 'scripts' : 'content'}:${includePreceding ? 'preceding' : 'single'}`
    const existing = inFlight.get(requestKey)
    if (existing) return existing

    const requestStoryId = storyId
    const requestGeneration = generation
    let request: Promise<void>
    request = (async () => {
      try {
        const { data } = await getMyNodesByIdContent({
          path: { id: sceneId },
          query: { maxWords: 100_000, includeAllMessages: true, scriptsOnly, includePreceding },
        })
        if (!data || storyId !== requestStoryId || generation !== requestGeneration) return
        const responseMessages = contentMessagesFromNodeResponse(data)
        const sceneIds = includePreceding
          ? (data.chapters ?? []).flatMap((chapter) => (chapter.scenes ?? []).map((scene) => scene.id))
          : [sceneId]
        for (const responseSceneId of sceneIds) {
          messagesStore.replaceSceneMessages(
            responseSceneId,
            responseMessages.filter((message) => message.sceneId === responseSceneId),
            !scriptsOnly,
          )
          if (scriptsOnly) scriptLoadedScenes.add(responseSceneId)
          else {
            loadedScenes.add(responseSceneId)
            scriptLoadedScenes.add(responseSceneId)
          }
          failures.delete(responseSceneId)
        }
      } catch (error) {
        if (storyId === requestStoryId && generation === requestGeneration) {
          failures.set(sceneId, error instanceof Error ? error.message : 'Failed to load scene content')
        }
        throw error
      } finally {
        inFlight.delete(requestKey)
      }
    })()
    inFlight.set(requestKey, request)
    return request
  },
}
