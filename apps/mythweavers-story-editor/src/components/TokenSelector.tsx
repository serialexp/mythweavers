import { DropdownItem, SplitButton } from '@mythweavers/ui'
import { Component, For, createEffect } from 'solid-js'
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
  // Auto-adjust maxTokens if current selection is impossible due to thinking budget
  createEffect(() => {
    const thinkingBudget = settingsStore.thinkingBudget
    const currentMax = settingsStore.maxTokens

    // Need at least some tokens for response (thinking budget + minimum response)
    if (currentMax <= thinkingBudget) {
      // Find the lowest valid option
      const lowestValid = TOKEN_OPTIONS.find((opt) => opt.value > thinkingBudget)
      if (lowestValid) {
        settingsStore.setMaxTokens(lowestValid.value)
      }
    }
  })

  const isOptionDisabled = (value: number) => value <= settingsStore.thinkingBudget

  const handleSelect = (tokens: number) => {
    if (isOptionDisabled(tokens)) return
    settingsStore.setMaxTokens(tokens)
    props.onSubmit(tokens)
  }

  const getButtonLabel = () => {
    if (props.isAnalyzing) return 'Analyzing...'
    if (props.isLoading) return 'Generating...'

    const responseBudget = settingsStore.maxTokens - settingsStore.thinkingBudget

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
      onClick={() => props.onSubmit(settingsStore.maxTokens)}
      disabled={props.disabled}
      alignRight
    >
      <For each={TOKEN_OPTIONS}>
        {(option) => {
          const disabled = () => option.value <= settingsStore.thinkingBudget
          return (
            <DropdownItem
              onClick={() => handleSelect(option.value)}
              active={settingsStore.maxTokens === option.value}
              disabled={disabled()}
            >
              <span style={{ display: 'flex', 'flex-direction': 'column' }}>
                <span style={{ 'font-weight': '500' }}>{option.label}</span>
                <span style={{ 'font-size': '12px', opacity: '0.7' }}>{option.description}</span>
              </span>
            </DropdownItem>
          )
        }}
      </For>
    </SplitButton>
  )
}
