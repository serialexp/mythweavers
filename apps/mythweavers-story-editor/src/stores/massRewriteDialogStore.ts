import { createSignal } from 'solid-js'

const [isOpen, setIsOpen] = createSignal(false)
const [targetNodeId, setTargetNodeId] = createSignal<string | null>(null)
const [selectedMessageIds, setSelectedMessageIds] = createSignal<Set<string>>(new Set<string>())
const [selectedContextSceneIds, setSelectedContextSceneIds] = createSignal<Set<string>>(new Set<string>())

export const massRewriteDialogStore = {
  get isOpen() {
    return isOpen()
  },

  get targetNodeId() {
    return targetNodeId()
  },

  get selectedMessageIds() {
    return selectedMessageIds()
  },

  get selectedContextSceneIds() {
    return selectedContextSceneIds()
  },

  show(nodeId: string, messageIds?: string[]) {
    setTargetNodeId(nodeId)
    // Pre-select all provided message IDs, or empty if none provided
    setSelectedMessageIds(new Set<string>(messageIds || []))
    setSelectedContextSceneIds(new Set<string>())
    setIsOpen(true)
  },

  hide() {
    setIsOpen(false)
  },

  toggleMessageSelection(messageId: string) {
    setSelectedMessageIds((current) => {
      const next = new Set(current)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  },

  selectMessage(messageId: string) {
    setSelectedMessageIds((current) => {
      const next = new Set(current)
      next.add(messageId)
      return next
    })
  },

  deselectMessage(messageId: string) {
    setSelectedMessageIds((current) => {
      const next = new Set(current)
      next.delete(messageId)
      return next
    })
  },

  selectAllMessages(messageIds: string[]) {
    setSelectedMessageIds(new Set<string>(messageIds))
  },

  clearMessageSelection() {
    setSelectedMessageIds(new Set<string>())
  },

  toggleContextSceneSelection(sceneId: string) {
    setSelectedContextSceneIds((current) => {
      const next = new Set(current)
      if (next.has(sceneId)) {
        next.delete(sceneId)
      } else {
        next.add(sceneId)
      }
      return next
    })
  },

  clearContextSelection() {
    setSelectedContextSceneIds(new Set<string>())
  },

  reset() {
    setTargetNodeId(null)
    setSelectedMessageIds(new Set<string>())
    setSelectedContextSceneIds(new Set<string>())
    setIsOpen(false)
  },
}
