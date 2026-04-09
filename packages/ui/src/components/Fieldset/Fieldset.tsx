import { type JSX, type ParentComponent, splitProps } from 'solid-js'
import * as styles from './Fieldset.css'

export interface FieldsetProps extends JSX.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  /** Legend text displayed at the top of the fieldset */
  legend: string
  children: JSX.Element
}

export const Fieldset: ParentComponent<FieldsetProps> = (props) => {
  const [local, rest] = splitProps(props, ['legend', 'children', 'class'])

  return (
    <fieldset class={`${styles.fieldset} ${local.class ?? ''}`} {...rest}>
      <legend class={styles.legend}>{local.legend}</legend>
      {local.children}
    </fieldset>
  )
}
