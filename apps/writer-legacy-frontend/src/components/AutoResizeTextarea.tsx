import { JSX, createEffect, createSignal, onCleanup } from 'solid-js'

const createGhostTextarea = (textArea: HTMLTextAreaElement) => {
  const ghost = document.createElement('textarea')
  const computedStyle = window.getComputedStyle(textArea)

  // Copy relevant styles from the original textarea
  ghost.style.font = computedStyle.font
  ghost.style.padding = computedStyle.padding
  ghost.style.border = computedStyle.border
  ghost.style.boxSizing = computedStyle.boxSizing
  ghost.style.lineHeight = computedStyle.lineHeight
  ghost.style.letterSpacing = computedStyle.letterSpacing

  ghost.style.position = 'absolute'
  ghost.style.top = '-9999px'
  ghost.style.left = '-9999px'
  ghost.style.visibility = 'hidden'
  ghost.style.overflow = 'hidden'
  ghost.style.height = 'auto'
  ghost.style.resize = 'none'
  document.body.appendChild(ghost)
  return ghost
}

const resize = (textArea: HTMLTextAreaElement, ghost: HTMLTextAreaElement) => {
  ghost.value = textArea.value
  ghost.style.width = `${textArea.clientWidth}px`
  textArea.style.height = `${ghost.scrollHeight}px`
}

export const AutoResizeTextarea = (
  props: Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onInput'> & {
    onInput?: (e: InputEvent, selectionStart: number) => void
    value?: string
  },
) => {
  const [textarea, setTextarea] = createSignal<HTMLTextAreaElement>()
  let ghostTextarea: HTMLTextAreaElement

  createEffect(() => {
    const ta = textarea()
    if (ta) {
      if (!ghostTextarea) {
        ghostTextarea = createGhostTextarea(ta)
      }
      resize(ta, ghostTextarea)
    }
  })

  createEffect(() => {
    const ta = textarea()
    if (ta && ghostTextarea && props.value !== undefined) {
      resize(ta, ghostTextarea)
    }
  })

  onCleanup(() => {
    if (ghostTextarea) {
      document.body.removeChild(ghostTextarea)
    }
  })

  return (
    <textarea
      {...props}
      ref={setTextarea}
      class="w-full py-2 px-2 outline-none resize-none"
      onInput={(e) => {
        const ta = textarea()
        if (ta) {
          resize(ta, ghostTextarea)
        }
        props.onInput?.(e, ta?.selectionStart)
      }}
    />
  )
}
