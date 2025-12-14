import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js'
import { BsChevronDown } from 'solid-icons/bs'
import { JSX } from 'solid-js'
import styles from './MessageRegenerateButton.module.css'
import messageStyles from './Message.module.css'

interface MessageRegenerateButtonProps {
  onRegenerate: (maxTokens: number) => void
  disabled?: boolean
  title: string
  icon: JSX.Element
}

export const MessageRegenerateButton: Component<MessageRegenerateButtonProps> = (props) => {
  const [showPopover, setShowPopover] = createSignal(false)
  const [selectedTokens, setSelectedTokens] = createSignal(4096)
  let containerRef: HTMLDivElement | undefined

  const tokenOptions = [
    { value: 512, label: '512', description: 'Short' },
    { value: 1024, label: '1024', description: 'Medium' },
    { value: 2048, label: '2048', description: 'Long' },
    { value: 4096, label: '4096', description: 'Extra long' },
    { value: 8192, label: '8192', description: 'Very long' },
  ]

  const handleSelect = (tokens: number) => {
    setSelectedTokens(tokens)
    setShowPopover(false)
    props.onRegenerate(tokens)
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
    <div class={styles.regenerateButtonContainer} ref={containerRef}>
      <button
        class={messageStyles.actionButton}
        onClick={() => props.onRegenerate(selectedTokens())}
        disabled={props.disabled}
        title={`${props.title} (${selectedTokens()} tokens)`}
      >
        {props.icon}
        <span style="font-size: 11px; opacity: 0.7; margin-left: 2px;">
          {selectedTokens()}
        </span>
      </button>
      <button
        onClick={() => setShowPopover(!showPopover())}
        disabled={props.disabled}
        class={`${messageStyles.actionButton} ${styles.dropdownTrigger}`}
        title={`${props.title} - Select token limit`}
      >
        <BsChevronDown />
      </button>
      
      <Show when={showPopover()}>
        <div class={styles.popover}>
          {tokenOptions.map(option => (
            <button
              class={`${styles.tokenOption} ${selectedTokens() === option.value ? styles.selected : ''}`}
              onClick={() => handleSelect(option.value)}
              title={`${option.label} tokens - ${option.description} response`}
            >
              <span class={styles.tokenValue}>{option.label}</span>
              <span class={styles.tokenDesc}>{option.description}</span>
            </button>
          ))}
        </div>
      </Show>
    </div>
  )
}