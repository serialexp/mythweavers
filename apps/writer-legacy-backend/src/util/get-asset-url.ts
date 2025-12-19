import { createHash } from 'node:crypto'

export const getStoryAssetUrl = (ownerId: number, storyId: string, filePath: string) => {
  if (!filePath) {
    return ''
  }
  const hash = createHash('sha256').update(filePath).digest('hex')
  return `https://team.wtf/upload/${ownerId}/${storyId}/${hash}.${filePath.split('.').pop()}`
}

export const getAssetUrl = (ownerId: number, filePath: string) => {
  const hash = createHash('sha256').update(filePath).digest('hex')
  return `https://team.wtf/upload/${ownerId}/${hash}.${filePath.split('.').pop()}`
}
