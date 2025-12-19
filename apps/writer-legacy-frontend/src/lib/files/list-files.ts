import { resolve } from '@tauri-apps/api/path'
import { readDir } from '@tauri-apps/plugin-fs'

export const listLocalFiles = async (projectDir: string, subDir = '') => {
  try {
    const directoryPath = await resolve(projectDir, subDir)
    const files = await readDirRecursive(directoryPath)
    return files
  } catch (error) {
    console.error('Error listing files:', error)
    throw error
  }
}

const readDirRecursive = async (dir: string): Promise<{ name: string; path: string; isDir: boolean }[]> => {
  const entries = await readDir(dir)
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (entry.children) {
        const subFiles = await readDirRecursive(entry.path)
        return subFiles
      }
      return [
        {
          name: entry.name,
          path: entry.path,
          isDir: false,
        },
      ]
    }),
  )
  return files.flat()
}
