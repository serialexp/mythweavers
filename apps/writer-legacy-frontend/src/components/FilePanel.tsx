import { writeText } from '@tauri-apps/plugin-clipboard-manager'

import { convertFileSrc } from '@tauri-apps/api/core'
import { basename, join, resolve } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { copyFile, mkdir, readDir, readFile, remove } from '@tauri-apps/plugin-fs'
import { FiEdit, FiLink, FiTrash, FiUpload } from 'solid-icons/fi'
import { JSX, createEffect, createSignal } from 'solid-js'
import { addNotification } from '../lib/stores/notifications.ts'
import { uploadedFile } from '../lib/stores/retrieval/uploaded-file.ts'
import { storyState } from '../lib/stores/story.ts'
import { addUploadedFile } from '../lib/stores/uploaded-files.ts'
import { userState } from '../lib/stores/user.ts'
import { trpc } from '../lib/trpc.ts'
import { arrayBufferToBase64 } from '../lib/util.ts'
import { NoItems } from './NoItems.tsx'
export interface File {
  name: string
  isDir: boolean
}

const Item = ({
  signedIn,
  handleClick,
  handleAction,
  uploadData,
  file,
  selectFile,
  openRenameDialog,
}: {
  signedIn: boolean
  handleClick: (fileName: string, isDir: boolean) => Promise<void>
  handleAction: (fileName: string, action: 'delete' | 'upload' | 'copy-link' | 'select') => Promise<void>
  uploadData?: {
    hash: string
    publicUrl: string
  }
  file: File
  selectFile?: (fileName: string) => void
  openRenameDialog: (fileName: string) => void
}): JSX.Element => {
  const [uploading, setUploading] = createSignal<boolean>(false)
  return (
    <div
      class={`flex items-center justify-start py-0.5 px-1 w-full cursor-pointer ${
        file.isDir ? 'bg-base-100' : 'bg-white'
      } hover:bg-gray-300`}
      onClick={() => {
        handleClick(file.name, file.isDir)
      }}
    >
      {file.isDir ? '📁' : file.name.includes('.png') ? '🖼' : '📄'}
      {file.name}
      {file.isDir ? '/' : ''}
      {!file.isDir && selectFile ? (
        <button
          type="button"
          class="ml-auto btn btn-xs btn-primary"
          onClick={(e) => {
            e.stopPropagation()
            handleAction(file.name, 'select')
          }}
        >
          Select
        </button>
      ) : !file.isDir ? (
        <div class="ml-auto flex items-center gap-2">
          {uploadData?.publicUrl ? (
            <button
              type="button"
              class="btn btn-xs btn-primary"
              aria-label={'copy link'}
              onClick={(e) => {
                e.stopPropagation()
                handleAction(uploadData.publicUrl, 'copy-link')
              }}
            >
              <FiLink />
            </button>
          ) : null}
          <button
            type="button"
            class={`btn btn-xs btn-primary ${uploading() ? 'loading' : ''}`}
            disabled={!signedIn}
            aria-label={'upload'}
            onClick={(e) => {
              e.stopPropagation()
              setUploading(true)
              handleAction(file.name, 'upload').then(() => {
                setUploading(false)
              })
            }}
          >
            <FiUpload />
          </button>

          <button
            type="button"
            class="btn btn-xs btn-error"
            aria-label={'delete'}
            onClick={(e) => {
              e.stopPropagation()
              handleAction(file.name, 'delete')
            }}
          >
            <FiTrash />
          </button>
          <button
            type="button"
            class="btn btn-xs btn-secondary"
            aria-label={'rename'}
            onClick={(e) => {
              e.stopPropagation()
              openRenameDialog(file.name)
            }}
          >
            <FiEdit />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export const FilePanel = ({
  selectFile,
  showOnlyUploaded = false,
}: {
  selectFile?: (fileName: string) => void
  showOnlyUploaded?: boolean
}) => {
  const [files, setFiles] = createSignal<File[]>([])

  const [currentPath, setCurrentPath] = createSignal<string>('')
  const [createDirOpen, setCreateDirOpen] = createSignal<boolean>(false)
  const [openedFile, setOpenedFile] = createSignal<string>('')
  const [newDirectoryName, setNewDirectoryName] = createSignal<string>('')

  const [renameDialogOpen, setRenameDialogOpen] = createSignal<boolean>(false)
  const [fileToRename, setFileToRename] = createSignal<string>('')
  const [newFileName, setNewFileName] = createSignal<string>('')

  createEffect(() => {
    const storyId = storyState.story?.id
    if (!storyId) {
      return
    }
    trpc.listUploadedFiles
      .query({
        storyId,
      })
      .then((uploadedFiles) => {
        console.log(uploadedFiles)
        for (const file of uploadedFiles) {
          addUploadedFile(file.localPath ?? '', {
            hash: file.sha256,
            publicUrl: file.fullUrl,
          })
        }
      })
  })

  const handleClick = async (name: string, isDir: boolean) => {
    const openPath = storyState.openPath
    if (!openPath) {
      throw new Error('No open path')
    }
    if (isDir) {
      let newPath = await resolve(openPath, 'data', currentPath(), name)
      if (!newPath.includes(`${openPath}/data`)) {
        newPath = `${openPath}/data`
      }
      setCurrentPath(newPath.replace(`${openPath}/data`, ''))
    } else {
      const fullPath = await resolve(openPath, 'data', currentPath().replace(/^\//, ''), name)

      setOpenedFile(convertFileSrc(fullPath))
    }
  }

  const addFile = async () => {
    const openPath = storyState.openPath
    if (!openPath) {
      throw new Error('No open path')
    }
    const files = await open({
      multiple: true,
      directory: false,
    })
    await mkdir(await join(openPath, 'data'), { recursive: true })
    console.log('fileresponse', files)
    await Promise.all(
      files?.map(async (f) => {
        if (f) {
          const filename = await basename(f)
          const destinationFolder = await resolve(openPath, 'data', currentPath().replace(/^\//, ''))
          await mkdir(destinationFolder, { recursive: true })

          const destination = await resolve(destinationFolder, filename)
          console.log('copying', f, destination)
          await copyFile(f, destination)
        }
      }) ?? [],
    )
    getFiles()
  }

  const handleAction = async (name: string, action: 'delete' | 'upload' | 'copy-link' | 'select') => {
    const openPath = storyState.openPath
    if (!openPath) {
      throw new Error('No open path')
    }
    console.log('handleAction', name, action)
    if (action === 'select') {
      const fullPath = await resolve(openPath, 'data', currentPath(), name)
      const partialPath = fullPath.replace(`${openPath}/data`, '')

      selectFile?.(partialPath)
    } else if (action === 'delete') {
      const newPath = await resolve(openPath, 'data', currentPath().replace(/^\//, ''), name)
      await remove(newPath)
    } else if (action === 'upload') {
      if (!userState.signedInUser) {
        addNotification({
          title: 'Not signed in',
          message: 'You must be signed in to upload files',
          type: 'error',
        })
        throw new Error('Not signed in')
      }
      const storyId = storyState.story?.id
      if (!storyId) {
        throw new Error('No story id')
      }
      try {
        const readPath = await resolve(openPath, 'data', currentPath().replace(/^\//, ''), name)
        const newPath = readPath.replace(`${openPath}/data`, '')
        console.log('uploading', readPath, newPath)

        const fileData = await readFile(readPath)
        return trpc.uploadStoryImage
          .mutate({
            dataBase64: arrayBufferToBase64(fileData),
            path: newPath,
            storyId,
          })
          .then((res) => {
            console.log('uploaded', res)
            addUploadedFile(newPath, {
              hash: res.sha256,
              publicUrl: res.fullUrl,
            })
          })
          .catch((error) => {
            console.error(error)
          })
      } catch (error) {
        console.error(error)
      }
    } else if (action === 'copy-link') {
      writeText(name)
        .then(() => {
          console.log('copied')
        })
        .catch((error) => {
          console.error(error)
        })
    }
  }

  const getFiles = async () => {
    const openPath = storyState.openPath
    if (!openPath) {
      throw new Error('No open path')
    }
    const loadPath = await resolve(openPath, 'data', currentPath().replace(/^\//, ''))

    const contents = await readDir(loadPath)

    const entries = [{ name: '..', isDirectory: true, path: '..' }, ...contents]

    console.log(entries)
    const names = entries.map((entry) => ({
      name: entry.name || '',
      isDir: entry.isDirectory,
    }))
    // sort directories first, then by name
    names.sort((a, b) => (b.isDir ? 1 : -1) || a.name.localeCompare(b.name))

    setFiles(names)
  }

  createEffect(getFiles)

  const openRenameDialog = (fileName: string) => {
    setFileToRename(fileName)
    setNewFileName(fileName)
    setRenameDialogOpen(true)
  }

  const renameFile = async () => {
    const openPath = storyState.openPath
    if (!openPath) {
      throw new Error('No open path')
    }
    const currentFilePath = await resolve(openPath, 'data', currentPath().replace(/^\//, ''), fileToRename())
    const newFilePath = await resolve(openPath, 'data', currentPath().replace(/^\//, ''), newFileName())
    await copyFile(currentFilePath, newFilePath)
    await remove(currentFilePath)
    setRenameDialogOpen(false)
    getFiles()
  }

  return storyState.openPath ? (
    <div class="flex flex-1 flex-col overflow-hidden">
      <div class="flex overflow-hidden flex-1">
        <div class="flex flex-col w-1/5 min-w-[350px] flex-1 border-r border-gray-200">
          <div class="bg-gray-400 px-2 py-1 w-full min-h-[2em]">{currentPath()}</div>
          <div class="flex flex-col items-start overflow-auto flex-1 w-full">
            {files()
              .filter((file: File) => !showOnlyUploaded || file.isDir || uploadedFile(`${currentPath()}/${file.name}`))
              .map((file: File) => (
                <Item
                  signedIn={!!userState.signedInUser}
                  handleAction={handleAction}
                  uploadData={uploadedFile(`${currentPath()}/${file.name}`)}
                  handleClick={handleClick}
                  file={file}
                  selectFile={selectFile}
                  openRenameDialog={openRenameDialog}
                />
              ))}
          </div>
          {!selectFile && (
            <div class="flex gap-2 p-2">
              <button
                type="button"
                class="btn btn-secondary flex-1"
                onClick={async () => {
                  setCreateDirOpen(true)
                }}
              >
                Create Dir
              </button>
              <button
                type="button"
                class="btn btn-primary flex-1"
                onClick={async () => {
                  addFile()
                }}
              >
                Add File
              </button>
            </div>
          )}
          <div class="modal" classList={{ 'modal-open': createDirOpen() }}>
            <div
              class="modal-backdrop"
              onClick={() => {
                setCreateDirOpen(false)
              }}
            />

            <div class="modal-box">
              <h3 class="font-bold text-lg">Create Directory</h3>
              <input
                type="text"
                class="input input-bordered w-full"
                placeholder={'directory name'}
                onInput={(e) => {
                  setNewDirectoryName(e.currentTarget.value)
                }}
                value={newDirectoryName()}
              />
              <div class="modal-action">
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={async () => {
                    const openPath = storyState.openPath
                    if (!openPath) {
                      throw new Error('No open path')
                    }
                    setCreateDirOpen(false)

                    const newDir = await resolve(openPath, 'data', currentPath().replace(/^\//, ''), newDirectoryName())
                    await mkdir(newDir)
                    getFiles()
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="overflow-auto h-full w-full text-center">
          {['png', 'jpg', 'jpeg', 'webp'].includes(
            openedFile()
              ?.substring(openedFile()?.lastIndexOf('.') + 1)
              .toLowerCase(),
          ) ? (
            <img src={openedFile()} alt={'preview'} />
          ) : (
            openedFile()
          )}
        </div>
      </div>
      <div class="modal" classList={{ 'modal-open': renameDialogOpen() }}>
        <div
          class="modal-backdrop"
          onClick={() => {
            setRenameDialogOpen(false)
          }}
        />
        <div class="modal-box">
          <h3 class="font-bold text-lg">Rename File</h3>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder={'new file name'}
            onInput={(e) => {
              setNewFileName(e.currentTarget.value)
            }}
            value={newFileName()}
          />
          <div class="modal-action">
            <button
              type="button"
              class="btn btn-primary"
              onClick={async () => {
                renameFile()
              }}
            >
              Rename
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <NoItems
      itemKind="story"
      explanation="You must be in a story to view files."
      suggestion="You can open a story by clicking the menu button."
    />
  )
}
