import { saveProject } from '../persistence/save-project.ts'
import { store } from '../store'

export const save = async (newAutoSave: boolean, lastAutoSaveAt?: number) => {
  const { base, ...rest } = store.getState()
  if (!base.openPath) {
    throw new Error('Cannot save without having an openPath set in the global store.')
  }
  await saveProject(base.openPath, {
    ...rest,
    newAutosave: newAutoSave,
    expectedLastModified: base.expectedLastModified ?? 0,
    changesSince: lastAutoSaveAt,
  })
}
