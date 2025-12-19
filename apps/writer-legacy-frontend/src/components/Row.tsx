import type { JSX } from 'solid-js'

export const Row = (props: {
  main: JSX.Element
  buttons?: JSX.Element
  extra?: JSX.Element
  selected: boolean
  borderColor?: string
  onClick?: () => void
  onMouseDown?: () => void
  id?: string
}) => {
  return (
    <div
      id={props.id}
      onClick={props.onClick}
      onMouseDown={props.onMouseDown}
      class={`relative flex flex-row justify-between w-full max-w-6xl ${
        props.selected ? 'bg-gray-100' : 'bg-gray-200'
      }`}
    >
      <div
        class={`border-l-4 ${
          props.borderColor ? props.borderColor : 'border-gray-200'
        } px-1 bg-white gap-2 flex-1 max-w-2xl relative border-solid`}
      >
        {props.main}
      </div>
      {props.extra ? <div class={'flex-1 relative'}>{props.extra}</div> : null}
      <div class={`gap-2 ${props.buttons ? 'px-2' : 'px-2'}`}>{props.buttons}</div>
    </div>
  )
}
