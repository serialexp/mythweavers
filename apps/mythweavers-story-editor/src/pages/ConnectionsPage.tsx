/**
 * Connected apps.
 *
 * Lists one row per connection rather than per access token — access tokens
 * live an hour and rotate, so a token list would churn constantly and a live
 * connection would appear to vanish between refreshes.
 */

import { Alert, Button, Spinner } from '@mythweavers/ui'
import { useNavigate } from '@solidjs/router'
import { Component, For, Show, createResource, createSignal } from 'solid-js'
import { deleteMyAccessTokensById, getMyAccessTokens } from '../client/config'
import type { GetMyAccessTokensResponse } from '../client/config'
import * as styles from './ConnectionsPage.css'

type Connection = GetMyAccessTokensResponse['connections'][number]

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function scopeLabels(scope: string | null): string[] {
  if (!scope) return []
  return scope.split(' ').filter(Boolean)
}

const ConnectionsPage: Component = () => {
  const navigate = useNavigate()
  const [error, setError] = createSignal<string>()
  const [revoking, setRevoking] = createSignal<string>()

  const [connections, { refetch }] = createResource(async () => {
    const { data } = await getMyAccessTokens()
    return data?.connections ?? []
  })

  const revoke = async (connection: Connection) => {
    const label = connection.name || 'this application'
    if (!window.confirm(`Revoke access for ${label}? It will need to be authorized again.`)) return

    setError()
    setRevoking(connection.id)
    try {
      await deleteMyAccessTokensById({ path: { id: connection.id } })
      await refetch()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to revoke this connection')
    } finally {
      setRevoking()
    }
  }

  return (
    <div class={styles.container}>
      <header class={styles.header}>
        <div class={styles.headerLeft}>
          <button class={styles.backButton} onClick={() => navigate(-1)} title="Back" type="button">
            ←
          </button>
          <span class={styles.title}>Connected Apps</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </header>

      <div class={styles.content}>
        <p class={styles.intro}>
          Applications you have authorized to use your MythWeavers account, such as the CLI or an MCP client. Revoking
          takes effect immediately.
        </p>

        <Show when={error()}>
          {(value) => (
            <Alert variant="error" title="Something went wrong">
              {value()}
            </Alert>
          )}
        </Show>

        <Show
          when={!connections.loading}
          fallback={
            <div class={styles.loading}>
              <Spinner size="lg" />
            </div>
          }
        >
          <Show
            when={(connections() ?? []).length > 0}
            fallback={<p class={styles.empty}>No applications are connected to your account.</p>}
          >
            <ul class={styles.list}>
              <For each={connections()}>
                {(connection) => (
                  <li class={styles.item}>
                    <div class={styles.itemMain}>
                      <div class={styles.itemHeader}>
                        <span class={styles.itemName}>{connection.name}</span>
                        <span class={styles.kindBadge}>
                          {connection.kind === 'oauth' ? 'Authorized app' : 'Access token'}
                        </span>
                      </div>
                      <div class={styles.itemMeta}>
                        <span>Connected {formatDate(connection.createdAt)}</span>
                        <span>Last used {formatDate(connection.lastUsed)}</span>
                        <Show when={connection.expiresAt}>
                          <span>Expires {formatDate(connection.expiresAt)}</span>
                        </Show>
                      </div>
                      <Show when={scopeLabels(connection.scope).length > 0}>
                        <div class={styles.scopes}>
                          <For each={scopeLabels(connection.scope)}>
                            {(scope) => <code class={styles.scope}>{scope}</code>}
                          </For>
                        </div>
                      </Show>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={revoking() === connection.id}
                      onClick={() => revoke(connection)}
                    >
                      {revoking() === connection.id ? 'Revoking…' : 'Revoke'}
                    </Button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Show>
      </div>
    </div>
  )
}

export default ConnectionsPage
