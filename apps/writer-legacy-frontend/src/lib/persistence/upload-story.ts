import { resolve } from '@tauri-apps/api/path'
import { readFile } from '@tauri-apps/plugin-fs'
import { addNotification } from '../stores/notifications'
import { settingsState } from '../stores/settings'
import { storyState } from '../stores/story'
import { setLastKnownServerUpdate, setUploading, setUploadingMessage } from '../stores/ui'
import { addUploadedFile, uploadedFiles } from '../stores/uploaded-files'
import { trpc } from '../trpc'
import { arrayBufferToBase64 } from '../util'
import { checkSyncStatus, hasConflicts } from './check-sync-status'
import { stateToStory } from './state-to-story'

interface TRPCError {
  shape?: {
    data?: {
      zodError?: {
        fieldErrors: Record<string, string[]>
      }
    }
  }
}

interface UploadResult {
  success: boolean
  updatedAt: string
  error?: string
}

async function uploadFileByPath(relativePath: string): Promise<void> {
  const openPath = storyState.openPath
  const storyId = storyState.story?.id

  if (!openPath || !storyId) {
    throw new Error('Cannot upload file: Story path or ID missing.')
  }

  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`

  console.log(`Uploading file: ${normalizedPath}`)
  setUploadingMessage(`Uploading ${normalizedPath}...`)

  try {
    const readPath = await resolve(openPath, 'data', normalizedPath.slice(1))
    const fileData = await readFile(readPath)
    const result = await trpc.uploadStoryImage.mutate({
      dataBase64: arrayBufferToBase64(fileData),
      path: normalizedPath,
      storyId,
    })

    addUploadedFile(normalizedPath, {
      hash: result.sha256,
      publicUrl: result.fullUrl,
    })
    console.log(`Successfully uploaded ${normalizedPath}`)
  } catch (error) {
    console.error(`Failed to upload file ${normalizedPath}:`, error)
    addNotification({
      title: 'File Upload Failed',
      message: `Could not upload ${normalizedPath}. Please try again or check the file.`,
      type: 'error',
    })
    throw new Error(`Failed to upload ${normalizedPath}`)
  }
}

export const uploadStory = async () => {
  if (!storyState.story || !storyState.openPath) {
    addNotification({
      title: 'Upload failed',
      message: 'No story loaded to upload',
      type: 'error',
    })
    return
  }

  const _openPath = storyState.openPath
  const _storyId = storyState.story.id

  try {
    setUploading(true)
    setUploadingMessage('Checking sync status...')

    const syncStatus = await checkSyncStatus()

    if (hasConflicts(syncStatus)) {
      addNotification({
        title: 'Upload failed',
        message: 'There are conflicts between local and server versions. Please resolve conflicts before uploading.',
        type: 'error',
      })
      setUploading(false)
      return
    }

    setUploadingMessage('Checking files...')
    const persistedStory = stateToStory()
    const referencedFiles = new Set<string>()

    if (persistedStory.story.settings?.headerImage) {
      referencedFiles.add(persistedStory.story.settings.headerImage)
    }
    for (const book of Object.values(persistedStory.story.book ?? {})) {
      if (book.coverImage) referencedFiles.add(book.coverImage)
      if (book.spineImage) referencedFiles.add(book.spineImage)
    }
    for (const char of Object.values(persistedStory.story.characters ?? {})) {
      if (char.picture) referencedFiles.add(char.picture)
    }
    for (const loc of Object.values(persistedStory.story.locations ?? {})) {
      if (loc.picture) referencedFiles.add(loc.picture)
    }

    const filesToUpload: string[] = []
    const currentUploadedFiles = uploadedFiles.files
    for (const path of referencedFiles) {
      if (path) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`
        if (!currentUploadedFiles[normalizedPath]?.publicUrl) {
          filesToUpload.push(normalizedPath)
        }
      }
    }

    if (filesToUpload.length > 0) {
      addNotification({
        title: 'Uploading Files',
        message: `Uploading ${filesToUpload.length} referenced file(s)...`,
        type: 'info',
      })
      console.log('Files needing upload:', filesToUpload)

      try {
        await Promise.all(filesToUpload.map(uploadFileByPath))
        addNotification({
          title: 'File Upload Complete',
          message: 'All referenced files uploaded successfully.',
          type: 'success',
        })
      } catch (uploadError) {
        addNotification({
          title: 'Upload Failed',
          message: `One or more file uploads failed. Story not saved. ${uploadError instanceof Error ? uploadError.message : ''}`,
          type: 'error',
        })
        setUploading(false)
        return
      }
    }

    const finalPersistedStory = stateToStory()

    setUploadingMessage('Saving story data...')

    const royalRoadCredentials =
      settingsState.royalRoadEmail && settingsState.royalRoadPassword
        ? {
            username: settingsState.royalRoadEmail,
            password: settingsState.royalRoadPassword,
          }
        : undefined

    const needsRoyalRoadCredentials =
      finalPersistedStory.story.settings?.publishToRoyalRoad &&
      Object.values(finalPersistedStory.story.chapter).some(
        (chapter) => chapter.visibleFrom && new Date(chapter.visibleFrom) < new Date() && chapter.royalRoadId,
      )

    if (needsRoyalRoadCredentials && !royalRoadCredentials) {
      addNotification({
        title: 'Upload failed',
        message: 'Royal Road credentials are required for publishing',
        type: 'error',
      })
      setUploading(false)
      return
    }

    const result = (await trpc.uploadStory.mutate({
      ...finalPersistedStory,
      royalRoadCredentials,
    })) as UploadResult

    if (result.success) {
      console.log('Story uploaded successfully')
      addNotification({
        title: 'Success',
        message: 'Story uploaded successfully',
        type: 'success',
      })
      setLastKnownServerUpdate(storyState.story?.modifiedTime ?? null)

      await checkSyncStatus()
    } else {
      console.error('Upload failed:', result.error)
      addNotification({
        title: 'Upload failed',
        message: result.error || 'Failed to upload story',
        type: 'error',
      })
    }

    return result
  } catch (error: unknown) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    const errorDetails = (error as TRPCError)?.shape?.data?.zodError?.fieldErrors || {}

    addNotification({
      title: 'Upload failed',
      message: `Failed to upload story: ${errorMessage}`,
      type: 'error',
      details: errorDetails,
    })
  } finally {
    setUploading(false)
    setUploadingMessage(null)
  }
}
