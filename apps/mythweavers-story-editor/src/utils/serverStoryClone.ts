import type { Paragraph } from '@mythweavers/shared'
import {
  deleteMyStoriesById,
  patchMyStoriesById,
  postMyArcsByArcIdChapters,
  postMyBooksByBookIdArcs,
  postMyChaptersByChapterIdScenes,
  postMyStories,
  postMyStoriesByStoryIdBooks,
  postMyStoriesByStoryIdCharacters,
  postMyStoriesByStoryIdContextItems,
  postMyStoriesByStoryIdMessagesBatch,
} from '../client/config'
import type { Character, ContextItem, Message, Node } from '../types/core'
import { generateMessageId } from './id'

export interface StorySnapshot {
  name: string
  summary?: string | null
  messages?: Message[]
  characters?: Character[]
  contextItems?: ContextItem[]
  nodes?: Node[]
  storySetting?: string
  storyFormat?: 'narrative' | 'cyoa'
  paragraphsPerTurn?: number
  person?: 'first' | 'second' | 'third'
  tense?: 'present' | 'past'
  globalScript?: string
  selectedNodeId?: string | null
  branchChoices?: Record<string, string>
  timelineStartTime?: number | null
  timelineEndTime?: number | null
  timelineGranularity?: 'hour' | 'day'
  provider?: string
  model?: string | null
  aiOverrides?: unknown
}

const perspective = (value: StorySnapshot['person']) => value?.toUpperCase() as 'FIRST' | 'SECOND' | 'THIRD' | undefined
const tense = (value: StorySnapshot['tense']) => value?.toUpperCase() as 'PAST' | 'PRESENT' | undefined

const paragraphState = (paragraph: Paragraph): 'AI' | 'DRAFT' | 'REVISE' | 'FINAL' | 'SDT' | undefined =>
  paragraph.state?.toUpperCase() as 'AI' | 'DRAFT' | 'REVISE' | 'FINAL' | 'SDT' | undefined

/**
 * Copies a local/in-memory story into the normalized unified-backend schema.
 * IDs are remapped because node, message, character, and paragraph IDs are
 * globally unique and the source may itself be a server-backed story.
 */
