import { UploadedFile } from '@writer/shared'
import { createStore } from 'solid-js/store'

export const uploadedFilesDefault = { files: {} }
export const [uploadedFiles, setUploadedFiles] = createStore<{
  files: Record<string, UploadedFile>
}>(uploadedFilesDefault)

export const addUploadedFile = (path: string, file: UploadedFile) => {
  setUploadedFiles('files', (prev) => ({ ...prev, [path]: file }))
}
