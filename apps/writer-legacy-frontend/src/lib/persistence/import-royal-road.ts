import {
  setImportDialogChapterImported,
  setImportDialogChapters,
  setImportDialogComplete,
  setImportDialogOpen,
  setImportDialogRunning,
  setLastSaveAt,
} from '../stores/ui'
import { trpc } from '../trpc'
import { loadToState } from './load-to-state'

export const importRoyalRoad = async (storyId: string) => {
  const numericStoryId = Number(storyId)

  if (Number.isNaN(numericStoryId)) {
    console.error('Invalid Royal Road story ID')
    return
  }

  setImportDialogRunning(true)
  try {
    const iterable = await trpc.importRoyalroad.mutate({
      storyId: numericStoryId,
    })
    for await (const result of iterable) {
      console.log('result', result)
      if (result.kind === 'storyInfo') {
        setImportDialogChapters(
          result.data.chapters.map((chapter) => ({
            id: Number(chapter.id),
            title: chapter.title ?? '',
            imported: false,
          })),
        )
        setImportDialogOpen(true)
      }

      if (result.kind === 'chapterImported') {
        setImportDialogChapterImported(result.data)
      }
      if (result.kind === 'storyImported') {
        loadToState(result.data)
        setLastSaveAt(0)
        setImportDialogComplete(true)
      }
    }
  } catch (error) {
    console.error(error)
  } finally {
    setImportDialogRunning(false)
  }
}
