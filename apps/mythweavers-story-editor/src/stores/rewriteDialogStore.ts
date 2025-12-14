import { createSignal } from 'solid-js'

const [isOpen, setIsOpen] = createSignal(false)
const [selectedMessageIds, setSelectedMessageIds] = createSignal<string[]>([])

export const rewriteDialogStore = {
  get isOpen() {
    return isOpen()
  },

  get selectedMessageIds() {
    return selectedMessageIds()
  },

  show(messageIds: string[] = []) {
    setSelectedMessageIds(messageIds)
    setIsOpen(true)
  },

  hide() {
    setIsOpen(false)
    // Keep the selected messages until the dialog is opened again
  },

  clearSelection() {
    setSelectedMessageIds([])
  }
}