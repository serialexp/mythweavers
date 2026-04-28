import { For, Show, createSignal } from 'solid-js'
import { Button, Card, CardBody, CardTitle } from '@mythweavers/ui'
import { Layout } from '../Layout'
import type { AuthorSummary, User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface AuthorsPageProps {
  user: User | null
  authors: AuthorSummary[]
  search: string
  initialTheme?: 'chronicle' | 'starlight'
}

export const AuthorsPage = (props: AuthorsPageProps) => {
  const [q, setQ] = createSignal(props.search)

  const submit = (e: Event) => {
    e.preventDefault()
    const url = new URL(window.location.href)
    if (q()) url.searchParams.set('search', q())
    else url.searchParams.delete('search')
    window.location.href = url.toString()
  }

  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg" gap="md">
            <CardTitle size="lg">Authors</CardTitle>

            <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="search"
                placeholder="Search authors…"
                value={q()}
                onInput={(e) => setQ(e.currentTarget.value)}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  'border-radius': '6px',
                  border: '1px solid var(--color-border-default__1wxbrr2j)',
                  'background-color': 'var(--color-bg-elevated__1wxbrr2c)',
                  color: 'var(--color-text-primary__1wxbrr27)',
                }}
              />
              <Button type="submit" variant="primary" size="sm">
                Search
              </Button>
            </form>

            <Show
              when={props.authors.length > 0}
              fallback={<p class={pageStyles.textSecondary}>No authors found.</p>}
            >
              <div
                style={{
                  display: 'grid',
                  'grid-template-columns': 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                <For each={props.authors}>
                  {(author) => (
                    <a
                      href={`/authors/${author.id}`}
                      style={{
                        display: 'flex',
                        'flex-direction': 'column',
                        gap: '0.25rem',
                        padding: '1rem',
                        'border-radius': '8px',
                        'background-color': 'var(--color-bg-elevated__1wxbrr2c)',
                        border: '1px solid var(--color-border-default__1wxbrr2j)',
                        'text-decoration': 'none',
                        color: 'inherit',
                      }}
                    >
                      <strong style={{ color: 'var(--color-text-primary__1wxbrr27)' }}>
                        {author.username}
                      </strong>
                      <span class={pageStyles.textSecondary} style={{ 'font-size': '0.85rem' }}>
                        {author.storyCount} {author.storyCount === 1 ? 'story' : 'stories'}
                      </span>
                    </a>
                  )}
                </For>
              </div>
            </Show>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
