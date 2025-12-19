import { path } from '@tauri-apps/api'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'

export type AutoSaveFile = {
  name: string
  words: string
  savedDate: Date
  object: any
}

export const listAutosaves = async (projectPath: string, entityType: string, entityId: string) => {
  const storyFile = await path.join(projectPath, 'autosave', entityType, entityId)

  const files = await readDir(storyFile)
  const data: AutoSaveFile[] = []

  for (const file of files) {
    const contentPath = await path.join(projectPath, 'autosave', entityType, entityId, file.name)
    const content = await readTextFile(contentPath)
    const jsonContent = JSON.parse(content)

    data.push({
      name: file.name,
      words: jsonContent.words,
      savedDate: new Date(Number.parseInt(file.name.replace('.json', ''))),
      object: jsonContent,
    })
  }

  //sort by date
  data.sort((a, b) => b.savedDate.getTime() - a.savedDate.getTime())

  return data
}
