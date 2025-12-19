import { Button } from '@mythweavers/ui'
import { BsCheck, BsChevronDown, BsEraser } from 'solid-icons/bs'
import { Component, For, Show, createSignal, onCleanup, onMount } from 'solid-js'

interface RegenerateButtonProps {
  onRegenerate: (maxTokens: number) => void | Promise<void>
  disabled?: boolean
}

export const RegenerateButton: Component<RegenerateButtonProps> = (props) => {
  const [showPopover, setShowPopover] = createSignal(false)
  const [selectedTokens, setSelectedTokens] = createSignal(1024)
  const [isRegenerating, setIsRegenerating] = createSignal(false)
  let containerRef: HTMLDivElement | undefined

  const tokenOptions = [
    { value: 512, label: '512 tokens', description: 'Short response' },
    { value: 1024, label: '1024 tokens', description: 'Medium response' },
    { value: 2048, label: '2048 tokens', description: 'Long response' },
    { value: 4096, label: '4096 tokens', description: 'Extra long response' },
  ]

  const handleSelect = async (tokens: number, e?: MouseEvent) => {
    e?.stopPropagation()
    if (isRegenerating() || props.disabled) return

    setIsRegenerating(true)
    setSelectedTokens(tokens)
    setShowPopover(false)

    try {
      await props.onRegenerate(tokens)
    } finally {
      setIsRegenerating(false)
    }
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
        display: 'flex',
        position: 'relative',
      }}
    >
      <Button
        onClick={async (e) => {
          e.stopPropagation()
          if (!props.disabled && !isRegenerating()) {
            setIsRegenerating(true)
            try {
              await props.onRegenerate(selectedTokens())
            } finally {
              setIsRegenerating(false)
            }
          }
        }}
        disabled={props.disabled || isRegenerating()}
        title="Regenerate the last response with current input"
        style={{
          'border-radius': '5px 0 0 5px',
          'border-right': '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          'align-items': 'center',
          gap: '5px',
          background: 'var(--warning-color)',
          color: 'white',
        }}
      >
        <BsEraser /> Regenerate
      </Button>
      <Button
        onClick={() => setShowPopover(!showPopover())}
        disabled={props.disabled || isRegenerating()}
        title="Select response length"
        style={{
          'border-radius': '0 5px 5px 0',
          padding: '0.5rem 0.75rem',
          background: 'var(--warning-color)',
          color: 'white',
        }}
      >
        <BsChevronDown />
      </Button>

      <Show when={showPopover()}>
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: '0',
            background: 'var(--bg-secondary)',
            'border-radius': '8px',
            'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
            padding: '8px',
            'min-width': '200px',
            'z-index': '1000',
            border: '1px solid var(--border-color)',
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
                  padding: '8px 12px',
                  border: 'none',
                  background: selectedTokens() === option.value ? 'var(--primary-color)' : 'none',
                  color: selectedTokens() === option.value ? 'white' : 'var(--text-primary)',
                  'text-align': 'left',
                  cursor: 'pointer',
                  'border-radius': '4px',
                }}
                onClick={(e) => handleSelect(option.value, e)}
              >
                <div style={{ flex: '1' }}>
                  <div style={{ 'font-size': '14px', 'font-weight': '500', 'margin-bottom': '2px' }}>
                    {option.label}
                  </div>
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
