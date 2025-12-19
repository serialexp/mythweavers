import { uploadedFiles } from '../uploaded-files'

export const uploadedFile = (path: string) => {
  const files = uploadedFiles.files
  return files?.[path]
}
