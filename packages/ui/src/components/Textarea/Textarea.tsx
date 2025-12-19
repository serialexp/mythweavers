import { type JSX, splitProps } from 'solid-js'
import { textarea } from './Textarea.css'

export interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Textarea size */
  size?: 'sm' | 'md' | 'lg'
  /** Resize behavior */
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

export const Textarea = (props: TextareaProps) => {
  const [local, variants, rest] = splitProps(props, ['class'], ['size', 'resize'])

  return <textarea class={`${textarea(variants)} ${local.class ?? ''}`} {...rest} />
}
