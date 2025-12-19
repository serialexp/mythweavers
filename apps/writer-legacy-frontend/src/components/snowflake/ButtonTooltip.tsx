import { Show } from 'solid-js'

type ButtonTooltipProps = {
  title: string
  error?: boolean
  disabled?: boolean
  children: any
  onClick?: () => void
  align?: 'left' | 'center' | 'right'
}

export const ButtonTooltip = (props: ButtonTooltipProps) => {
  const alignment = () => {
    switch (props.align ?? 'right') {
      case 'left':
        return 'left-0'
      case 'center':
        return 'left-1/2 -translate-x-1/2'
      case 'right':
        return 'right-0'
    }
  }

  return (
    <div class="relative group">
      <button type="button" class="btn btn-ghost btn-xs" onClick={props.onClick} disabled={props.disabled}>
        {props.children}
      </button>
      <Show when={props.title}>
        <div
          class={`absolute bottom-full mb-2 hidden group-hover:block w-48 text-xs p-2 rounded shadow ${
            props.error
              ? 'bg-error/90 text-error-content border border-error-content/20'
              : 'bg-neutral text-neutral-content border border-neutral-content/20'
          } ${alignment()}`}
        >
          {props.title}
        </div>
      </Show>
    </div>
  )
}
