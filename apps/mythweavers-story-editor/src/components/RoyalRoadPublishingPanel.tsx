import { Alert, Button, FormField, Input, Modal, Spinner, Stack } from '@mythweavers/ui'
import { Component, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { currentStoryStore } from '../stores/currentStoryStore'
import { royalRoadStore, type RoyalRoadStatus } from '../stores/royalRoadStore'
import * as styles from './RoyalRoadPublishingPanel.css'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Royal Road publishing panel — MVP.
 *
 * Three sections in a single modal:
 *
 *   1. Account — connect / rotate / disconnect the user-wide Royal Road
 *      credentials. Password is sent once; the backend encrypts at rest with
 *      AES-GCM and the browser never stores it.
 *   2. Story settings — numeric Royal Road story id (optional; worker will
 *      auto-create on first publish if blank) and an "Also publish to
 *      Royal Road" toggle (gated on a connected account).
 *   3. Status — read-only table of ChapterPublishing rows. FAILED rows get
 *      a Retry button that flips them to DRAFT for the worker to pick up.
 *
 * Publishing schedule is intentionally shared with the native reader — the
 * worker reads `Chapter.publishedAt`, there is no separate "RR publish at"
 * field. Enable the toggle and anything you schedule on the reader gets
 * pushed to RR as well.
 */
export const RoyalRoadPublishingPanel: Component<Props> = (props) => {
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)
  const [localError, setLocalError] = createSignal<string | null>(null)

  const [rrIdInput, setRrIdInput] = createSignal('')

  // Re-fetch everything each time the modal transitions to open.
  let wasOpen = false
  createEffect(() => {
    const isOpen = props.open
    if (isOpen && !wasOpen) {
      void royalRoadStore.loadAccount()
      const storyId = currentStoryStore.id
      if (storyId) {
        void royalRoadStore.loadStorySettings(storyId)
        void royalRoadStore.loadPublishingStatus(storyId)
      }
      setLocalError(null)
      setEmail('')
      setPassword('')
    }
    wasOpen = isOpen
  })

  const storyId = createMemo(() => currentStoryStore.id)
  const account = createMemo(() => royalRoadStore.account)
  const settings = createMemo(() => {
    const id = storyId()
    return id ? royalRoadStore.storySettings(id) : null
  })
  const statusRows = createMemo(() => {
    const id = storyId()
    return id ? royalRoadStore.statusRows(id) : []
  })

  // Keep the RR id input in sync with the server value whenever settings load.
  createEffect(() => {
    const s = settings()
    setRrIdInput(s?.royalRoadId != null ? String(s.royalRoadId) : '')
  })

  // ---- Account actions -----------------------------------------------------

  const handleConnect = async () => {
    setLocalError(null)
    const e = email().trim()
    const pw = password()
    if (!e || !pw) {
      setLocalError('Enter both email and password.')
      return
    }
    try {
      setSubmitting(true)
      await royalRoadStore.connectAccount(e, pw)
      setPassword('')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to connect.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisconnect = async () => {
    setLocalError(null)
    if (!confirm('Disconnect the Royal Road account? Scheduled chapters will stop publishing.'))
      return
    try {
      setSubmitting(true)
      await royalRoadStore.disconnectAccount()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to disconnect.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Story settings actions ----------------------------------------------

  const handleSaveRrId = async () => {
    const id = storyId()
    if (!id) return
    setLocalError(null)
    const raw = rrIdInput().trim()
    const value = raw === '' ? null : Number.parseInt(raw, 10)
    if (value !== null && (Number.isNaN(value) || value <= 0)) {
      setLocalError('Royal Road story id must be a positive integer (or blank).')
      return
    }
    try {
      setSubmitting(true)
      await royalRoadStore.updateStorySettings(id, { royalRoadId: value })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to save story id.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    const id = storyId()
    if (!id) return
    setLocalError(null)
    try {
      setSubmitting(true)
      await royalRoadStore.updateStorySettings(id, { publishingEnabled: enabled })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to toggle publishing.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Status actions ------------------------------------------------------

  const handleRetry = async (chapterId: string) => {
    const id = storyId()
    if (!id) return
    setLocalError(null)
    try {
      await royalRoadStore.retryChapter(id, chapterId)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Retry failed.')
    }
  }

  const handleRefreshStatus = async () => {
    const id = storyId()
    if (!id) return
    await royalRoadStore.loadPublishingStatus(id)
  }

  return (
    <Modal
      open={props.open}
      onClose={() => {
        if (!submitting()) props.onClose()
      }}
      title="Royal Road publishing"
      size="lg"
      footer={
        <Stack direction="horizontal" gap="sm" justify="end">
          <Button variant="ghost" onClick={props.onClose} disabled={submitting()}>
            Close
          </Button>
        </Stack>
      }
    >
      <Stack direction="vertical" gap="md">
        <Show when={localError()}>
          <Alert variant="error">{localError()}</Alert>
        </Show>
        <Show when={royalRoadStore.accountError}>
          <Alert variant="error">{royalRoadStore.accountError}</Alert>
        </Show>

        {/* Section 1: Account */}
        <div class={styles.section}>
          <h3 class={styles.sectionTitle}>Royal Road account</h3>
          <Show
            when={account()?.connected}
            fallback={
              <>
                <p class={styles.sectionSubtitle}>
                  Connect your Royal Road account so the worker can publish on your behalf.
                  Your password is stored encrypted at rest and is never returned by any
                  endpoint.
                </p>
                <FormField label="Email">
                  <Input
                    type="email"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    disabled={submitting()}
                    placeholder="you@example.com"
                  />
                </FormField>
                <FormField label="Password">
                  <Input
                    type="password"
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    disabled={submitting()}
                  />
                </FormField>
                <div class={styles.inlineRow}>
                  <Button onClick={handleConnect} disabled={submitting()}>
                    <Show when={submitting()}>
                      <Spinner size="sm" />
                    </Show>
                    Connect
                  </Button>
                </div>
              </>
            }
          >
            <div class={styles.statusLine}>
              <span class={styles.statusKey}>Connected as:</span>
              <span>{account()?.email}</span>
            </div>
            <Show when={account()?.lastLoginAt}>
              <div class={styles.statusLine}>
                <span class={styles.statusKey}>Last login:</span>
                <span>{new Date(account()!.lastLoginAt!).toLocaleString()}</span>
              </div>
            </Show>
            <Show when={account()?.lastError}>
              <Alert variant="warning">Last error: {account()!.lastError}</Alert>
            </Show>
            <p class={styles.sectionSubtitle}>
              Rotate your password by re-entering it below, or disconnect to stop all
              Royal Road publishing across your stories.
            </p>
            <FormField label="New password (optional — to rotate)">
              <Input
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                disabled={submitting()}
              />
            </FormField>
            <div class={styles.inlineRow}>
              <Button
                onClick={async () => {
                  const pw = password()
                  if (!pw) {
                    setLocalError('Enter a new password to rotate.')
                    return
                  }
                  const current = account()?.email
                  if (!current) return
                  try {
                    setSubmitting(true)
                    await royalRoadStore.connectAccount(current, pw)
                    setPassword('')
                  } catch (err) {
                    setLocalError(err instanceof Error ? err.message : 'Failed to rotate password.')
                  } finally {
                    setSubmitting(false)
                  }
                }}
                disabled={submitting() || !password()}
              >
                Rotate password
              </Button>
              <Button variant="ghost" onClick={handleDisconnect} disabled={submitting()}>
                Disconnect
              </Button>
            </div>
          </Show>
        </div>

        {/* Section 2: Story settings */}
        <Show
          when={storyId()}
          fallback={
            <div class={styles.section}>
              <p class={styles.sectionSubtitle}>Open a story to configure Royal Road publishing.</p>
            </div>
          }
        >
          <div class={styles.section}>
            <h3 class={styles.sectionTitle}>This story</h3>
            <p class={styles.sectionSubtitle}>
              Link this story to a Royal Road fiction. Leave the id blank to have the worker
              create the fiction on first publish. Enabling publishing will also push any
              chapter you schedule on the reader (same <code>publishedAt</code>) to Royal Road.
            </p>
            <FormField label="Royal Road story id">
              <div class={styles.inlineRow}>
                <Input
                  type="text"
                  inputmode="numeric"
                  value={rrIdInput()}
                  onInput={(e) => setRrIdInput(e.currentTarget.value)}
                  disabled={submitting()}
                  placeholder="e.g. 12345"
                />
                <Button
                  variant="secondary"
                  onClick={handleSaveRrId}
                  disabled={submitting() || !settings()}
                >
                  Save
                </Button>
              </div>
            </FormField>
            <FormField label="Publishing">
              <div class={styles.inlineRow}>
                <label class={styles.inlineRow}>
                  <input
                    type="checkbox"
                    checked={settings()?.publishingEnabled ?? false}
                    disabled={submitting() || !settings() || !account()?.connected}
                    onChange={(e) => handleToggleEnabled(e.currentTarget.checked)}
                  />
                  <span>
                    Also publish scheduled chapters to Royal Road
                    <Show when={!account()?.connected}>
                      <em> (connect an account first)</em>
                    </Show>
                  </span>
                </label>
              </div>
            </FormField>
            <Show when={royalRoadStore.storyError(storyId()!)}>
              <p class={styles.errorText}>{royalRoadStore.storyError(storyId()!)}</p>
            </Show>
          </div>
        </Show>

        {/* Section 3: Status */}
        <Show when={storyId()}>
          <div class={styles.section}>
            <div class={styles.inlineRow} style={{ 'justify-content': 'space-between' }}>
              <h3 class={styles.sectionTitle}>Chapter status</h3>
              <Button variant="ghost" onClick={handleRefreshStatus} disabled={royalRoadStore.storyLoading(storyId()!)}>
                <Show when={royalRoadStore.storyLoading(storyId()!)}>
                  <Spinner size="sm" />
                </Show>
                Refresh
              </Button>
            </div>
            <Show
              when={statusRows().length > 0}
              fallback={<div class={styles.empty}>No chapters yet.</div>}
            >
              <table class={styles.table}>
                <thead>
                  <tr>
                    <th class={styles.th}>Chapter</th>
                    <th class={styles.th}>Status</th>
                    <th class={styles.th}>RR id</th>
                    <th class={styles.th}>Attempts</th>
                    <th class={styles.th}>Error</th>
                    <th class={styles.th} />
                  </tr>
                </thead>
                <tbody>
                  {statusRows().map((row) => {
                    const badgeClass = statusBadgeClass(row.status)
                    return (
                      <tr>
                        <td class={`${styles.td} ${styles.chapterName}`}>{row.chapterName}</td>
                        <td class={styles.td}>
                          <span class={`${styles.badge} ${badgeClass}`}>
                            {row.status ?? '—'}
                          </span>
                        </td>
                        <td class={styles.td}>
                          {row.platformId ?? row.chapterRoyalRoadId ?? '—'}
                        </td>
                        <td class={styles.td}>{row.attempts}</td>
                        <td class={`${styles.td} ${styles.errorCell}`} title={row.errorMessage ?? ''}>
                          {row.errorMessage ?? ''}
                        </td>
                        <td class={styles.td}>
                          <Show when={row.status === 'FAILED'}>
                            <Button variant="secondary" onClick={() => handleRetry(row.chapterId)}>
                              Retry
                            </Button>
                          </Show>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Show>
          </div>
        </Show>
      </Stack>
    </Modal>
  )
}

function statusBadgeClass(status: RoyalRoadStatus): string {
  switch (status) {
    case 'DRAFT':
      return styles.badgeDraft
    case 'SCHEDULED':
      return styles.badgeScheduled
    case 'PUBLISHING':
      return styles.badgePublishing
    case 'PUBLISHED':
      return styles.badgePublished
    case 'FAILED':
      return styles.badgeFailed
    default:
      return styles.badgeUnstarted
  }
}
