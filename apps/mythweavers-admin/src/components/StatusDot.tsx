import * as styles from "./StatusDot.css"

interface StatusDotProps {
  status: "success" | "error" | "warning"
  title?: string
}

export function StatusDot(props: StatusDotProps) {
  return (
    <span
      class={`${styles.base} ${styles.variant[props.status]}`}
      title={props.title}
    />
  )
}
