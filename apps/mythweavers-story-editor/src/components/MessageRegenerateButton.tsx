import { Button, ButtonGroup, Dropdown, DropdownItem } from '@mythweavers/ui'
import { BsChevronDown } from 'solid-icons/bs'
import { Component, For, createSignal } from 'solid-js'
import { JSX } from 'solid-js'
import * as styles from './MessageStyles.css'

interface MessageRegenerateButtonProps {
  onRegenerate: (maxTokens: number) => void
  disabled?: boolean
  title: string
  icon: JSX.Element
}

export const MessageRegenerateButton: Component<MessageRegenerateButtonProps> = (props) => {
  const [selectedTokens, setSelectedTokens] = createSignal(4096)

  const tokenOptions = [
    { value: 512, label: '512', description: 'Short' },
    { value: 1024, label: '1024', description: 'Medium' },
    { value: 2048, label: '2048', description: 'Long' },
    { value: 4096, label: '4096', description: 'Extra long' },
    { value: 8192, label: '8192', description: 'Very long' },
  ]

  const handleSelect = (tokens: number) => {
    setSelectedTokens(tokens)
    props.onRegenerate(tokens)
  }

  return (
    <ButtonGroup>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => props.onRegenerate(selectedTokens())}
        disabled={props.disabled}
        title={`${props.title} (${selectedTokens()} tokens)`}
      >
        {props.icon}
        <span class={styles.regenerateTokenBadge}>{selectedTokens()}</span>
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
            <BsChevronDown />
          </Button>
        }
      >
        <For each={tokenOptions}>
          {(option) => (
            <DropdownItem
              active={selectedTokens() === option.value}
              onClick={() => handleSelect(option.value)}
            >
              {option.label} - {option.description}
            </DropdownItem>
          )}
        </For>
      </Dropdown>
    </ButtonGroup>
  )
}
