import { Button, ButtonGroup, Dropdown, DropdownItem } from '@mythweavers/ui'
import { Component, For } from 'solid-js'
import { JSX } from 'solid-js'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import * as styles from './MessageStyles.css'
import { PhCaretDownIcon } from 'solidjs-phosphor'

interface MessageRegenerateButtonProps {
  onRegenerate: (maxTokens: number) => void
  disabled?: boolean
  title: string
  icon: JSX.Element
}

const TOKEN_OPTIONS = [
  { value: 512, label: '512', description: 'Short' },
  { value: 1024, label: '1024', description: 'Medium' },
  { value: 2048, label: '2048', description: 'Long' },
  { value: 4096, label: '4096', description: 'Extra long' },
  { value: 8192, label: '8192', description: 'Very long' },
]

export const MessageRegenerateButton: Component<MessageRegenerateButtonProps> = (props) => {
  const handleSelect = (tokens: number) => {
    if (tokens <= effectiveSettings.thinkingBudget) return
    effectiveSettings.setMaxTokens(tokens)
    props.onRegenerate(tokens)
  }

  return (
    <ButtonGroup>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => props.onRegenerate(effectiveSettings.maxTokens)}
        disabled={props.disabled}
        title={`${props.title} (${effectiveSettings.maxTokens} tokens)`}
      >
        {props.icon}
        <span class={styles.regenerateTokenBadge}>{effectiveSettings.maxTokens}</span>
      </Button>
      <Dropdown
        alignRight
        portal
        trigger={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            disabled={props.disabled}
            title={`${props.title} - Select token limit`}
          >
            <PhCaretDownIcon />
          </Button>
        }
      >
        <For each={TOKEN_OPTIONS}>
          {(option) => {
            const disabled = () => option.value <= effectiveSettings.thinkingBudget
            return (
              <DropdownItem
                active={effectiveSettings.maxTokens === option.value}
                onClick={() => handleSelect(option.value)}
                disabled={disabled()}
              >
                {option.label} - {option.description}
              </DropdownItem>
            )
          }}
        </For>
      </Dropdown>
    </ButtonGroup>
  )
}
