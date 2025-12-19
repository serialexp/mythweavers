import { IconButton } from '@mythweavers/ui'
import { BsPlus } from 'solid-icons/bs'
import { Component } from 'solid-js'

interface InsertMessageButtonProps {
  onInsert: () => void
}

export const InsertMessageButton: Component<InsertMessageButtonProps> = (props) => {
  return (
    <IconButton onClick={props.onInsert} aria-label="Insert new message here">
      <BsPlus size={18} />
    </IconButton>
  )
}
