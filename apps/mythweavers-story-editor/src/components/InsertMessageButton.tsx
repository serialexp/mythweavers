import { IconButton } from '@mythweavers/ui'
import { Component } from 'solid-js'
import { PhPlusIcon } from 'solidjs-phosphor'

interface InsertMessageButtonProps {
  onInsert: () => void
}

export const InsertMessageButton: Component<InsertMessageButtonProps> = (props) => {
  return (
    <IconButton onClick={props.onInsert} aria-label="Insert new message here">
      <PhPlusIcon size={18} />
    </IconButton>
  )
}
