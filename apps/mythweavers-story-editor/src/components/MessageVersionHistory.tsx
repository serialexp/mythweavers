import { Badge, Button, Modal, Spinner } from '@mythweavers/ui'
import { BsArrowRepeat, BsClockHistory, BsPencil } from 'solid-icons/bs'
import { Component, For, Show, createSignal, onMount } from 'solid-js'
import { getMyMessagesByMessageIdRevisions } from '../client/config'
import * as styles from './MessageVersionHistory.css'

interface MessageVersionHistoryProps {
  messageId: string
  onClose: () => void
}

interface MessageVersion {
  id: string
  versionType?: 'initial' | 'regeneration' | 'edit' | 'rewrite' | 'cli_edit'
  content?: string
  instruction?: string | null
  model: string | null
  version: number
  createdAt: string
  // AI metadata fields
  think?: string | null
  totalTokens?: number | null
  showThink?: boolean
  messageId?: string
  tokensPerSecond?: number | null
  promptTokens?: number | null
  cacheCreationTokens?: number | null
  cacheReadTokens?: number | null
}

interface VersionData {
  revisions: MessageVersion[]
  current?: {
    content?: string
    instruction?: string | null
  }
}

export const MessageVersionHistory: Component<MessageVersionHistoryProps> = (props) => {
  const [loading, setLoading] = createSignal(true)
  const [versionData, setVersionData] = createSignal<VersionData | null>(null)
  const [selectedVersion, setSelectedVersion] = createSignal<MessageVersion | null>(null)
  const [showDiff, setShowDiff] = createSignal(false)

  onMount(async () => {
    await loadVersions()
  })

  const loadVersions = async () => {
    try {
      setLoading(true)

      console.log('[MessageVersionHistory] Loading revisions for message:', props.messageId)
      const response = await getMyMessagesByMessageIdRevisions({
        path: { messageId: props.messageId },
      })

      console.log('[MessageVersionHistory] Response:', response)

      if (!response.data) {
        throw new Error('No data returned from API')
      }

      console.log('[MessageVersionHistory] Response data:', response.data)

      setVersionData(response.data)

      // Select the most recent version by default if any exist
      if (response.data.revisions && response.data.revisions.length > 0) {
        setSelectedVersion(response.data.revisions[0])
      }
    } catch (error) {
      console.error('Failed to load message versions:', error)
    } finally {
      setLoading(false)
    }
  }

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
                {selectedVersion() ? `Version ${selectedVersion()!.version}` : 'Current Version'}
              </h4>
              <Show when={versionData()!.revisions.length > 0}>
                <Button variant="secondary" size="sm" onClick={() => setShowDiff(!showDiff())}>
                  {showDiff() ? 'Show Full Content' : 'Show Differences'}
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
                <div class={styles.contentText}>{selectedVersion()!.content}</div>
              </Show>

              <Show when={!selectedVersion() && versionData()?.current}>
                <div class={styles.currentVersionNotice}>
                  This is the current version of the message. Select a version from the list to view it.
                </div>
                <Show when={versionData()?.current?.instruction}>
                  <div class={styles.instructionBox}>
                    <strong class={styles.instructionLabel}>Instruction:</strong> {versionData()?.current?.instruction}
                  </div>
                </Show>
                <div class={styles.contentText}>{versionData()?.current?.content}</div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </Modal>
  )
}
