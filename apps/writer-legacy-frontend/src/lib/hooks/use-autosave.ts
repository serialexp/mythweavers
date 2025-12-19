import { useEffect } from 'react'
import { save } from '../actions/save'

export const useAutosave = (storyLoaded: boolean) => {
  let saveCount = 0
  const oneSaveEvery = 10_000
  const oneAutoSaveForEvery = 12
  useEffect(() => {
    let lastAutoSaveAt = Date.now()
    if (storyLoaded) {
      const saveLogic = (lastAutoSaveTime: number) => {
        saveCount++
        const isAutoSave = saveCount % oneAutoSaveForEvery === 0
        const autoSaveAt = Date.now()
        save(isAutoSave, lastAutoSaveTime)
          .catch((e) => {
            console.error(e)
          })
          .finally(() => {
            if (isAutoSave) {
              console.log('set auto save time to ', autoSaveAt)
              lastAutoSaveAt = autoSaveAt
            }
          })
      }

      const saveInterval = setInterval(() => {
        saveLogic(lastAutoSaveAt)
      }, oneSaveEvery)

      const handleVisibilityChange = () => {
        saveLogic(lastAutoSaveAt)
      }
      // this to immediately throw a 409 if the story has been updated elsewhere
      window.addEventListener('focus', handleVisibilityChange)

      return () => {
        clearInterval(saveInterval)
        window.removeEventListener('focus', handleVisibilityChange)
      }
    }
  }, [storyLoaded])
}
