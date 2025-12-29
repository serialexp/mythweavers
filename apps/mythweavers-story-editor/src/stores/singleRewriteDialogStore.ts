import { createSignal } from 'solid-js'

const [isOpen, setIsOpen] = createSignal(false)
const [messageId, setMessageId] = createSignal<string | null>(null)
const [selectedSceneIds, setSelectedSceneIds] = createSignal<Set<string>>(new Set())

export const singleRewriteDialogStore = {
  get isOpen() {
    return isOpen()
  },

  get messageId() {
    return messageId()
  },

  get selectedSceneIds() {
    return selectedSceneIds()
  },

  show(targetMessageId: string) {
    setMessageId(targetMessageId)
    setSelectedSceneIds(new Set<string>())
    setIsOpen(true)
  },

  hide() {
    setIsOpen(false)
  },

  toggleSceneSelection(sceneId: string) {
    setSelectedSceneIds((current) => {
      const next = new Set(current)
      if (next.has(sceneId)) {
        next.delete(sceneId)
      } else {
        next.add(sceneId)
      }
      return next
    })
  },

  selectScene(sceneId: string) {
    setSelectedSceneIds((current) => {
      const next = new Set(current)
      next.add(sceneId)
      return next
    })
  },

  deselectScene(sceneId: string) {
    setSelectedSceneIds((current) => {
      const next = new Set(current)
      next.delete(sceneId)
      return next
    })
  },

  clearSelection() {
    setSelectedSceneIds(new Set<string>())
  },

  reset() {
    setMessageId(null)
    setSelectedSceneIds(new Set<string>())
    setIsOpen(false)
  },
}
