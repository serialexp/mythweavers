import { type JSX, splitProps } from 'solid-js'
import { input } from './Input.css'

export interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input size */
  size?: 'sm' | 'md' | 'lg'
}

export const Input = (props: InputProps) => {
  const [local, variants, rest] = splitProps(props, ['class'], ['size'])

  return <input class={`${input(variants)} ${local.class ?? ''}`} {...rest} />
}
