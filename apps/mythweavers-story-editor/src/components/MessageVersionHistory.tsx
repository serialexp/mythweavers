import { Badge, Button, Modal, Spinner } from '@mythweavers/ui'
import { BsArrowRepeat, BsClockHistory, BsPencil } from 'solid-icons/bs'
import { Component, For, Show, createSignal, onMount } from 'solid-js'
import { getMyMessagesByMessageIdRevisions } from '../client/config'

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
        <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
          <BsClockHistory />
          <span>Version History</span>
        </div>
      }
      size="xl"
    >
      <Show when={loading()}>
        <div style={{ padding: '2rem', 'text-align': 'center', color: 'var(--text-secondary)' }}>
          <Spinner size="md" />
          <div style={{ 'margin-top': '0.5rem' }}>Loading version history...</div>
        </div>
      </Show>

      <Show when={!loading() && versionData()}>
        <div
          style={{
            display: 'flex',
            height: '60vh',
            overflow: 'hidden',
          }}
        >
          {/* Version List Sidebar */}
          <div
            style={{
              width: '300px',
              'border-right': '1px solid var(--border-color)',
              'overflow-y': 'auto',
              background: 'var(--bg-secondary)',
            }}
          >
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
                padding: '1rem',
                'border-bottom': '1px solid var(--border-color)',
                position: 'sticky',
                top: '0',
                background: 'var(--bg-secondary)',
              }}
            >
              <h4 style={{ margin: '0', 'font-size': '1rem' }}>Revisions</h4>
              <span style={{ 'font-size': '0.875rem', color: 'var(--text-secondary)' }}>
                {versionData()!.revisions.length} revision{versionData()!.revisions.length !== 1 ? 's' : ''}
              </span>
            </div>

            <Show when={versionData()!.revisions.length === 0}>
              <div
                style={{
                  padding: '1rem',
                  'text-align': 'center',
                  color: 'var(--text-secondary)',
                  'font-size': '0.9rem',
                }}
              >
                No revisions available. Revisions are created when you regenerate or edit messages.
              </div>
            </Show>

            <For each={versionData()!.revisions}>
              {(version) => (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    'border-bottom': '1px solid var(--border-color)',
                    cursor: 'pointer',
                    background: selectedVersion()?.id === version.id ? 'var(--accent-bg)' : 'transparent',
                    'border-left':
                      selectedVersion()?.id === version.id ? '3px solid var(--primary-color)' : '3px solid transparent',
                  }}
                  onClick={() => setSelectedVersion(version)}
                >
                  <div
                    style={{
                      display: 'flex',
                      'align-items': 'center',
                      gap: '0.5rem',
                      'margin-bottom': '0.25rem',
                    }}
                  >
                    <span style={{ display: 'flex', 'align-items': 'center', color: 'var(--text-secondary)' }}>
                      {getVersionIcon(version.versionType || 'edit')}
                    </span>
                    <span style={{ 'font-weight': '600', color: 'var(--text-primary)' }}>v{version.version}</span>
                    <Badge size="sm">{getVersionTypeLabel(version.versionType || 'edit')}</Badge>
                  </div>
                  <div style={{ 'font-size': '0.85rem', color: 'var(--text-secondary)' }}>
                    {formatDate(version.createdAt)}
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Content Area */}
          <div
            style={{
              flex: '1',
              display: 'flex',
              'flex-direction': 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
                padding: '1rem',
                'border-bottom': '1px solid var(--border-color)',
              }}
            >
              <h4 style={{ margin: '0', 'font-size': '1rem' }}>
                {selectedVersion() ? `Version ${selectedVersion()!.version}` : 'Current Version'}
              </h4>
              <Show when={versionData()!.revisions.length > 0}>
                <Button variant="secondary" size="sm" onClick={() => setShowDiff(!showDiff())}>
                  {showDiff() ? 'Show Full Content' : 'Show Differences'}
                </Button>
              </Show>
            </div>

            <div
              style={{
                flex: '1',
                'overflow-y': 'auto',
                padding: '1rem',
              }}
            >
              <Show when={selectedVersion()}>
                <Show when={selectedVersion()!.instruction}>
                  <div
                    style={{
                      padding: '0.75rem',
                      background: 'var(--bg-secondary)',
                      'border-radius': '4px',
                      'margin-bottom': '1rem',
                      'font-size': '0.9rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong style={{ color: 'var(--text-primary)' }}>Instruction:</strong>{' '}
                    {selectedVersion()!.instruction}
                  </div>
                </Show>
                <div
                  style={{
                    'white-space': 'pre-wrap',
                    'word-wrap': 'break-word',
                    'line-height': '1.6',
                    color: 'var(--text-primary)',
                  }}
                >
                  {selectedVersion()!.content}
                </div>
              </Show>

              <Show when={!selectedVersion() && versionData()?.current}>
                <div
                  style={{
                    padding: '1rem',
                    background: 'var(--accent-bg)',
                    'border-radius': '4px',
                    color: 'var(--text-primary)',
                    'margin-bottom': '1rem',
                  }}
                >
                  This is the current version of the message. Select a version from the list to view it.
                </div>
                <Show when={versionData()?.current?.instruction}>
                  <div
                    style={{
                      padding: '0.75rem',
                      background: 'var(--bg-secondary)',
                      'border-radius': '4px',
                      'margin-bottom': '1rem',
                      'font-size': '0.9rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong style={{ color: 'var(--text-primary)' }}>Instruction:</strong>{' '}
                    {versionData()?.current?.instruction}
                  </div>
                </Show>
                <div
                  style={{
                    'white-space': 'pre-wrap',
                    'word-wrap': 'break-word',
                    'line-height': '1.6',
                    color: 'var(--text-primary)',
                  }}
                >
                  {versionData()?.current?.content}
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </Modal>
  )
}
