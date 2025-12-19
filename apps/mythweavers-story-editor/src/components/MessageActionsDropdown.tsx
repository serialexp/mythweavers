import { Button, Dropdown, DropdownDivider, DropdownItem, Spinner } from '@mythweavers/ui'
import {
  BsCodeSlash,
  BsInfoCircle,
  BsListCheck,
  BsPencilSquare,
  BsScissors,
  BsSearch,
  BsThreeDots,
} from 'solid-icons/bs'
import { Component, Show } from 'solid-js'

interface MessageActionsDropdownProps {
  onSummarize: () => void
  onAnalyze: () => void
  onToggleDebug: () => void
  onEditScript?: () => void
  onRewrite?: () => void
  onCut?: () => void
  onUncut?: () => void
  isSummarizing?: boolean
  isAnalyzing?: boolean
  hasSummary?: boolean
  hasAnalysis?: boolean
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
          <BsThreeDots />
        </Button>
      }
    >
      <DropdownItem
        onClick={props.onSummarize}
        disabled={props.isSummarizing}
        icon={props.isSummarizing ? <Spinner size="sm" /> : <BsListCheck />}
      >
        {props.hasSummary ? 'Re-summarize' : 'Summarize'}
      </DropdownItem>

      <DropdownItem
        onClick={props.onAnalyze}
        disabled={props.isAnalyzing}
        icon={props.isAnalyzing ? <Spinner size="sm" /> : <BsSearch />}
      >
        {props.hasAnalysis ? 'Re-analyze' : 'Analyze'}
      </DropdownItem>

      <Show when={props.onRewrite}>
        <DropdownItem onClick={props.onRewrite} icon={<BsPencilSquare />}>
          Rewrite
        </DropdownItem>
      </Show>

      <DropdownDivider />

      <Show when={props.onEditScript}>
        <DropdownItem onClick={props.onEditScript} icon={<BsCodeSlash />}>
          {props.hasScript ? 'Edit' : 'Add'} Script
        </DropdownItem>
      </Show>

      <Show when={props.onCut && !props.isCut}>
        <DropdownItem onClick={props.onCut} icon={<BsScissors />}>
          Cut Message
        </DropdownItem>
      </Show>

      <Show when={props.onUncut && props.isCut}>
        <DropdownItem onClick={props.onUncut} icon={<BsScissors />}>
          Uncut Message
        </DropdownItem>
      </Show>

      <DropdownItem onClick={props.onToggleDebug} icon={<BsInfoCircle />}>
        {props.showDebug ? 'Hide' : 'Show'} Debug
      </DropdownItem>
    </Dropdown>
  )
}