export async function createServerStoryFromSnapshot(
  snapshot: StorySnapshot,
): Promise<{ id: string; updatedAt: string }> {
  const created = await postMyStories({
    body: {
      name: snapshot.name,
      summary: snapshot.summary ?? undefined,
      defaultPerspective: perspective(snapshot.person),
      defaultTense: tense(snapshot.tense),
      genre: snapshot.storySetting || undefined,
      paragraphsPerTurn: snapshot.paragraphsPerTurn,
      format: snapshot.storyFormat,
      provider: snapshot.provider,
      model: snapshot.model ?? undefined,
    },
  })
  const story = created.data?.story
  if (!story) throw new Error('The server did not return the newly created story')

  const storyId = story.id
  try {
    const characterIds = new Map<string, string>()
    for (const character of snapshot.characters ?? []) {
      const newId = generateMessageId()
      characterIds.set(character.id, newId)
      await postMyStoriesByStoryIdCharacters({
        path: { storyId },
        body: {
          id: newId,
          firstName: character.firstName,
          middleName: character.middleName ?? undefined,
          lastName: character.lastName ?? undefined,
          nickname: character.nickname ?? undefined,
          description: character.description ?? undefined,
          background: character.background ?? undefined,
          personality: character.personality ?? undefined,
          personalityQuirks: character.personalityQuirks ?? undefined,
          likes: character.likes ?? undefined,
          dislikes: character.dislikes ?? undefined,
          age: character.age ?? undefined,
          gender: character.gender ?? undefined,
          sexualOrientation: character.sexualOrientation ?? undefined,
          height: character.height ?? undefined,
          hairColor: character.hairColor ?? undefined,
          eyeColor: character.eyeColor ?? undefined,
          distinguishingFeatures: character.distinguishingFeatures ?? undefined,
          writingStyle: character.writingStyle ?? undefined,
          birthdate: character.birthdate ?? undefined,
          isMainCharacter: character.isMainCharacter,
        },
      })
    }

    const contextItemIds = new Map<string, string>()
    for (const item of snapshot.contextItems ?? []) {
      const result = await postMyStoriesByStoryIdContextItems({
        path: { storyId },
        body: {
          type: item.type,
          name: item.name,
          description: item.description,
          isGlobal: item.isGlobal,
        },
      })
      const newId = result.data?.contextItem.id
      if (!newId) throw new Error(`The server did not return the copied context item "${item.name}"`)
      contextItemIds.set(item.id, newId)
    }

    const nodes = snapshot.nodes ?? []
    const messages = snapshot.messages ?? []
    const nodeIds = new Map(nodes.map((node) => [node.id, generateMessageId()]))
    const messageIds = new Map(messages.map((message) => [message.id, generateMessageId()]))
    const nodesByType = (type: Node['type']) =>
      nodes.filter((node) => node.type === type).sort((a, b) => a.order - b.order)

    for (const node of nodesByType('book')) {
      await postMyStoriesByStoryIdBooks({
        path: { storyId },
        body: {
          id: nodeIds.get(node.id),
          name: node.title,
          sentenceSummary: node.sentenceSummary ?? undefined,
          paragraphSummary: node.paragraphSummary ?? undefined,
          summary: node.summary || undefined,
          nodeType: node.nodeType,
          sortOrder: node.order,
        },
      })
    }
    for (const node of nodesByType('arc')) {
      const bookId = node.parentId && nodeIds.get(node.parentId)
      if (!bookId) throw new Error(`Arc "${node.title}" has no copied parent book`)
      await postMyBooksByBookIdArcs({
        path: { bookId },
        body: {
          id: nodeIds.get(node.id),
          name: node.title,
          sentenceSummary: node.sentenceSummary ?? undefined,
          paragraphSummary: node.paragraphSummary ?? undefined,
          summary: node.summary || undefined,
          nodeType: node.nodeType,
          sortOrder: node.order,
        },
      })
    }
    for (const node of nodesByType('chapter')) {
      const arcId = node.parentId && nodeIds.get(node.parentId)
      if (!arcId) throw new Error(`Chapter "${node.title}" has no copied parent arc`)
      await postMyArcsByArcIdChapters({
        path: { arcId },
        body: {
          id: nodeIds.get(node.id),
          name: node.title,
          sentenceSummary: node.sentenceSummary ?? undefined,
          paragraphSummary: node.paragraphSummary ?? undefined,
          summary: node.summary || undefined,
          nodeType: node.nodeType,
          sortOrder: node.order,
          status: node.status,
        },
      })
    }
    for (const node of nodesByType('scene')) {
      const chapterId = node.parentId && nodeIds.get(node.parentId)
      if (!chapterId) throw new Error(`Scene "${node.title}" has no copied parent chapter`)
      await postMyChaptersByChapterIdScenes({
        path: { chapterId },
        body: {
          id: nodeIds.get(node.id),
          name: node.title,
          sentenceSummary: node.sentenceSummary ?? undefined,
          paragraphSummary: node.paragraphSummary ?? undefined,
          summary: node.summary || undefined,
          summarySegments:
            node.summarySegments?.map((segment) => ({
              ...segment,
              startMessageId: messageIds.get(segment.startMessageId) ?? segment.startMessageId,
              endMessageId: messageIds.get(segment.endMessageId) ?? segment.endMessageId,
            })) ?? undefined,
          sortOrder: node.order,
          status: node.status,
          includeInFull: node.includeInFull,
          perspective: node.perspective,
          viewpointCharacterId: node.viewpointCharacterId ? characterIds.get(node.viewpointCharacterId) : undefined,
          activeCharacterIds: node.activeCharacterIds?.flatMap((id) => characterIds.get(id) ?? []),
          activeContextItemIds: node.activeContextItemIds?.flatMap((id) => contextItemIds.get(id) ?? []),
          goal: node.goal,
          storyTime: node.storyTime,
        },
      })
    }

    const copiedMessages = messages.map((message) => {
      const sceneId = message.sceneId && nodeIds.get(message.sceneId)
      if (!sceneId) throw new Error(`Message ${message.id} is not attached to a copied scene`)
      return {
        id: messageIds.get(message.id),
        sceneId,
        sortOrder: message.order,
        instruction: message.instruction ?? null,
        script: message.script ?? null,
        type: message.type ?? null,
        options: message.options?.map((option) => ({
          ...option,
          targetNodeId: nodeIds.get(option.targetNodeId) ?? option.targetNodeId,
          targetMessageId: messageIds.get(option.targetMessageId) ?? option.targetMessageId,
        })),
        paragraphs: (message.paragraphs?.length
          ? message.paragraphs
          : ([{ id: generateMessageId(), body: message.content, state: 'draft', comments: [] }] satisfies Paragraph[])
        ).map((paragraph, index) => ({
          id: generateMessageId(),
          body: paragraph.body,
          contentSchema: paragraph.contentSchema ?? null,
          state: paragraphState(paragraph),
          sortOrder: index,
        })),
      }
    })

    for (let index = 0; index < copiedMessages.length; index += 1000) {
      await postMyStoriesByStoryIdMessagesBatch({
        path: { storyId },
        body: { messages: copiedMessages.slice(index, index + 1000) },
      })
    }

    const remappedBranchChoices = snapshot.branchChoices
      ? Object.fromEntries(
          Object.entries(snapshot.branchChoices).map(([messageId, optionId]) => [
            messageIds.get(messageId) ?? messageId,
            optionId,
          ]),
        )
      : undefined
    const updated = await patchMyStoriesById({
      path: { id: storyId },
      body: {
        globalScript: snapshot.globalScript ?? null,
        selectedNodeId: snapshot.selectedNodeId ? (nodeIds.get(snapshot.selectedNodeId) ?? null) : null,
        branchChoices: remappedBranchChoices,
        timelineStartTime: snapshot.timelineStartTime,
        timelineEndTime: snapshot.timelineEndTime,
        timelineGranularity: snapshot.timelineGranularity,
        aiOverrides: snapshot.aiOverrides,
      },
    })

    return { id: storyId, updatedAt: updated.data?.story.updatedAt ?? story.updatedAt }
  } catch (error) {
    await deleteMyStoriesById({ path: { id: storyId } }).catch(() => undefined)
    throw error
  }
}
