import { DropdownItem, SplitButton } from '@mythweavers/ui'
import { Component, For, createSignal } from 'solid-js'

interface TokenSelectorProps {
  onSubmit: (maxTokens: number) => void
  disabled: boolean
  isLoading: boolean
  isAnalyzing: boolean
}

const TOKEN_OPTIONS = [
  { value: 512, label: '512 tokens', description: 'Short response' },
  { value: 1024, label: '1024 tokens', description: 'Medium response' },
  { value: 2048, label: '2048 tokens', description: 'Long response' },
  { value: 4096, label: '4096 tokens', description: 'Extra long response' },
] as const

export const TokenSelector: Component<TokenSelectorProps> = (props) => {
  const [selectedTokens, setSelectedTokens] = createSignal(1024)

  const handleSelect = (tokens: number) => {
    setSelectedTokens(tokens)
    props.onSubmit(tokens)
  }

  const getButtonText = () => {
    if (props.isAnalyzing) return 'Analyzing...'
    if (props.isLoading) return 'Generating...'
    return 'Continue Story'
  }

  return (
    <SplitButton
      label={getButtonText()}
      size="sm"
      onClick={() => props.onSubmit(selectedTokens())}
      disabled={props.disabled}
      alignRight
    >
      <For each={TOKEN_OPTIONS}>
        {(option) => (
          <DropdownItem
            onClick={() => handleSelect(option.value)}
            active={selectedTokens() === option.value}
          >
            <span style={{ display: 'flex', 'flex-direction': 'column' }}>
              <span style={{ 'font-weight': '500' }}>{option.label}</span>
              <span style={{ 'font-size': '12px', opacity: '0.7' }}>{option.description}</span>
            </span>
          </DropdownItem>
        )}
      </For>
    </SplitButton>
  )
}
