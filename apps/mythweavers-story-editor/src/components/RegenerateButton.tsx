import { Button } from '@mythweavers/ui'
import { BsCheck, BsChevronDown, BsEraser } from 'solid-icons/bs'
import { Component, For, Show, createSignal, onCleanup, onMount } from 'solid-js'
import * as styles from './RegenerateButton.css'

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
    <div ref={containerRef} class={styles.container}>
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
        class={styles.mainButton}
      >
        <BsEraser /> Regenerate
      </Button>
      <Button
        onClick={() => setShowPopover(!showPopover())}
        disabled={props.disabled || isRegenerating()}
        title="Select response length"
        class={styles.dropdownButton}
      >
        <BsChevronDown />
      </Button>

      <Show when={showPopover()}>
        <div class={styles.popover}>
          <For each={tokenOptions}>
            {(option) => (
              <button
                class={`${styles.optionButton} ${selectedTokens() === option.value ? styles.optionButtonSelected : styles.optionButtonUnselected}`}
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
