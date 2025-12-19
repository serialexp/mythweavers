import { path } from '@tauri-apps/api'
import { copyFile, mkdir, readDir, remove, stat, writeTextFile } from '@tauri-apps/plugin-fs'
import { type PersistedStory, type SavePayload, entities, languageEntities, saveSchema } from '@writer/shared'
import { setExpectedLastModified } from '../stores/story'
import { setSaving } from '../stores/ui'

const writeStoryPath = async (
  validatedBody: PersistedStory,
  projectPath: string,
  options?: {
    saveChangedSince?: number
    autosave?: boolean
  },
) => {
  const storyFile = await path.join(projectPath, 'index.json')
  const storyTrashSavePath = await path.join(projectPath, 'trash')

  const creatableFolders: Set<string> = new Set()
  const writableFiles: Record<string, string> = {}

  for (const entity of entities) {
    const _entityPath = await path.join(projectPath, entity)
    if (validatedBody.story[entity]) {
      for (const entityId of Object.keys(validatedBody.story[entity])) {
        const entityData = validatedBody.story[entity][entityId]
        if (
          options?.saveChangedSince &&
          (!entityData.modifiedAt || Number(entityData.modifiedAt) < options.saveChangedSince)
        ) {
          continue
        }

        if (options?.autosave) {
          const entityPathSpecific = await path.join(projectPath, entity, entityId)

          creatableFolders.add(entityPathSpecific)
          const entityFile = await path.join(entityPathSpecific, `${entityData.modifiedAt}.json`)
          writableFiles[entityFile] = JSON.stringify(entityData, null, 2)
        } else {
          const entityPath = await path.join(projectPath, entity)
          const entityFile = await path.join(projectPath, entity, `${entityId}.json`)
          creatableFolders.add(entityPath)
          writableFiles[entityFile] = JSON.stringify(entityData, null, 2)
        }
      }
    }
    if (!options?.autosave) {
      try {
        // remove entities that do not exist any more
        const entitiesPath = await path.join(projectPath, entity)
        try {
          const _exists = await stat(entitiesPath)
        } catch (_error) {
          continue
        }
        const allFiles = (await readDir(entitiesPath)).filter((i) => !i.name.startsWith('.') && i.isFile)
        const allKeys = Object.keys(validatedBody.story[entity] ?? {}).map((key) => `${key}.json`)
        for (const file of allFiles) {
          if (!allKeys.includes(file.name)) {
            const allKey = await path.join(projectPath, entity, file.name)
            const trashDirectory = await path.join(storyTrashSavePath, entity)
            const trashPath = await path.join(trashDirectory, file.name)
            await mkdir(trashDirectory, { recursive: true })
            await copyFile(allKey, trashPath)
            await remove(allKey)
          }
        }
        delete validatedBody.story[entity]
      } catch (error) {
        console.error('failed saving trahsed entities', error)
      }
    }
  }

  if (!options?.autosave) {
    for (const languageEntity of languageEntities) {
      const languagePath = await path.join(projectPath, languageEntity)
      await mkdir(languagePath, { recursive: true })
      for (const languageEntityId of Object.keys(validatedBody.language[languageEntity])) {
        const languageData = validatedBody.language[languageEntity][languageEntityId]
        const entityFile = await path.join(projectPath, languageEntity, `${languageEntityId}.json`)
        await writeTextFile(entityFile, JSON.stringify(languageData, null, 2))
      }
      // @ts-expect-error: not sure why complain here
      delete validatedBody.language[languageEntity]
    }

    await writeTextFile(
      storyFile,
      JSON.stringify(
        {
          story: validatedBody.story,
          language: validatedBody.language,
        },
        null,
        2,
      ),
    )
  } else if (
    options?.autosave &&
    options.saveChangedSince &&
    Number(validatedBody.story.modifiedTime) > options.saveChangedSince
  ) {
    const indexFile = await path.join(projectPath, `${Date.now()}.json`)
    writableFiles[indexFile] = JSON.stringify(
      {
        story: validatedBody.story,
        language: validatedBody.language,
      },
      null,
      2,
    )
  }

  for (const folderPath of creatableFolders) {
    await mkdir(folderPath, { recursive: true })
  }
  for (const filePath in writableFiles) {
    await writeTextFile(filePath, writableFiles[filePath])
  }
}

export const saveProject = async (projectPath: string, data: SavePayload) => {
  try {
    const validatedBody = saveSchema.parse(data)
    setSaving(true)

    const storyFile = await path.join(projectPath, 'index.json')

    const storyAutoSavePath = await path.join(projectPath, 'autosave')

    const currentFileStat = await stat(storyFile)
    // console.log(
    //   "expected",
    //   validatedBody.expectedLastModified,
    //   "actual",
    //   currentFileStat.mtime?.getTime(),
    // );
    if (currentFileStat.mtime?.getTime() !== validatedBody.expectedLastModified) {
      // throw new Error(
      //   "Conflict during save. Existing file is newer than the saved one.",
      // );

      // if date is somehow different, make an autosave first
      data.newAutosave = true
    }

    if (data.newAutosave) {
      console.log('autosave changes since', data.changesSince, 'expected last modified', data.expectedLastModified)
      await mkdir(storyAutoSavePath, { recursive: true })
      await writeStoryPath(validatedBody, storyAutoSavePath, {
        saveChangedSince: data.changesSince,
        autosave: true,
      })
    }

    await writeStoryPath(validatedBody, projectPath, {
      saveChangedSince: data.changesSince,
    })

    const newFileStat = await stat(storyFile)
    // console.log("new last modified", newFileStat.mtime?.getTime());

    if (newFileStat.mtime) {
      setExpectedLastModified(newFileStat.mtime.getTime())
    }
  } catch (error) {
    console.error(error)
  } finally {
    setSaving(false)
  }
}
