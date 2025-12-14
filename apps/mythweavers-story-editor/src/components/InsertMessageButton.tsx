import { Component } from 'solid-js'
import { BsPlus } from 'solid-icons/bs'
import { IconButton } from './IconButton'

interface InsertMessageButtonProps {
  onInsert: () => void
}

export const InsertMessageButton: Component<InsertMessageButtonProps> = (props) => {
  return (
    <IconButton
      onClick={props.onInsert}
      title="Insert new message here"
    >
      <BsPlus size={18} />
    </IconButton>
  )
}