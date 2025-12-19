import type { JSX } from 'solid-js'

export const FormField = ({
  children,
  label,
  helpText,
}: {
  children: JSX.Element
  label: string
  helpText?: string
}) => {
  return (
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium text-primary">{label}</label>
      {children}
      {helpText && <p class="text-sm text-gray-500">{helpText}</p>}
    </div>
  )
}
