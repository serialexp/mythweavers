import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js'
import { BsChevronDown } from 'solid-icons/bs'
import styles from './TokenSelector.module.css'

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
    <div class={styles.tokenSelector} ref={containerRef}>
      <button
        onClick={() => props.onSubmit(selectedTokens())}
        disabled={props.disabled}
        class={styles.continueButton}
      >
        {getButtonText()}
      </button>
      <button
        onClick={() => setShowPopover(!showPopover())}
        disabled={props.disabled}
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
              onClick={() => handleSelect(option.value)}
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