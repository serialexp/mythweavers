import { path } from '@tauri-apps/api'
import { exists, readDir, readTextFile, stat } from '@tauri-apps/plugin-fs'
import { type Node, type PersistedStory, entities, languageEntities, persistedSchema } from '@writer/shared'
import { setExpectedLastModified, setOpenPath, storyState } from '../stores/story'
import { setSyncState } from '../stores/ui'
import { setLastKnownServerUpdate } from '../stores/ui'
import { userState } from '../stores/user'
import { checkSyncStatus } from './check-sync-status'
import { loadToState } from './load-to-state'

// Type for raw story data before Zod parsing

const migrateCharacterNames = (storyData: PersistedStory) => {
  if (storyData?.story?.characters) {
    for (const characterId of Object.keys(storyData.story.characters)) {
      const character = storyData.story.characters[characterId]
      if (character.name && !character.firstName) {
        const nameParts = character.name.trim().split(/\s+/)
        if (nameParts.length === 1) {
          character.firstName = nameParts[0]
        } else if (nameParts.length === 2) {
          character.firstName = nameParts[0]
          character.lastName = nameParts[1]
        } else if (nameParts.length > 2) {
          character.firstName = nameParts[0]
          character.lastName = nameParts[nameParts.length - 1]
          character.middleName = nameParts.slice(1, -1).join(' ')
        }
      } else if (!character.firstName) {
        character.firstName = 'unknown'
      }
    }
  }
}

export const loadProject = async (projectPath: string) => {
  const indexPath = await path.join(projectPath, 'index.json')
  const storyText = await readTextFile(indexPath)
  const storyStat = await stat(indexPath)

  const storyData: PersistedStory = JSON.parse(storyText)
  // Ensure main story modifiedTime is a number
  if (typeof storyData.story.modifiedTime === 'string') {
    storyData.story.modifiedTime = Number(storyData.story.modifiedTime)
  }
  if (!storyData.story.modifiedTime || Number.isNaN(storyData.story.modifiedTime)) {
    console.warn('Story index.json missing or invalid modifiedTime, setting to now.')
    storyData.story.modifiedTime = Date.now()
  }

  if (!storyData?.story?.id) {
    throw new Error('Story ID is missing from index.json')
  }

  for (const entity of entities) {
    storyData.story[entity] = {}
    try {
      const entityPath = await path.join(projectPath, entity)
      if (await exists(entityPath)) {
        const entityFiles = await readDir(entityPath)
        for (const entityId of entityFiles
          .filter((file) => file.name && !file.name.startsWith('.'))
          .map((file) => file.name?.replace('.json', '') ?? '')) {
          if (!entityId) continue
          const entityFile = await path.join(entityPath, `${entityId}.json`)
          const entityData = await readTextFile(entityFile)
          const parsedEntityData = JSON.parse(entityData.toString())

          // Ensure entity modifiedAt is a number
          if (typeof parsedEntityData.modifiedAt === 'string') {
            parsedEntityData.modifiedAt = Number(parsedEntityData.modifiedAt)
          }
          if (!parsedEntityData.modifiedAt || Number.isNaN(parsedEntityData.modifiedAt)) {
            console.warn(`Entity ${entity}/${entityId} missing or invalid modifiedAt, setting to now.`)
            parsedEntityData.modifiedAt = Date.now()
          }

          // Specific check for scenes to handle paragraph timestamps
          if (entity === 'scene' && Array.isArray(parsedEntityData.paragraphs)) {
            for (const paragraph of parsedEntityData.paragraphs) {
              if (typeof paragraph.modifiedAt === 'string') {
                paragraph.modifiedAt = Number(paragraph.modifiedAt)
              }
              if (!paragraph.modifiedAt || Number.isNaN(paragraph.modifiedAt)) {
                console.warn(
                  `Paragraph ${paragraph.id} in Scene ${entityId} missing or invalid modifiedAt, setting to now.`,
                )
                paragraph.modifiedAt = Date.now()
              }
            }
          }

          storyData.story[entity][entityId] = parsedEntityData
        }
      }
    } catch (error) {
      console.error(`Error loading entity type ${entity}:`, error)
    }
  }

  for (const languageEntity of languageEntities) {
    if (storyData.language) {
      storyData.language[languageEntity] = {}
      const languageEntityPath = await path.join(projectPath, languageEntity)
      if (await exists(languageEntityPath)) {
        const languageEntityFiles = await readDir(languageEntityPath)
        for (const languageEntityId of languageEntityFiles.map((name) => name.name?.replace('.json', '') ?? '')) {
          if (!languageEntityId) continue
          const entityPath = await path.join(languageEntityPath, `${languageEntityId}.json`)
          const languageEntityData = await readTextFile(entityPath)
          const parsedLanguageEntityData = JSON.parse(languageEntityData.toString())
          // Ensure language entity modifiedAt is a number
          if (typeof parsedLanguageEntityData.modifiedAt === 'string') {
            parsedLanguageEntityData.modifiedAt = new Date(parsedLanguageEntityData.modifiedAt).getTime()
          }
          if (!parsedLanguageEntityData.modifiedAt || Number.isNaN(parsedLanguageEntityData.modifiedAt)) {
            console.warn(
              `Language entity ${languageEntity}/${languageEntityId} missing or invalid modifiedAt, setting to now.`,
            )
            parsedLanguageEntityData.modifiedAt = Date.now()
          }
          storyData.language[languageEntity][languageEntityId] = parsedLanguageEntityData
        }
      }
    }
  }

  migrateCharacterNames(storyData)

  let savedStory: PersistedStory
  try {
    savedStory = persistedSchema.parse(storyData)
  } catch (error) {
    console.error('Story schema validation failed:', error)
    throw new Error('Story file format is invalid and cannot be loaded.')
  }

  const ids: string[] = []
  const getIdFromTreeObject = (node: Node) => {
    ids.push(node.id)
    if (node.children) {
      for (const child of node.children) {
        getIdFromTreeObject(child)
      }
    }
  }
  for (const node of savedStory.story.structure) {
    getIdFromTreeObject(node)
  }
  for (const entity of ['book', 'arc', 'chapter', 'scene'] as const) {
    if (savedStory.story[entity]) {
      for (const id of Object.keys(savedStory.story[entity])) {
        if (!ids.includes(id)) {
          delete savedStory.story[entity][id]
        }
      }
    }
  }

  await loadToState(savedStory)
  setOpenPath(projectPath)
  setExpectedLastModified(storyStat.mtime?.getTime() ?? 0)
  setSyncState(null)
  setLastKnownServerUpdate(storyState.story?.modifiedTime ?? null)

  // Deferred sync check
  setTimeout(async () => {
    if (userState.signedInUser && storyState.story?.id) {
      await checkSyncStatus()
    } else {
      console.log('User not signed in or story ID missing, skipping difference check (deferred).')
      setSyncState(null)
    }
  }, 0)

  return savedStory
}
