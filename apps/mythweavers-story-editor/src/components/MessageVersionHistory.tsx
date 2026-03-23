import { Badge, Button, Modal, Spinner } from '@mythweavers/ui'
import { BsArrowCounterclockwise, BsArrowRepeat, BsClockHistory, BsPencil } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createSignal, on } from 'solid-js'
import { getMyMessagesByMessageIdRevisions, patchMyParagraphsById } from '../client/config'
import { messagesStore } from '../stores/messagesStore'
import * as styles from './MessageVersionHistory.css'

interface MessageVersionHistoryProps {
  messageId: string
  currentMessageRevisionId?: string | null
  onClose: () => void
}

interface ParagraphRevisionSummary {
  id: string
  paragraphId: string
  body: string
  version: number
  state: 'AI' | 'DRAFT' | 'REVISE' | 'FINAL' | 'SDT' | null
  createdAt: string
}

interface ParagraphWithRevisions {
  id: string
  sortOrder: number
  currentParagraphRevisionId: string | null
  revisions: ParagraphRevisionSummary[]
}

interface MessageVersion {
  id: string
  versionType?: 'initial' | 'regeneration' | 'edit' | 'rewrite' | 'cli_edit' | 'auto'
  content?: string
  instruction?: string | null
  model: string | null
  version: number
  createdAt: string
  think?: string | null
  totalTokens?: number | null
  showThink?: boolean
  messageId?: string
  tokensPerSecond?: number | null
  promptTokens?: number | null
  cacheCreationTokens?: number | null
  cacheReadTokens?: number | null
  paragraphs?: ParagraphWithRevisions[]
}

interface VersionData {
  revisions: MessageVersion[]
}

