import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js'
import { BsThreeDots, BsListCheck, BsSearch, BsInfoCircle, BsCodeSlash, BsPencilSquare, BsScissors } from 'solid-icons/bs'
import styles from './MessageActionsDropdown.module.css'
import messageStyles from './Message.module.css'

interface MessageActionsDropdownProps {
  onSummarize: () => void
  onAnalyze: () => void
  onToggleDebug: () => void
  onEditScript?: () => void
  onRewrite?: () => void
  onCut?: () => void
  onUncut?: () => void
  isSummarizing?: boolean
  isAnalyzing?: boolean
  hasSummary?: boolean
  hasAnalysis?: boolean
  hasScript?: boolean
  showDebug?: boolean
  disabled?: boolean
  isCut?: boolean
}

export const MessageActionsDropdown: Component<MessageActionsDropdownProps> = (props) => {
  const [showDropdown, setShowDropdown] = createSignal(false)
  let containerRef: HTMLDivElement | undefined

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setShowDropdown(false)
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside)
  })

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  const handleAction = (action: () => void) => {
    action()
    setShowDropdown(false)
  }

  return (
    <div class={styles.dropdownContainer} ref={containerRef}>
      <button
        class={messageStyles.actionButton}
        onClick={() => setShowDropdown(!showDropdown())}
        disabled={props.disabled}
        title="More actions"
      >
        <BsThreeDots />
      </button>
      
      <Show when={showDropdown()}>
        <div class={styles.dropdown}>
          <button
            class={styles.dropdownItem}
            onClick={() => handleAction(props.onSummarize)}
            disabled={props.isSummarizing}
            title={
              props.isSummarizing ? "Currently summarizing..." :
              props.hasSummary ? "Re-summarize this message" : "Summarize this message"
            }
          >
            <Show when={props.isSummarizing} fallback={<BsListCheck />}>
              <span class={styles.loading}>...</span>
            </Show>
            <span>{props.hasSummary ? 'Re-summarize' : 'Summarize'}</span>
          </button>
          
          <button
            class={styles.dropdownItem}
            onClick={() => handleAction(props.onAnalyze)}
            disabled={props.isAnalyzing}
            title={
              props.isAnalyzing ? "Currently analyzing..." :
              props.hasAnalysis ? "Re-analyze this message" : "Analyze this message"
            }
          >
            <Show when={props.isAnalyzing} fallback={<BsSearch />}>
              <span class={styles.loading}>...</span>
            </Show>
            <span>{props.hasAnalysis ? 'Re-analyze' : 'Analyze'}</span>
          </button>
          
          <Show when={props.onRewrite}>
            <button
              class={styles.dropdownItem}
              onClick={() => handleAction(props.onRewrite!)}
              title="Rewrite this message"
            >
              <BsPencilSquare />
              <span>Rewrite</span>
            </button>
          </Show>

          <div class={styles.divider} />
          
          <Show when={props.onEditScript}>
            <button
              class={styles.dropdownItem}
              onClick={() => handleAction(props.onEditScript!)}
              title={props.hasScript ? "Edit turn script" : "Add turn script"}
            >
              <BsCodeSlash />
              <span>{props.hasScript ? 'Edit' : 'Add'} Script</span>
            </button>
          </Show>

          <Show when={props.onCut && !props.isCut}>
            <button
              class={styles.dropdownItem}
              onClick={() => handleAction(props.onCut!)}
              title="Cut this message to move it elsewhere (Ctrl/Cmd+Click to cut multiple)"
            >
              <BsScissors />
              <span>Cut Message</span>
            </button>
          </Show>

          <Show when={props.onUncut && props.isCut}>
            <button
              class={styles.dropdownItem}
              onClick={() => handleAction(props.onUncut!)}
              title="Uncut this message"
            >
              <BsScissors />
              <span>Uncut Message</span>
            </button>
          </Show>

          <button
            class={styles.dropdownItem}
            onClick={() => handleAction(props.onToggleDebug)}
            title="Show/hide debug information"
          >
            <BsInfoCircle />
            <span>{props.showDebug ? 'Hide' : 'Show'} Debug</span>
          </button>
        </div>
      </Show>
    </div>
  )
}