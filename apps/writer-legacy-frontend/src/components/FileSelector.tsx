import { createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { FilePanel } from './FilePanel'

interface FileSelectorProps {
  /** What is the thing we are selecting a file for? */
  name?: string
  value?: string
  onChange: (newValue: string) => void
  showOnlyUploaded?: boolean
}

export const FileSelector = (props: FileSelectorProps) => {
  const [isOpen, setIsOpen] = createSignal(false)

  const handleSelectFile = (fileName: string) => {
    console.log('fileName', fileName)
    props.onChange(fileName)
    setIsOpen(false)
  }

  return (
    <>
      <button type="button" class="btn btn-primary" onClick={() => setIsOpen(true)}>
        Select File
      </button>
      <div>Selected File: {props.value}</div>

      {isOpen() ? (
        <Portal>
          <div class="modal modal-open">
            <div class="modal-box flex flex-col min-w-[700px]">
              <h3 class="font-bold text-lg">Select a file for {props.name}</h3>
              <button
                type="button"
                class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
              <FilePanel selectFile={handleSelectFile} showOnlyUploaded={props.showOnlyUploaded} />
            </div>
          </div>
        </Portal>
      ) : null}
    </>
  )
}
