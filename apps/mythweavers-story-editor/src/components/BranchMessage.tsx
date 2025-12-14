import { Component, createSignal, For, Show } from 'solid-js'
import { BranchOption, Message } from '../types/core'
import { messagesStore } from '../stores/messagesStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { uiStore } from '../stores/uiStore'
import { nodeStore } from '../stores/nodeStore'
import { generateMessageId } from '../utils/id'
import { BsPlus, BsTrash, BsCheckCircle, BsCircle, BsArrowRight, BsPencil } from 'solid-icons/bs'
import { ImTarget } from 'solid-icons/im'
import styles from './BranchMessage.module.css'

interface BranchMessageProps {
  message: Message
}

export const BranchMessage: Component<BranchMessageProps> = (props) => {
  const [editingOptionId, setEditingOptionId] = createSignal<string | null>(null)
  const [editingLabel, setEditingLabel] = createSignal('')
  const [editingDescription, setEditingDescription] = createSignal('')

  const selectedOptionId = () => {
    return currentStoryStore.branchChoices[props.message.id] || null
  }

  const handleSelectOption = (optionId: string) => {
    currentStoryStore.setBranchChoice(props.message.id, optionId)
  }

  const handleAddOption = () => {
    const newOption: BranchOption = {
      id: generateMessageId(),
      label: 'New option',
      targetNodeId: '',  // Will be set when user targets
      targetMessageId: '', // Will be set when user targets
      description: undefined
    }

    const updatedMessage: Message = {
      ...props.message,
      options: [...(props.message.options || []), newOption],
    }

    messagesStore.updateMessage(props.message.id, updatedMessage)

    // Auto-enter edit mode for new option
    setEditingOptionId(newOption.id)
    setEditingLabel('New option')
    setEditingDescription('')
  }

  const handleDeleteOption = (optionId: string) => {
    const updatedMessage: Message = {
      ...props.message,
      options: (props.message.options || []).filter(opt => opt.id !== optionId),
    }

    messagesStore.updateMessage(props.message.id, updatedMessage)

    // If this was the selected option, clear the selection
    if (selectedOptionId() === optionId) {
      currentStoryStore.setBranchChoice(props.message.id, null)
    }
  }

  const handleStartEditLabel = (option: BranchOption) => {
    setEditingOptionId(option.id)
    setEditingLabel(option.label)
    setEditingDescription(option.description || '')
  }

  const handleSaveLabel = (optionId: string) => {
    const label = editingLabel().trim()
    if (!label) return

    const description = editingDescription().trim()

    const updatedOptions = (props.message.options || []).map(opt =>
      opt.id === optionId ? { ...opt, label, description: description || undefined } : opt
    )

    const updatedMessage: Message = {
      ...props.message,
      options: updatedOptions,
    }

    messagesStore.updateMessage(props.message.id, updatedMessage)
    setEditingOptionId(null)
  }

  const handleCancelEdit = () => {
    setEditingOptionId(null)
    setEditingLabel('')
    setEditingDescription('')
  }

  const handleStartTargeting = (optionId: string) => {
    uiStore.startTargeting(props.message.id, optionId)
  }

  const handleGoToTarget = (option: BranchOption) => {
    if (!option.targetNodeId || !option.targetMessageId) return

    // Select the target node
    nodeStore.selectNode(option.targetNodeId)

    // Scroll to the target message after a short delay to allow the view to update
    setTimeout(() => {
      const messageElement = document.querySelector(`[data-message-id="${option.targetMessageId}"]`)
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  return (
    <div class={styles.branchContainer}>
      <div class={styles.branchQuestion}>
        {props.message.content}
      </div>

      <div class={styles.optionsList}>
        <For each={props.message.options || []}>
          {(option) => {
            const isSelected = () => selectedOptionId() === option.id
            const hasTarget = option.targetMessageId && option.targetNodeId
            const isEditing = () => editingOptionId() === option.id

            const getTargetInfo = () => {
              if (!hasTarget) return null

              const targetNode = nodeStore.nodesArray.find(n => n.id === option.targetNodeId)
              const targetMessage = messagesStore.messages.find(m => m.id === option.targetMessageId)

              return {
                nodeName: targetNode?.title || 'Unknown',
                messageOrder: targetMessage?.order ?? '?'
              }
            }

            return (
              <div class={`${styles.optionItem} ${isSelected() ? styles.optionSelected : ''}`}>
                <button
                  class={styles.selectButton}
                  onClick={() => handleSelectOption(option.id)}
                  title={isSelected() ? 'Selected' : 'Click to select this option'}
                >
                  {isSelected() ? <BsCheckCircle size={20} /> : <BsCircle size={20} />}
                </button>

                <div class={styles.optionContent}>
                  <Show when={isEditing()} fallback={
                    <div class={styles.optionLabelContainer}>
                      <div class={styles.optionLabel}>
                        {option.label}
                      </div>
                      <Show when={option.description}>
                        <div class={styles.optionDescription}>
                          {option.description}
                        </div>
                      </Show>
                      <Show when={hasTarget} fallback={
                        <span class={styles.noTarget}>No target set</span>
                      }>
                        <span class={styles.hasTarget}>
                          Target: {getTargetInfo()?.nodeName} (msg #{getTargetInfo()?.messageOrder})
                        </span>
                      </Show>
                    </div>
                  }>
                    <div class={styles.editFields}>
                      <input
                        type="text"
                        class={styles.optionInput}
                        value={editingLabel()}
                        onInput={(e) => setEditingLabel(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleSaveLabel(option.id)
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                        placeholder="Option label"
                        ref={(el) => el && setTimeout(() => el.focus(), 0)}
                      />
                      <textarea
                        class={styles.optionTextarea}
                        value={editingDescription()}
                        onInput={(e) => setEditingDescription(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault()
                            handleSaveLabel(option.id)
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                        placeholder="Optional description"
                        rows={2}
                      />
                    </div>
                  </Show>
                </div>

                <Show when={!isEditing()}>
                  <button
                    class={styles.optionButton}
                    onClick={() => handleStartEditLabel(option)}
                    title="Edit option text"
                  >
                    <BsPencil size={16} />
                  </button>
                </Show>

                <button
                  class={styles.optionButton}
                  onClick={() => handleStartTargeting(option.id)}
                  title="Set target message"
                >
                  <ImTarget size={16} />
                </button>

                <Show when={hasTarget}>
                  <button
                    class={`${styles.optionButton} ${styles.success}`}
                    onClick={() => handleGoToTarget(option)}
                    title="Go to target message"
                  >
                    <BsArrowRight size={18} />
                  </button>
                </Show>

                <button
                  class={`${styles.optionButton} ${styles.danger}`}
                  onClick={() => handleDeleteOption(option.id)}
                  title="Delete option"
                >
                  <BsTrash size={18} />
                </button>
              </div>
            )
          }}
        </For>
      </div>

      <button class={styles.addOptionButton} onClick={handleAddOption}>
        <BsPlus size={20} /> Add Option
      </button>
    </div>
  )
}
