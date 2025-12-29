import { For, type JSX, splitProps } from 'solid-js'
import { select } from './Select.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Select size */
  size?: 'sm' | 'md' | 'lg'
  /** Options to display */
  options: SelectOption[]
  /** Placeholder text when no value selected */
  placeholder?: string
}

export const Select = (props: SelectProps) => {
  const [local, variants, rest] = splitProps(props, ['class', 'options', 'placeholder', 'value'], ['size'])

  return (
    <select class={`${select(variants)} ${local.class ?? ''}`} value={local.value} {...rest}>
      {local.placeholder && (
        <option value="" disabled selected={local.value === '' || local.value === undefined}>
          {local.placeholder}
        </option>
      )}
      <For each={local.options}>
        {(option) => (
          <option value={option.value} disabled={option.disabled} selected={local.value === option.value}>
            {option.label}
          </option>
        )}
      </For>
    </select>
  )
}
