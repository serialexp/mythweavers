import { Component, For, Show, createSignal, createResource } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Button, Spinner } from '@mythweavers/ui'
import { getMyBalanceUsage } from '../client/config'
import type { GetMyBalanceUsageResponse } from '../client/config'
import ModelCostChart from '../components/ModelCostChart'
import * as styles from './UsagePage.css'

type UsageEntry = GetMyBalanceUsageResponse['entries'][number]

/** Predefined time range options */
const TIME_RANGES = [
  { label: 'All time', value: '' },
  { label: '1h', value: '1h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
] as const

function timeRangeToSince(range: string): string | undefined {
  if (!range) return undefined
  const now = Date.now()
  const offsets: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }
  const offset = offsets[range]
  if (!offset) return undefined
  return new Date(now - offset).toISOString()
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  LLM_USAGE: styles.badgeLlm,
  TOPUP: styles.badgeTopup,
  CREDIT: styles.badgeCredit,
  ADJUSTMENT: styles.badgeAdjustment,
}

const TYPE_LABELS: Record<string, string> = {
  LLM_USAGE: 'Generation',
  TOPUP: 'Top-up',
  CREDIT: 'Credit',
  ADJUSTMENT: 'Adjustment',
}

function formatAmount(amount: string): string {
  const n = Number(amount)
  const abs = Math.abs(n)
  if (abs < 0.01) return n < 0 ? `-$${abs.toFixed(4)}` : `+$${abs.toFixed(4)}`
  return n < 0 ? `-$${abs.toFixed(2)}` : `+$${abs.toFixed(2)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1_000) return `${ms}ms`
  return `${(ms / 1_000).toFixed(1)}s`
}

const UsagePage: Component = () => {
  const navigate = useNavigate()
  const [page, setPage] = createSignal(1)
  const [typeFilter, setTypeFilter] = createSignal<string>('')
  const [timeRange, setTimeRange] = createSignal<string>('')

  const since = () => timeRangeToSince(timeRange())

  const fetchUsage = async () => {
    const query: Record<string, unknown> = {
      page: page(),
      pageSize: 50,
    }
    if (typeFilter()) {
      query.type = typeFilter()
    }
    const sinceValue = since()
    if (sinceValue) {
      query.since = sinceValue
    }
    const { data } = await getMyBalanceUsage({ query: query as any })
    return data ?? null
  }

  const [usage, { refetch }] = createResource(
    () => ({ page: page(), type: typeFilter(), since: since() }),
    fetchUsage,
  )

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleTypeChange = (value: string) => {
    setTypeFilter(value)
    setPage(1)
  }

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value)
    setPage(1)
  }

  return (
    <div class={styles.container}>
      <header class={styles.header}>
        <div class={styles.headerLeft}>
          <button class={styles.backButton} onClick={() => navigate(-1)} title="Back">
            ←
          </button>
          <span class={styles.title}>Usage History</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </header>

      <div class={styles.content}>
        {/* Summary cards */}
        <Show when={usage()}>
          {(data) => (
            <div class={styles.summaryCards}>
              <div class={styles.summaryCard}>
                <div class={styles.summaryLabel}>Total Spent</div>
                <div class={styles.summaryValue}>
                  ${Number(data().summary.totalSpent).toFixed(2)}
                </div>
              </div>
              <div class={styles.summaryCard}>
                <div class={styles.summaryLabel}>Total Top-ups</div>
                <div class={styles.summaryValue}>
                  ${Number(data().summary.totalTopUps).toFixed(2)}
                </div>
              </div>
              <div class={styles.summaryCard}>
                <div class={styles.summaryLabel}>Generations</div>
                <div class={styles.summaryValue}>
                  {data().summary.generationCount}
                </div>
              </div>
            </div>
          )}
        </Show>

        {/* Model cost breakdown chart */}
        <ModelCostChart since={since()} />

        {/* Filters */}
        <div class={styles.filterRow}>
          <span class={styles.filterLabel}>Filter:</span>
          <select
            class={styles.filterSelect}
            value={typeFilter()}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="">All</option>
            <option value="LLM_USAGE">Generations</option>
            <option value="TOPUP">Top-ups</option>
            <option value="CREDIT">Credits</option>
            <option value="ADJUSTMENT">Adjustments</option>
          </select>

          <span class={styles.filterLabel} style={{ "margin-left": "auto" }}>Range:</span>
          <div class={styles.timeRangeButtons}>
            <For each={TIME_RANGES}>
              {(range) => (
                <button
                  class={timeRange() === range.value ? styles.timeRangeButtonActive : styles.timeRangeButton}
                  onClick={() => handleTimeRangeChange(range.value)}
                >
                  {range.label}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Loading state */}
        <Show when={usage.loading}>
          <div class={styles.loadingState}>
            <Spinner size="md" />
          </div>
        </Show>

        {/* Table */}
        <Show when={!usage.loading && usage()}>
          {(data) => (
            <>
              <Show when={data().entries.length === 0}>
                <div class={styles.emptyState}>No usage entries found.</div>
              </Show>

              <Show when={data().entries.length > 0}>
                <table class={styles.table}>
                  <thead>
                    <tr>
                      <th class={styles.tableHeader}>Date</th>
                      <th class={styles.tableHeader}>Type</th>
                      <th class={styles.tableHeader}>Description</th>
                      <th class={styles.tableHeader} style={{ "text-align": "right" }}>Amount</th>
                      <th class={styles.tableHeader} style={{ "text-align": "right" }}>Balance</th>
                      <th class={styles.tableHeader}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={data().entries}>
                      {(entry) => <UsageRow entry={entry} />}
                    </For>
                  </tbody>
                </table>
              </Show>

              {/* Pagination */}
              <Show when={data().pagination.totalPages > 1}>
                <div class={styles.pagination}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page() <= 1}
                    onClick={() => handlePageChange(page() - 1)}
                  >
                    Previous
                  </Button>
                  <span class={styles.pageInfo}>
                    Page {data().pagination.page} of {data().pagination.totalPages}
                    {' '}({data().pagination.total} entries)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page() >= data().pagination.totalPages}
                    onClick={() => handlePageChange(page() + 1)}
                  >
                    Next
                  </Button>
                </div>
              </Show>
            </>
          )}
        </Show>
      </div>
    </div>
  )
}

const UsageRow: Component<{ entry: UsageEntry }> = (props) => {
  const amount = () => Number(props.entry.amount)
  const isNegative = () => amount() < 0
  const llm = () => props.entry.llmUsage

  return (
    <tr class={styles.tableRow}>
      <td class={styles.tableCell}>
        {formatDate(props.entry.createdAt)}
      </td>
      <td class={styles.tableCell}>
        <span class={TYPE_BADGE_CLASS[props.entry.type] ?? styles.badge}>
          {TYPE_LABELS[props.entry.type] ?? props.entry.type}
        </span>
      </td>
      <td class={styles.tableCell}>
        <Show when={llm()} fallback={<span class={styles.description}>{props.entry.description}</span>}>
          {(usage) => (
            <span class={styles.modelName}>{usage().modelId}</span>
          )}
        </Show>
      </td>
      <td class={styles.tableCellMono} style={{ "text-align": "right" }}>
        <span class={isNegative() ? styles.amountNegative : styles.amountPositive}>
          {formatAmount(props.entry.amount)}
        </span>
      </td>
      <td class={styles.tableCellMono} style={{ "text-align": "right" }}>
        ${Number(props.entry.balanceAfter).toFixed(2)}
      </td>
      <td class={styles.tableCell}>
        <Show when={llm()}>
          {(usage) => (
            <div class={styles.detailsRow}>
              <span class={styles.detailItem}>
                <span class={styles.detailLabel}>In:</span>
                <span class={styles.detailValue}>{formatTokens(usage().promptTokens)}</span>
              </span>
              <span class={styles.detailItem}>
                <span class={styles.detailLabel}>Out:</span>
                <span class={styles.detailValue}>{formatTokens(usage().completionTokens)}</span>
              </span>
              <Show when={usage().cacheCreationTokens > 0}>
                <span class={styles.detailItem}>
                  <span class={styles.detailLabel}>Cache Write:</span>
                  <span class={styles.detailValue}>{formatTokens(usage().cacheCreationTokens)}</span>
                </span>
              </Show>
              <Show when={usage().cacheReadTokens > 0}>
                <span class={styles.detailItem}>
                  <span class={styles.detailLabel}>Cache Read:</span>
                  <span class={styles.detailValue}>{formatTokens(usage().cacheReadTokens)}</span>
                </span>
              </Show>
              <span class={styles.detailItem}>
                <span class={styles.detailLabel}>Time:</span>
                <span class={styles.detailValue}>{formatDuration(usage().durationMs)}</span>
              </span>
              <Show when={usage().aborted}>
                <span class={styles.detailItem} style={{ color: 'rgb(250, 204, 21)' }}>
                  Aborted
                </span>
              </Show>
            </div>
          )}
        </Show>
      </td>
    </tr>
  )
}

export default UsagePage