export const MessageVersionHistory: Component<MessageVersionHistoryProps> = (props) => {
  const [loading, setLoading] = createSignal(true)
  const [versionData, setVersionData] = createSignal<VersionData | null>(null)
  const [selectedVersion, setSelectedVersion] = createSignal<MessageVersion | null>(null)
  const [restoring, setRestoring] = createSignal(false)
  // Track which paragraph revision is being viewed per paragraph: paragraphId -> revisionId
  const [paragraphRevisionMap, setParagraphRevisionMap] = createSignal<Record<string, string>>({})
  // Track which paragraph has its version selector expanded
  const [expandedParagraph, setExpandedParagraph] = createSignal<string | null>(null)

  // When selectedVersion changes, reset paragraph revision map to current revisions
  createEffect(
    on(selectedVersion, (version) => {
      if (!version?.paragraphs) {
        setParagraphRevisionMap({})
        setExpandedParagraph(null)
        return
      }
      const initMap: Record<string, string> = {}
      for (const p of version.paragraphs) {
        if (p.currentParagraphRevisionId) {
          initMap[p.id] = p.currentParagraphRevisionId
        } else if (p.revisions.length > 0) {
          // Fallback to latest revision if currentParagraphRevisionId is null
          initMap[p.id] = p.revisions[0].id
        }
      }
      setParagraphRevisionMap(initMap)
      setExpandedParagraph(null)
    }),
  )

  const loadVersions = async () => {
    try {
      setLoading(true)
      const response = await getMyMessagesByMessageIdRevisions({
        path: { messageId: props.messageId },
      })

      if (!response.data) {
        throw new Error('No data returned from API')
      }

      setVersionData(response.data as VersionData)

      // Select the current revision by default, fall back to most recent
      if (response.data.revisions && response.data.revisions.length > 0) {
        const revisions = response.data.revisions as MessageVersion[]
        const current = props.currentMessageRevisionId
          ? revisions.find((r) => r.id === props.currentMessageRevisionId)
          : undefined
        setSelectedVersion(current ?? revisions[0])
      }
    } catch (error) {
      console.error('Failed to load message versions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load on mount
  loadVersions()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getVersionIcon = (type: string) => {
    switch (type) {
      case 'initial':
        return <BsClockHistory />
      case 'edit':
      case 'cli_edit':
      case 'rewrite':
        return <BsPencil />
      default:
        return <BsArrowRepeat />
    }
  }

  const getVersionTypeLabel = (type: string) => {
    switch (type) {
      case 'initial':
        return 'Initial'
      case 'edit':
        return 'Manual Edit'
      case 'cli_edit':
        return 'CLI Edit'
      case 'rewrite':
        return 'Bulk Rewrite'
      case 'regeneration':
        return 'Regeneration'
      default:
        return type
    }
  }

  const getDisplayedRevision = (paragraph: ParagraphWithRevisions): ParagraphRevisionSummary | undefined => {
    const selectedId = paragraphRevisionMap()[paragraph.id]
    if (selectedId) {
      return paragraph.revisions.find((r) => r.id === selectedId)
    }
    return paragraph.revisions.find((r) => r.id === paragraph.currentParagraphRevisionId) ?? paragraph.revisions[0]
  }

  const selectParagraphRevision = (paragraphId: string, revisionId: string) => {
    setParagraphRevisionMap((prev) => ({ ...prev, [paragraphId]: revisionId }))
  }

  // Restore entire MessageRevision — creates a new revision with the displayed paragraph content
  const restoreMessageRevision = async () => {
    const version = selectedVersion()
    if (!version?.paragraphs) return

    setRestoring(true)
    try {
      // Build content from the currently displayed paragraph revisions
      const content = version.paragraphs
        .map((p) => getDisplayedRevision(p)?.body ?? '')
        .filter((body) => body.length > 0)
        .join('\n\n')

      const { saveService } = await import('../services/saveService')
      const { revisionId, paragraphs } = await saveService.createMessageRevision(props.messageId, content)

      messagesStore.updateMessageNoSave(props.messageId, {
        content,
        currentMessageRevisionId: revisionId,
        paragraphs,
      })
      messagesStore.bumpContentVersion(props.messageId)
      props.onClose()
    } catch (error) {
      console.error('Failed to restore message revision:', error)
    } finally {
      setRestoring(false)
    }
  }

  // Restore a single paragraph to an older revision — patches the paragraph which creates a new ParagraphRevision
  const restoreParagraphRevision = async (paragraphId: string, body: string) => {
    setRestoring(true)
    try {
      await patchMyParagraphsById({
        path: { id: paragraphId },
        body: { body },
      })

      // Update the local paragraph in the store
      const msg = messagesStore.messages.find((m) => m.id === props.messageId)
      if (msg?.paragraphs) {
        const updatedParagraphs = msg.paragraphs.map((p) => (p.id === paragraphId ? { ...p, body } : p))
        const content = updatedParagraphs.map((p) => p.body).join('\n\n')
        messagesStore.updateMessageNoSave(props.messageId, {
          content,
          paragraphs: updatedParagraphs,
        })
        messagesStore.bumpContentVersion(props.messageId)
      }

      props.onClose()
    } catch (error) {
      console.error('Failed to restore paragraph revision:', error)
    } finally {
      setRestoring(false)
    }
  }

  // Whether the selected version is the current one
  const isCurrentVersion = () => selectedVersion()?.id === props.currentMessageRevisionId

  return (
    <Modal
      open={true}
      onClose={props.onClose}
      title={
        <div class={styles.titleRow}>
          <BsClockHistory />
          <span>Version History</span>
        </div>
      }
      size="xl"
    >
      <Show when={loading()}>
        <div class={styles.loadingContainer}>
          <Spinner size="md" />
          <div class={styles.loadingText}>Loading version history...</div>
        </div>
      </Show>

      <Show when={!loading() && versionData()}>
        <div class={styles.container}>
          {/* Version List Sidebar */}
          <div class={styles.sidebar}>
            <div class={styles.sidebarHeader}>
              <h4 class={styles.sidebarTitle}>Revisions</h4>
              <span class={styles.revisionCount}>
                {versionData()!.revisions.length} revision{versionData()!.revisions.length !== 1 ? 's' : ''}
              </span>
            </div>

            <Show when={versionData()!.revisions.length === 0}>
              <div class={styles.emptyMessage}>
                No revisions available. Revisions are created when you regenerate or edit messages.
              </div>
            </Show>

            <For each={versionData()!.revisions}>
              {(version) => (
                <div
                  class={`${styles.versionItem} ${selectedVersion()?.id === version.id ? styles.versionItemSelected : ''}`}
                  onClick={() => setSelectedVersion(version)}
                >
                  <div class={styles.versionItemHeader}>
                    <span class={styles.versionIcon}>{getVersionIcon(version.versionType || 'edit')}</span>
                    <span class={styles.versionNumber}>v{version.version}</span>
                    <Badge size="sm">{getVersionTypeLabel(version.versionType || 'edit')}</Badge>
                    <Show when={version.id === props.currentMessageRevisionId}>
                      <Badge size="sm" variant="primary">Current</Badge>
                    </Show>
                  </div>
                  <div class={styles.versionDate}>{formatDate(version.createdAt)}</div>
                </div>
              )}
            </For>
          </div>

          {/* Content Area */}
          <div class={styles.contentArea}>
            <div class={styles.contentHeader}>
              <h4 class={styles.contentTitle}>
                {selectedVersion() ? `Version ${selectedVersion()!.version}` : 'Select a version'}
              </h4>
              <Show when={selectedVersion() && !isCurrentVersion()}>
                <Button
                  size="sm"
                  onClick={restoreMessageRevision}
                  disabled={restoring()}
                >
                  <BsArrowCounterclockwise /> Restore This Version
                </Button>
              </Show>
            </div>

            <div class={styles.contentBody}>
              <Show when={selectedVersion()}>
                <Show when={selectedVersion()!.instruction}>
                  <div class={styles.instructionBox}>
                    <strong class={styles.instructionLabel}>Instruction:</strong> {selectedVersion()!.instruction}
                  </div>
                </Show>

                {/* Show AI thinking if available */}
                <Show when={selectedVersion()!.showThink && selectedVersion()!.think}>
                  <div class={styles.instructionBox}>
                    <strong class={styles.instructionLabel}>Thinking:</strong> {selectedVersion()!.think}
                  </div>
                </Show>

                {/* Paragraph-level view */}
                <Show
                  when={selectedVersion()!.paragraphs && selectedVersion()!.paragraphs!.length > 0}
                  fallback={<div class={styles.contentText}>{selectedVersion()!.content}</div>}
                >
                  <For each={selectedVersion()!.paragraphs}>
                    {(paragraph, index) => {
                      const displayed = () => getDisplayedRevision(paragraph)
                      const hasMultipleRevisions = () => paragraph.revisions.length > 1
                      const isExpanded = () => expandedParagraph() === paragraph.id
                      const isViewingOlder = () => {
                        const rev = displayed()
                        return rev ? rev.id !== paragraph.currentParagraphRevisionId : false
                      }

                      return (
                        <div class={styles.paragraphBlock}>
                          <div class={styles.paragraphHeader}>
                            <span class={styles.paragraphNumber}>{index() + 1}</span>
                            <Show when={hasMultipleRevisions()}>
                              <span
                                class={styles.paragraphVersionIndicator}
                                onClick={() => setExpandedParagraph(isExpanded() ? null : paragraph.id)}
                              >
                                <Badge size="sm" variant={isViewingOlder() ? 'warning' : 'default'}>
                                  v{displayed()?.version ?? '?'} of {paragraph.revisions.length}
                                </Badge>
                              </span>
                            </Show>
                            <Show when={displayed()?.state}>
                              <Badge size="sm">{displayed()!.state}</Badge>
                            </Show>
                          </div>

                          <Show when={isExpanded()}>
                            <div class={styles.paragraphVersionSelector}>
                              <For each={paragraph.revisions}>
                                {(rev) => {
                                  const isActive = () => paragraphRevisionMap()[paragraph.id] === rev.id

                                  return (
                                    <button
                                      class={`${styles.paragraphVersionButton} ${isActive() ? styles.paragraphVersionButtonActive : ''}`}
                                      onClick={() => selectParagraphRevision(paragraph.id, rev.id)}
                                      title={formatDate(rev.createdAt)}
                                    >
                                      v{rev.version}
                                    </button>
                                  )
                                }}
                              </For>
                            </div>
                          </Show>

                          <div class={styles.paragraphBody}>{displayed()?.body ?? ''}</div>
                          <Show when={isViewingOlder()}>
                            <div style={{ "margin-top": "0.5rem" }}>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => restoreParagraphRevision(paragraph.id, displayed()!.body)}
                                disabled={restoring()}
                              >
                                <BsArrowCounterclockwise /> Restore this paragraph
                              </Button>
                            </div>
                          </Show>
                        </div>
                      )
                    }}
                  </For>
                </Show>
              </Show>

              <Show when={!selectedVersion()}>
                <div class={styles.emptyMessage}>Select a version from the sidebar to view its content.</div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </Modal>
  )
}
