import { createSignal } from 'solid-js'

const [isOpen, setIsOpen] = createSignal(false)

export const quickLlmStore = {
  get isOpen() {
    return isOpen()
  },
  show() {
    setIsOpen(true)
  },
  hide() {
    setIsOpen(false)
  },
  toggle() {
    setIsOpen((prev) => !prev)
  },
}
