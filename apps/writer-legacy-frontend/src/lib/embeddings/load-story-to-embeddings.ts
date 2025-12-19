import type { Document } from '@langchain/core/documents'
import { contentSchemaToText } from '../persistence/content-schema-to-html.ts'
import { charactersState } from '../stores/characters.ts'
import { locationsState } from '../stores/locations.ts'
import { scenesState } from '../stores/scenes.ts'
import { storyState } from '../stores/story.ts'
import { findNode } from '../stores/tree.ts'
import { addDocuments, removeDocuments } from './embedding-store.ts'

const addCache = new Set<string>()

export const removeEntityFromEmbeddingsCache = (entityId: string) => {
  addCache.delete(entityId)
  removeDocuments([entityId]).catch((error) => {
    console.error('Error removing entity from embeddings', error)
  })
}

export type ParagraphEmbeddingMetadata = {
  sceneId: string
  paragraphId: string
  storyId: string
  kind: 'content'
}

export type CharacterEmbeddingMetadata =
  | {
      characterId: string
      storyId: string
      kind: 'context'
      aspect: 'profile' | 'action'
    }
  | {
      characterId: string
      storyId: string
      sceneId: string
      kind: 'context'
      aspect: 'action'
    }

export type LocationEmbeddingMetadata = {
  locationId: string
  storyId: string
  kind: 'context'
}

export type StoryNodeEmbeddingMetadata = {
  nodeId: string
  storyId: string
  kind: 'story_node'
}

export const loadStoryToEmbeddings = async () => {
  const documents: Document[] = []
  let _nr = 0

  const scenes = scenesState.scenes
  const storyId = storyState.story?.id

  for (const [sceneId, scene] of Object.entries(scenes)) {
    // Skip if scene node is marked as non-story
    const sceneNode = findNode(sceneId)
    if (sceneNode?.nodeType !== 'story') continue

    // Add the scene node itself as a document
    if (!addCache.has(`node/${sceneId}`)) {
      const nodeContent = sceneNode.oneliner || sceneNode.name
      if (nodeContent) {
        documents.push({
          id: `node/${sceneId}`,
          pageContent: nodeContent,
          metadata: {
            nodeId: sceneId,
            storyId: storyId ?? '',
            kind: 'story_node',
          } satisfies StoryNodeEmbeddingMetadata,
        })
        addCache.add(`node/${sceneId}`)
        _nr++
      }
    }

    for (const paragraph of scene.paragraphs) {
      const paragraphText = typeof paragraph.text === 'string' ? paragraph.text : contentSchemaToText(paragraph.text)
      if (paragraphText.length > 0 && !addCache.has(`paragraph/${paragraph.id}`)) {
        documents.push({
          id: `paragraph/${paragraph.id}`,
          pageContent: paragraphText,
          metadata: {
            sceneId,
            paragraphId: paragraph.id,
            storyId: storyId ?? '',
            kind: 'content',
          } satisfies ParagraphEmbeddingMetadata,
        })
        addCache.add(`paragraph/${paragraph.id}`)
        _nr++
      }
    }
  }

  for (const [characterId, character] of Object.entries(charactersState.characters)) {
    const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
    const displayName = character.nickname ? `${fullName} "${character.nickname}"` : fullName

    // Combined character profile (summary, appearance, identity, and role)
    if (!addCache.has(`character/${characterId}/profile`)) {
      // Build a comprehensive character profile
      const profileParts = [
        // Summary
        `${displayName}: ${character.summary}`,

        // Appearance
        [
          `${displayName} is ${character.age} years old and ${character.height}cm tall`,
          character.distinguishingFeatures ? `Notable features: ${character.distinguishingFeatures}` : null,
          character.hairColor ? `Has ${character.hairColor.toLowerCase()} hair` : null,
          character.eyeColor ? `Has ${character.eyeColor.toLowerCase()} eyes` : null,
        ]
          .filter(Boolean)
          .join('. '),

        // Identity
        [
          character.gender ? `${displayName}'s gender is ${character.gender}` : null,
          character.sexualOrientation ? `Their sexual orientation is ${character.sexualOrientation}` : null,
        ]
          .filter(Boolean)
          .join('. '),

        // Role
        `${displayName} is a ${character.isMainCharacter ? 'main character' : 'supporting character'} in the story`,

        // Personality
        character.personality ? `Personality: ${character.personality}` : null,
        character.personalityQuirks ? `Personality quirks: ${character.personalityQuirks}` : null,
        character.likes ? `Likes: ${character.likes}` : null,
        character.dislikes ? `Dislikes: ${character.dislikes}` : null,
        character.background ? `Background: ${character.background}` : null,
        character.writingStyle ? `Writing style: ${character.writingStyle}` : null,
      ]
        .filter(Boolean)
        .join('\n\n')

      documents.push({
        id: `character/${characterId}/profile`,
        pageContent: profileParts,
        metadata: {
          characterId,
          storyId: storyId ?? '',
          kind: 'context',
          aspect: 'profile',
        } satisfies CharacterEmbeddingMetadata,
      })
      addCache.add(`character/${characterId}/profile`)
      _nr++
    }

    // Significant actions
    if (character.significantActions) {
      for (const action of character.significantActions) {
        // Skip if the scene this action is from is marked as non-story
        const actionSceneNode = findNode(action.sceneId)
        if (actionSceneNode?.nodeType !== 'story') continue

        const actionId = `character/${characterId}/action/${action.timestamp}`
        if (!addCache.has(actionId)) {
          documents.push({
            id: actionId,
            pageContent: `${displayName}: ${action.action}`,
            metadata: {
              characterId,
              storyId: storyId ?? '',
              sceneId: action.sceneId,
              kind: 'context',
              aspect: 'action',
            } satisfies CharacterEmbeddingMetadata,
          })
          addCache.add(actionId)
          _nr++
        }
      }
    }
  }

  for (const [locationId, location] of Object.entries(locationsState.locations)) {
    if (!addCache.has(`location/${locationId}`)) {
      documents.push({
        id: `location/${locationId}`,
        pageContent: `${location.name}: ${location.description}`,
        metadata: {
          locationId,
          storyId: storyId ?? '',
          kind: 'context',
        } satisfies LocationEmbeddingMetadata,
      })
      addCache.add(`location/${locationId}`)
      _nr++
    }
  }

  await addDocuments(documents)
}

export async function removeEntityIdsFromEmbeddings(entityIdPattern: RegExp) {
  const removableIds: string[] = []
  for (const value of addCache) {
    if (value.match(entityIdPattern)) {
      removableIds.push(value)
    }
    addCache.delete(value)
  }

  await removeDocuments(removableIds)
}
