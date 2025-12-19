import { type JSX, type ParentComponent, Show, createUniqueId } from 'solid-js'
import * as styles from './FormField.css'

export interface FormFieldProps {
  /** Label text or JSX element */
  label: string | JSX.Element
  /** Field is required */
  required?: boolean
  /** Show "(optional)" text instead of required indicator */
  showOptional?: boolean
  /** Help text displayed below input (alias: hint) */
  helpText?: string
  /** Help text displayed below input (alias for helpText) */
  hint?: string
  /** Error message (also sets aria-invalid on child input) */
  error?: string
  /** ID for the input (auto-generated if not provided) */
  id?: string
  /** Additional class for container */
  class?: string
  /** Additional inline styles */
  style?: JSX.CSSProperties
  /** The form control (Input, Select, Textarea, etc.) */
  children: JSX.Element
}

export const FormField: ParentComponent<FormFieldProps> = (props) => {
  const fieldId = props.id ?? createUniqueId()
  const errorId = `${fieldId}-error`
  const helpId = `${fieldId}-help`
  const helpText = () => props.helpText ?? props.hint

  return (
    <div class={`${styles.container} ${props.class ?? ''}`} style={props.style}>
      <div class={styles.labelRow}>
        <label for={fieldId} class={styles.label}>
          {props.label}
          <Show when={props.required}>
            <span class={styles.required} aria-hidden="true">
              *
            </span>
          </Show>
        </label>
        <Show when={props.showOptional && !props.required}>
          <span class={styles.optional}>Optional</span>
        </Show>
      </div>

      {/* Clone children and inject id, aria-invalid, aria-describedby */}
      {props.children}

      <Show when={helpText() && !props.error}>
        <p id={helpId} class={styles.helpText}>
          {helpText()}
        </p>
      </Show>

      <Show when={props.error}>
        <p id={errorId} class={styles.errorText} role="alert">
          {props.error}
        </p>
      </Show>
    </div>
  )
}
