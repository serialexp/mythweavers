import { join } from '@tauri-apps/api/path'
import { exists, readTextFile } from '@tauri-apps/plugin-fs'

export const checkProject = async (projectPath: string) => {
  console.log('join')
  const projectFile = await join(projectPath, 'index.json')
  console.log('exists')
  const projectIndexExists = await exists(projectFile)

  if (!projectIndexExists) {
    return false
  }

  const fileData = await readTextFile(projectFile)
  console.log('fileData', fileData)
  try {
    const parsed = JSON.parse(fileData)
    console.log('parsed', parsed)
    if (!parsed.story || !parsed.story.name) {
      return false
    }
    return true
  } catch (_error) {
    return false
  }
}
