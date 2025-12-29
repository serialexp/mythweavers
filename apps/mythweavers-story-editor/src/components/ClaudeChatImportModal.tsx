import { Button, Modal, Spinner } from '@mythweavers/ui'
import { BsCloudFill, BsCloudUpload, BsFileEarmarkText, BsHddFill } from 'solid-icons/bs'
import { Component, For, Show, createSignal } from 'solid-js'
import { authStore } from '../stores/authStore'
import {
  type ClaudeChatExport,
  type ClaudeConversation,
  ORGANIZATIONS_API_URL,
  buildConversationApiUrl,
  convertToStoryMessages,
  getConversationSummary,
  parseClaudeChatExport,
} from '../utils/claudeChatImport'
import * as styles from './ClaudeChatImportModal.css'

interface ClaudeChatImportModalProps {
  show: boolean
  hasCurrentStory: boolean
  serverAvailable: boolean
  onClose: () => void
  onImport: (
    conversationName: string,
    messages: ReturnType<typeof convertToStoryMessages>,
    importTarget: 'new' | 'current',
    storageMode: 'local' | 'server',
  ) => Promise<void>
}

export const ClaudeChatImportModal: Component<ClaudeChatImportModalProps> = (props) => {
  const [conversations, setConversations] = createSignal<ClaudeChatExport | null>(null)
  const [selectedConversation, setSelectedConversation] = createSignal<ClaudeConversation | null>(null)
  const [importTarget, setImportTarget] = createSignal<'new' | 'current'>('new')
  const [storageMode, setStorageMode] = createSignal<'local' | 'server'>('local')
  const [error, setError] = createSignal<string | null>(null)
  const [isImporting, setIsImporting] = createSignal(false)
  const [isDragOver, setIsDragOver] = createSignal(false)
  const [importingMessageCount, setImportingMessageCount] = createSignal(0)
  const [orgId, setOrgId] = createSignal('')

  const isAuthenticated = () => authStore.isAuthenticated && !authStore.isOfflineMode

  const handleFileSelect = async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const parsed = parseClaudeChatExport(text)
      setConversations(parsed)
      // Auto-select first conversation if there's only one
      if (parsed.length === 1) {
        setSelectedConversation(parsed[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
      setConversations(null)
      setSelectedConversation(null)
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type === 'application/json') {
      handleFileSelect(file)
    } else {
      setError('Please drop a JSON file')
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const openFilePicker = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        await handleFileSelect(file)
      }
    }
    input.click()
  }

  const handleImport = async () => {
    const conversation = selectedConversation()
    if (!conversation) return

    setIsImporting(true)
    setError(null)

    try {
      const messages = convertToStoryMessages(conversation)
      setImportingMessageCount(messages.length)
      await props.onImport(conversation.name, messages, importTarget(), storageMode())
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import conversation')
    } finally {
      setIsImporting(false)
      setImportingMessageCount(0)
    }
  }

  const handleClose = () => {
    setConversations(null)
    setSelectedConversation(null)
    setError(null)
    setIsImporting(false)
    setOrgId('')
    props.onClose()
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return `${text.substring(0, maxLength)}...`
  }

  return (
    <Modal
      open={props.show}
      onClose={handleClose}
      title={
        <span style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
          <BsFileEarmarkText /> Import Claude Chat
        </span>
      }
      size="lg"
    >
      <div class={styles.container}>
        <Show
          when={conversations()}
          fallback={
            <div
              class={`${styles.dropZone} ${isDragOver() ? styles.dropZoneActive : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={openFilePicker}
            >
              <div class={styles.dropZoneIcon}>
                <BsCloudUpload />
              </div>
              <div class={styles.dropZoneText}>Drop your Claude chat export here</div>
              <div class={styles.dropZoneSubtext}>or click to select a JSON file</div>
            </div>
          }
        >
          <div class={styles.contentContainer}>
            {/* Conversation list */}
            <div class={styles.conversationList}>
              <For each={conversations()}>
                {(conversation) => {
                  const summary = getConversationSummary(conversation)
                  const isSelected = () => selectedConversation()?.uuid === conversation.uuid
                  return (
                    <div
                      class={`${styles.conversationItem} ${isSelected() ? styles.conversationItemSelected : ''}`}
                      onClick={() => setSelectedConversation(conversation)}
                    >
                      <span class={styles.conversationName}>{summary.name || 'Untitled conversation'}</span>
                      <span class={styles.conversationMeta}>
                        <span>{summary.messageCount} messages</span>
                        <span>{formatDate(summary.createdAt)}</span>
                      </span>
                    </div>
                  )
                }}
              </For>
            </div>

            {/* Preview section */}
            <div class={styles.previewSection}>
              <Show
                when={selectedConversation()}
                fallback={<div class={styles.previewEmpty}>Select a conversation to preview</div>}
              >
                {(conversation) => {
                  const summary = () => getConversationSummary(conversation())
                  const apiUrl = () =>
                    orgId().trim() ? buildConversationApiUrl(orgId().trim(), summary().id) : null
                  return (
                    <Show
                      when={!summary().needsApiFetch}
                      fallback={
                        <div class={styles.apiFetchRequired}>
                          <div class={styles.previewTitle}>Additional Step Required</div>
                          <p>
                            This export is missing branch information needed to correctly import conversations
                            with edits or restarts.
                          </p>

                          <div class={styles.stepSection}>
                            <div class={styles.stepLabel}>1. Verify this is the right conversation:</div>
                            <a
                              href={summary().chatUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              class={styles.apiLink}
                            >
                              {summary().chatUrl}
                            </a>
                          </div>

                          <div class={styles.stepSection}>
                            <div class={styles.stepLabel}>
                              2. Get your organization ID from{' '}
                              <a href={ORGANIZATIONS_API_URL} target="_blank" rel="noopener noreferrer">
                                this page
                              </a>{' '}
                              and paste it here:
                            </div>
                            <input
                              type="text"
                              class={styles.orgIdInput}
                              placeholder="e.g. 5d47103a-b9a4-414e-98f0-3cc503a252b8"
                              value={orgId()}
                              onInput={(e) => setOrgId(e.currentTarget.value)}
                            />
                          </div>

                          <Show when={apiUrl()}>
                            <div class={styles.stepSection}>
                              <div class={styles.stepLabel}>3. Visit this URL and save the response as JSON:</div>
                              <a
                                href={apiUrl()!}
                                target="_blank"
                                rel="noopener noreferrer"
                                class={styles.apiLink}
                              >
                                {apiUrl()}
                              </a>
                            </div>

                            <div class={styles.stepSection}>
                              <div class={styles.stepLabel}>4. Drop the saved JSON file:</div>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setConversations(null)
                                  setSelectedConversation(null)
                                  setOrgId('')
                                }}
                              >
                                Drop new file
                              </Button>
                            </div>
                          </Show>
                        </div>
                      }
                    >
                      <>
                        <div class={styles.previewTitle}>
                          Preview ({summary().activeMessageCount} of {summary().messageCount} messages
                          {summary().hasAbandonedBranches && ' - some branches excluded'})
                        </div>
                        <For each={conversation().chat_messages.slice(0, 5)}>
                          {(message) => {
                            const textContent =
                              message.content.find((c) => c.type === 'text')?.text || message.text
                            return (
                              <div
                                class={`${styles.previewMessage} ${
                                  message.sender === 'human'
                                    ? styles.previewMessageHuman
                                    : styles.previewMessageAssistant
                                }`}
                              >
                                <div class={styles.previewMessageRole}>{message.sender}</div>
                                <div class={styles.previewMessageContent}>{truncateText(textContent, 300)}</div>
                              </div>
                            )
                          }}
                        </For>
                      </>
                    </Show>
                  )
                }}
              </Show>
            </div>

            {/* Only show import options when conversation has branch info */}
            <Show when={selectedConversation() && !getConversationSummary(selectedConversation()!).needsApiFetch}>
              {/* Import target options */}
              <div class={styles.importOptions}>
                <div style={{ 'font-size': '0.875rem', 'font-weight': '500', 'margin-bottom': '0.5rem' }}>
                  Import Target
                </div>
                <label class={styles.importOption}>
                  <input
                    type="radio"
                    name="import-target"
                    checked={importTarget() === 'new'}
                    onChange={() => setImportTarget('new')}
                  />
                  <span>Import as new story</span>
                </label>
                <label
                  class={`${styles.importOption} ${!props.hasCurrentStory ? styles.importOptionDisabled : ''}`}
                >
                  <input
                    type="radio"
                    name="import-target"
                    checked={importTarget() === 'current'}
                    onChange={() => setImportTarget('current')}
                    disabled={!props.hasCurrentStory}
                  />
                  <span>Import into current story</span>
                </label>
              </div>

              {/* Storage mode options */}
              <Show when={importTarget() === 'new'}>
                <div class={styles.importOptions}>
                  <div style={{ 'font-size': '0.875rem', 'font-weight': '500', 'margin-bottom': '0.5rem' }}>
                    Storage Location
                  </div>
                  <label class={styles.importOption}>
                    <input
                      type="radio"
                      name="storage-mode"
                      checked={storageMode() === 'local'}
                      onChange={() => setStorageMode('local')}
                    />
                    <BsHddFill style={{ 'flex-shrink': '0' }} />
                    <span>Local Storage</span>
                  </label>
                  <Show
                    when={props.serverAvailable && isAuthenticated()}
                    fallback={
                      <label class={`${styles.importOption} ${styles.importOptionDisabled}`}>
                        <input type="radio" name="storage-mode" disabled />
                        <BsCloudFill style={{ 'flex-shrink': '0' }} />
                        <span>Server Storage (unavailable)</span>
                      </label>
                    }
                  >
                    <label class={styles.importOption}>
                      <input
                        type="radio"
                        name="storage-mode"
                        checked={storageMode() === 'server'}
                        onChange={() => setStorageMode('server')}
                      />
                      <BsCloudFill style={{ 'flex-shrink': '0' }} />
                      <span>Server Storage</span>
                    </label>
                  </Show>
                </div>
              </Show>
            </Show>
          </div>
        </Show>

        <Show when={error()}>
          <div class={styles.errorText}>{error()}</div>
        </Show>

        <div class={styles.footer}>
          <Show when={conversations()}>
            <Button variant="ghost" onClick={() => setConversations(null)}>
              Back
            </Button>
          </Show>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Show when={conversations()}>
            {(() => {
              const conv = selectedConversation()
              const summary = conv ? getConversationSummary(conv) : null
              const canImport = conv && !summary?.needsApiFetch
              return (
                <Button onClick={handleImport} disabled={!canImport || isImporting()}>
                  <Show when={isImporting()} fallback="Import">
                    <Spinner size="sm" /> Importing {importingMessageCount()} messages...
                  </Show>
                </Button>
              )
            })()}
          </Show>
        </div>
      </div>
    </Modal>
  )
}
