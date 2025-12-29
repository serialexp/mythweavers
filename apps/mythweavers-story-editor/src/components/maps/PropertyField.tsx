import { Component, For, Show } from 'solid-js'
import type { PropertyDefinition } from '../../types/core'
import * as styles from '../Maps.css'

interface PropertyFieldProps {
  definition: PropertyDefinition
  value: unknown
  error?: string
  onChange: (value: unknown) => void
  onBlur?: () => void
}

/**
 * Renders a form field based on a property definition from the schema.
 * Supports text, number, enum, color, and boolean types.
 */
export const PropertyField: Component<PropertyFieldProps> = (props) => {
  const stringValue = () => (props.value as string) ?? ''
  const boolValue = () => Boolean(props.value)

  // Format number with thousand separators
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  // Parse number string (removes commas, spaces, etc.)
  const parseNumber = (value: string): number | null => {
    if (!value.trim()) return null
    const cleaned = value.replace(/[^\d.-]/g, '')
    const num = Number.parseFloat(cleaned)
    return Number.isNaN(num) ? null : num
  }

  const handleNumberBlur = () => {
    const parsed = parseNumber(stringValue())
    if (parsed !== null) {
      props.onChange(formatNumber(parsed))
    }
    props.onBlur?.()
  }

  return (
    <div class={styles.landmarkFormGroup}>
      <label>{props.definition.label}</label>

      {/* Text input */}
      <Show when={props.definition.type === 'text'}>
        <input
          type="text"
          class={`${styles.landmarkInput} ${props.error ? styles.inputError : ''}`}
          value={stringValue()}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onBlur={props.onBlur}
          placeholder={props.definition.placeholder}
        />
      </Show>

      {/* Number input (text field with number formatting) */}
      <Show when={props.definition.type === 'number'}>
        <input
          type="text"
          class={`${styles.landmarkInput} ${props.error ? styles.inputError : ''}`}
          value={stringValue()}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onBlur={handleNumberBlur}
          placeholder={props.definition.placeholder || 'Enter a number'}
        />
      </Show>

      {/* Enum select */}
      <Show when={props.definition.type === 'enum'}>
        <select
          class={styles.landmarkSelect}
          value={stringValue()}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        >
          <option value="">None</option>
          <For each={props.definition.options}>
            {(option) => <option value={option.value}>{option.label}</option>}
          </For>
        </select>
      </Show>

      {/* Color picker */}
      <Show when={props.definition.type === 'color'}>
        <input
          type="color"
          class={styles.colorInput}
          value={stringValue() || '#000000'}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </Show>

      {/* Boolean checkbox */}
      <Show when={props.definition.type === 'boolean'}>
        <label style={{ display: 'flex', 'align-items': 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={boolValue()}
            onChange={(e) => props.onChange(e.currentTarget.checked)}
          />
          <span>{props.definition.description || props.definition.label}</span>
        </label>
      </Show>

      {/* Error message */}
      <Show when={props.error}>
        <span class={styles.errorMessage}>{props.error}</span>
      </Show>

      {/* Description hint */}
      <Show when={props.definition.description && props.definition.type !== 'boolean'}>
        <span class={styles.landmarkFormHint}>{props.definition.description}</span>
      </Show>
    </div>
  )
}
