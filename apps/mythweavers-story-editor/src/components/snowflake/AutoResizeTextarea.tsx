import { Component, type JSX, createEffect, splitProps } from 'solid-js'

interface AutoResizeTextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onValueInput?: (value: string) => void
}

/** A textarea that grows to fit its content. */
export const AutoResizeTextarea: Component<AutoResizeTextareaProps> = (props) => {
  const [local, rest] = splitProps(props, ['value', 'onValueInput'])
  let ref: HTMLTextAreaElement | undefined

  const resize = () => {
    if (!ref) return
    ref.style.height = 'auto'
    ref.style.height = `${ref.scrollHeight}px`
  }

  // Re-fit whenever the bound value changes (e.g. after an AI write).
  createEffect(() => {
    void local.value
    resize()
  })

  return (
    <textarea
      ref={ref}
      value={local.value}
      onInput={(e) => {
        resize()
        local.onValueInput?.(e.currentTarget.value)
      }}
      {...rest}
    />
  )
}
