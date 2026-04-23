import { Button, Dropdown, DropdownDivider, DropdownItem, Spinner } from '@mythweavers/ui'
import { Component, Show } from 'solid-js'
import { PhCodeIcon, PhDotsThreeIcon, PhInfoIcon, PhListChecksIcon, PhPencilSimpleLineIcon, PhScissorsIcon } from 'solidjs-phosphor'

interface MessageActionsDropdownProps {
  onSummarize: () => void
  onToggleDebug: () => void
  onEditScript?: () => void
  onRewrite?: () => void
  onCut?: () => void
  onUncut?: () => void
  isSummarizing?: boolean
  hasSummary?: boolean
  hasScript?: boolean
  showDebug?: boolean
  disabled?: boolean
  isCut?: boolean
}

export const MessageActionsDropdown: Component<MessageActionsDropdownProps> = (props) => {
  return (
    <Dropdown
      alignRight
      portal
      trigger={
        <Button variant="ghost" size="sm" iconOnly disabled={props.disabled} title="More actions">
          <PhDotsThreeIcon />
        </Button>
      }
    >
      <DropdownItem
        onClick={props.onSummarize}
        disabled={props.isSummarizing}
        icon={props.isSummarizing ? <Spinner size="sm" /> : <PhListChecksIcon />}
      >
        {props.hasSummary ? 'Re-summarize' : 'Summarize'}
      </DropdownItem>

      <Show when={props.onRewrite}>
        <DropdownItem onClick={props.onRewrite} icon={<PhPencilSimpleLineIcon />}>
          Rewrite
        </DropdownItem>
      </Show>

      <DropdownDivider />

      <Show when={props.onEditScript}>
        <DropdownItem onClick={props.onEditScript} icon={<PhCodeIcon />}>
          {props.hasScript ? 'Edit' : 'Add'} Script
        </DropdownItem>
      </Show>

      <Show when={props.onCut && !props.isCut}>
        <DropdownItem onClick={props.onCut} icon={<PhScissorsIcon />}>
          Cut Message
        </DropdownItem>
      </Show>

      <Show when={props.onUncut && props.isCut}>
        <DropdownItem onClick={props.onUncut} icon={<PhScissorsIcon />}>
          Uncut Message
        </DropdownItem>
      </Show>

      <DropdownItem onClick={props.onToggleDebug} icon={<PhInfoIcon />}>
        {props.showDebug ? 'Hide' : 'Show'} Debug
      </DropdownItem>
    </Dropdown>
  )
}
