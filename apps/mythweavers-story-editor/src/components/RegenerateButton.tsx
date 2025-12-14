import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js'
import { BsEraser, BsChevronDown } from 'solid-icons/bs'
import styles from './RegenerateButton.module.css'

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
    <div class={styles.regenerateButton} ref={containerRef}>
      <button
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
        class={styles.mainButton}
        title="Regenerate the last response with current input"
      >
        <BsEraser /> Regenerate
      </button>
      <button
        onClick={() => setShowPopover(!showPopover())}
        disabled={props.disabled || isRegenerating()}
        class={styles.dropdownButton}
        title="Select response length"
      >
        <BsChevronDown />
      </button>
      
      <Show when={showPopover()}>
        <div class={styles.popover}>
          {tokenOptions.map(option => (
            <button
              class={`${styles.tokenOption} ${selectedTokens() === option.value ? styles.selected : ''}`}
              onClick={(e) => handleSelect(option.value, e)}
            >
              <div class={styles.optionLabel}>{option.label}</div>
              <div class={styles.optionDescription}>{option.description}</div>
            </button>
          ))}
        </div>
      </Show>
    </div>
  )
}