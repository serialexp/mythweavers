import { Button, IconButton, Input, Stack, Textarea } from '@mythweavers/ui'
import { BsArrowRight, BsCheckCircle, BsCircle, BsPencil, BsPlus, BsTrash } from 'solid-icons/bs'
import { ImTarget } from 'solid-icons/im'
import { Component, For, Show, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { uiStore } from '../stores/uiStore'
import { BranchOption, Message } from '../types/core'
import { generateMessageId } from '../utils/id'
import * as styles from './BranchMessage.css'

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
      targetNodeId: '', // Will be set when user targets
      targetMessageId: '', // Will be set when user targets
      description: undefined,
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
      options: (props.message.options || []).filter((opt) => opt.id !== optionId),
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

    const updatedOptions = (props.message.options || []).map((opt) =>
      opt.id === optionId ? { ...opt, label, description: description || undefined } : opt,
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
    <div>
      <div class={styles.branchTitle}>
        <span class={styles.branchTitleIcon}>🔀</span>
        {props.message.content}
      </div>

      <Stack gap="sm" class={styles.optionsContainer}>
        <For each={props.message.options || []}>
          {(option) => {
            const isSelected = () => selectedOptionId() === option.id
            const hasTarget = option.targetMessageId && option.targetNodeId
            const isEditing = () => editingOptionId() === option.id

            const getTargetInfo = () => {
              if (!hasTarget) return null

              const targetNode = nodeStore.nodesArray.find((n) => n.id === option.targetNodeId)
              const targetMessage = messagesStore.messages.find((m) => m.id === option.targetMessageId)

              return {
                nodeName: targetNode?.title || 'Unknown',
                messageOrder: targetMessage?.order ?? '?',
              }
            }

            return (
              <div
                class={`${styles.optionRow} ${isSelected() ? styles.optionRowSelected : ''}`}
              >
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectOption(option.id)}
                  aria-label={isSelected() ? 'Selected' : 'Click to select this option'}
                  class={isSelected() ? styles.selectButtonSelected : styles.selectButtonDefault}
                >
                  {isSelected() ? <BsCheckCircle size={20} /> : <BsCircle size={20} />}
                </IconButton>

                <div class={styles.optionContent}>
                  <Show
                    when={isEditing()}
                    fallback={
                      <div class={styles.optionDisplayContent}>
                        <div class={styles.optionLabel}>
                          {option.label}
                        </div>
                        <Show when={option.description}>
                          <div class={styles.optionDescription}>
                            {option.description}
                          </div>
                        </Show>
                        <Show
                          when={hasTarget}
                          fallback={
                            <span class={styles.noTargetText}>
                              No target set
                            </span>
                          }
                        >
                          <span class={styles.targetText}>
                            Target: {getTargetInfo()?.nodeName} (msg #{getTargetInfo()?.messageOrder})
                          </span>
                        </Show>
                      </div>
                    }
                  >
                    <Stack gap="xs" style={{ width: '100%' }}>
                      <Input
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
                      <Textarea
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
                    </Stack>
                  </Show>
                </div>

                <Show when={!isEditing()}>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartEditLabel(option)}
                    aria-label="Edit option text"
                  >
                    <BsPencil size={16} />
                  </IconButton>
                </Show>

                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStartTargeting(option.id)}
                  aria-label="Set target message"
                >
                  <ImTarget size={16} />
                </IconButton>

                <Show when={hasTarget}>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handleGoToTarget(option)}
                    aria-label="Go to target message"
                    class={styles.goToTargetButton}
                  >
                    <BsArrowRight size={18} />
                  </IconButton>
                </Show>

                <IconButton
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteOption(option.id)}
                  aria-label="Delete option"
                >
                  <BsTrash size={18} />
                </IconButton>
              </div>
            )
          }}
        </For>
      </Stack>

      <Button
        variant="secondary"
        onClick={handleAddOption}
        class={styles.addOptionButton}
      >
        <BsPlus size={20} /> Add Option
      </Button>
    </div>
  )
}
