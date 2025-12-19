import { createSignal } from 'solid-js'

interface RewriteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (instructions: string) => void
}

export function RewriteModal(props: RewriteModalProps) {
  const [instructions, setInstructions] = createSignal('')

  const handleSubmit = () => {
    if (instructions().trim()) {
      props.onSubmit(instructions())
      setInstructions('')
      props.onClose()
    }
  }

  return (
    <>
      {props.isOpen && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Custom Rewrite</h3>
            <input
              type="text"
              value={instructions()}
              onInput={(e) => setInstructions(e.currentTarget.value)}
              class="input input-bordered w-full mt-4"
              placeholder="Enter rewrite instructions..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit()
                }
              }}
            />
            <div class="modal-action">
              <button type="button" class="btn btn-success" onClick={handleSubmit} disabled={!instructions().trim()}>
                Submit
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => {
                  setInstructions('')
                  props.onClose()
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface TranslationModalProps {
  isOpen: boolean
  initialValue?: string
  onClose: () => void
  onSave: (translation: string) => void
}

export function TranslationModal(props: TranslationModalProps) {
  const [text, setText] = createSignal(props.initialValue || '')

  const handleSave = () => {
    props.onSave(text())
    props.onClose()
  }

  return (
    <>
      {props.isOpen && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Translation</h3>
            <input
              type="text"
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              class="input input-bordered w-full mt-4"
              placeholder="Enter translation..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSave()
                }
              }}
            />
            <div class="modal-action">
              <button type="button" class="btn btn-success" onClick={handleSave}>
                Save
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => {
                  setText(props.initialValue || '')
                  props.onClose()
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface GenerateBetweenModalProps {
  isOpen: boolean
  initialValue?: string
  isGenerating: boolean
  onClose: () => void
  onGenerate: (text: string) => void
}

export function GenerateBetweenModal(props: GenerateBetweenModalProps) {
  const [text, setText] = createSignal(props.initialValue || '')

  const handleGenerate = () => {
    if (text().trim()) {
      props.onGenerate(text())
    }
  }

  return (
    <>
      {props.isOpen && (
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg">Generate Content</h3>
            <p class="py-4">What should happen in the generated content?</p>
            <textarea
              class="textarea textarea-bordered w-full"
              rows={5}
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              placeholder="Describe what should happen in this section..."
            />
            <div class="modal-action">
              <button
                type="button"
                class="btn btn-primary"
                onClick={handleGenerate}
                disabled={props.isGenerating || !text().trim()}
              >
                {props.isGenerating ? <span class="loading loading-spinner" /> : 'Generate'}
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => {
                  setText(props.initialValue || '')
                  props.onClose()
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
