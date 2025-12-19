import { Button } from '@mythweavers/ui'
import { BsCheck, BsChevronDown } from 'solid-icons/bs'
import { Component, For, Show, createSignal, onCleanup, onMount } from 'solid-js'

interface TokenSelectorProps {
  onSubmit: (maxTokens: number) => void
  disabled: boolean
  isLoading: boolean
  isAnalyzing: boolean
}

export const TokenSelector: Component<TokenSelectorProps> = (props) => {
  const [showPopover, setShowPopover] = createSignal(false)
  const [selectedTokens, setSelectedTokens] = createSignal(1024)
  let containerRef: HTMLDivElement | undefined

  const tokenOptions = [
    { value: 512, label: '512 tokens', description: 'Short response' },
    { value: 1024, label: '1024 tokens', description: 'Medium response' },
    { value: 2048, label: '2048 tokens', description: 'Long response' },
    { value: 4096, label: '4096 tokens', description: 'Extra long response' },
  ]

  const handleSelect = (tokens: number) => {
    setSelectedTokens(tokens)
    setShowPopover(false)
    props.onSubmit(tokens)
  }

  const getButtonText = () => {
    if (props.isAnalyzing) return 'Analyzing...'
    if (props.isLoading) return 'Generating...'
    return 'Continue Story'
  }

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setShowPopover(false)
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside)
  })

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        gap: '0',
      }}
    >
      <Button
        size="sm"
        onClick={() => props.onSubmit(selectedTokens())}
        disabled={props.disabled}
        style={{
          'border-radius': '5px 0 0 5px',
          'border-right': '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {getButtonText()}
      </Button>
      <Button
        size="sm"
        iconOnly
        onClick={() => setShowPopover(!showPopover())}
        disabled={props.disabled}
        title="Select response length"
        style={{
          'border-radius': '0 5px 5px 0',
        }}
      >
        <BsChevronDown />
      </Button>

      <Show when={showPopover()}>
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            right: '0',
            'margin-bottom': '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            'border-radius': '4px',
            'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.15)',
            'min-width': '200px',
            'z-index': '1000',
          }}
        >
          <For each={tokenOptions}>
            {(option) => (
              <button
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '10px 16px',
                  background: selectedTokens() === option.value ? 'var(--primary-color)' : 'none',
                  border: 'none',
                  'border-bottom': '1px solid var(--border-color)',
                  color: selectedTokens() === option.value ? 'white' : 'var(--text-primary)',
                  cursor: 'pointer',
                  'text-align': 'left',
                }}
                onClick={() => handleSelect(option.value)}
              >
                <div style={{ flex: '1' }}>
                  <div style={{ 'font-weight': '500', 'margin-bottom': '2px' }}>{option.label}</div>
                  <div style={{ 'font-size': '12px', opacity: '0.7' }}>{option.description}</div>
                </div>
                <Show when={selectedTokens() === option.value}>
                  <BsCheck size={16} />
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
