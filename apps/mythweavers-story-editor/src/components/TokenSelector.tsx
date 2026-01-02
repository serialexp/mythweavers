import { DropdownItem, SplitButton } from '@mythweavers/ui'
import { Component, For, createEffect, createSignal } from 'solid-js'
import { settingsStore } from '../stores/settingsStore'

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
  { value: 8192, label: '8192 tokens', description: 'Maximum response' },
] as const

export const TokenSelector: Component<TokenSelectorProps> = (props) => {
  const [selectedTokens, setSelectedTokens] = createSignal(1024)

  // Auto-update token count when thinking setting changes
  // Double the thinking budget to allow for generation
  createEffect(() => {
    const thinkingBudget = settingsStore.thinkingBudget
    if (thinkingBudget > 0) {
      setSelectedTokens(thinkingBudget * 2)
    }
  })

  const handleSelect = (tokens: number) => {
    setSelectedTokens(tokens)
    props.onSubmit(tokens)
  }

  const getButtonLabel = () => {
    if (props.isAnalyzing) return 'Analyzing...'
    if (props.isLoading) return 'Generating...'

    const responseBudget = selectedTokens() - settingsStore.thinkingBudget

    return (
      <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-start' }}>
        <div>Continue Story</div>
        <div style={{ 'font-size': '0.75em', opacity: '0.7' }}>{responseBudget} tokens response</div>
      </div>
    )
  }

  return (
    <SplitButton
      label={getButtonLabel()}
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
