import { IconButton } from '@mythweavers/ui'
import { BsSignpost2 } from 'solid-icons/bs'
import { Component, Show, createSignal } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import * as styles from './InsertEventButton.css'

interface InsertBranchButtonProps {
  afterMessageId?: string | null
  nodeId?: string
}

export const InsertBranchButton: Component<InsertBranchButtonProps> = (props) => {
  const [showForm, setShowForm] = createSignal(false)
  const [branchContent, setBranchContent] = createSignal('')

  const handleInsert = () => {
    const content = branchContent().trim() || 'What do you do?'

    if (props.afterMessageId === undefined) {
      throw new Error('afterMessageId must be defined (either a string or null)')
    }

    messagesStore.createBranchMessage(props.afterMessageId, content, props.nodeId)

    // Reset form
    setBranchContent('')
    setShowForm(false)
  }

  const handleCancel = () => {
    setBranchContent('')
    setShowForm(false)
  }

  return (
    <>
      <IconButton onClick={() => setShowForm(true)} aria-label="Insert branch point">
        <BsSignpost2 size={18} />
      </IconButton>

      <Show when={showForm()}>
        <div class={styles.modalOverlay} onClick={handleCancel}>
          <div class={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div class={styles.modalHeader}>
              <h3 class={styles.modalTitle}>Add Branch Point</h3>
              <button class={styles.closeButton} onClick={handleCancel}>
                ×
              </button>
            </div>

            <div class={styles.modalBody}>
              <div class={styles.formGroup}>
                <label class={styles.label}>Branch Question (Optional)</label>
                <input
                  type="text"
                  class={styles.input}
                  placeholder="e.g. 'What do you do?'"
                  value={branchContent()}
                  onInput={(e) => setBranchContent(e.currentTarget.value)}
                  autofocus
                />
                <p class={styles.hint}>
                  A question or prompt for the reader. You can add options after creating the branch.
                </p>
              </div>
            </div>

            <div class={styles.modalFooter}>
              <button class={styles.insertButtonConfirm} onClick={handleInsert}>
                Insert Branch
              </button>
              <button class={styles.cancelButton} onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}
