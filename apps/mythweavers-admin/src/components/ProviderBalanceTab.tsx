import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Heading,
  Spinner,
  Stack,
  Text,
} from "@mythweavers/ui"
import { For, createResource, createSignal, Show } from "solid-js"
import { getApiBaseUrl } from "../api/config"
import * as styles from "./ProviderBalanceTab.css"

type Transaction = {
  id: string
  providerId: string
  type: "TOP_UP" | "COST_SYNC"
  amount: string
  date: string
  notes: string | null
  syncKey: string | null
  createdAt: string
}

type BalanceData = {
  providerId: string
  totalTopUps: string
  totalCosts: string
  balance: string
}

type Pagination = {
  page: number
  pageSize: number
  total: number
}

async function fetchBalance(providerId: string): Promise<BalanceData> {
  const res = await fetch(`${getApiBaseUrl()}/admin/llm/providers/${providerId}/balance`, {
    credentials: "include",
  })
  if (!res.ok) throw new Error(`Failed to fetch balance: ${res.status}`)
  const body = await res.json() as { balance: BalanceData }
  return body.balance
}

async function fetchTransactions(
  providerId: string,
  page: number,
  pageSize: number,
): Promise<{ transactions: Transaction[]; pagination: Pagination }> {
  const res = await fetch(
    `${getApiBaseUrl()}/admin/llm/providers/${providerId}/transactions?page=${page}&pageSize=${pageSize}`,
    { credentials: "include" },
  )
  if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`)
  return res.json() as Promise<{ transactions: Transaction[]; pagination: Pagination }>
}

function formatUsd(amount: string | number): string {
  const num = typeof amount === "string" ? Number.parseFloat(amount) : amount
  return `$${num.toFixed(2)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function ProviderBalanceTab(props: {
  providerId: string
  protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE"
}) {
  const [error, setError] = createSignal("")
  const [successMsg, setSuccessMsg] = createSignal("")
  const [page, setPage] = createSignal(1)
  const pageSize = 20

  // Top-up form state
  const [topUpAmount, setTopUpAmount] = createSignal("")
  const [topUpDate, setTopUpDate] = createSignal("")
  const [topUpNotes, setTopUpNotes] = createSignal("")
  const [submittingTopUp, setSubmittingTopUp] = createSignal(false)

  // Sync costs form state
  const [syncStartDate, setSyncStartDate] = createSignal("")
  const [syncEndDate, setSyncEndDate] = createSignal("")
  const [syncing, setSyncing] = createSignal(false)

  // Data resources
  const [balance, { refetch: refetchBalance }] = createResource(
    () => props.providerId,
    (id) => fetchBalance(id),
  )

  const [txData, { refetch: refetchTransactions }] = createResource(
    () => ({ providerId: props.providerId, page: page() }),
    (params) => fetchTransactions(params.providerId, params.page, pageSize),
  )

  const refetchAll = () => {
    refetchBalance()
    refetchTransactions()
  }

  const handleAddTopUp = async () => {
    const amount = Number.parseFloat(topUpAmount())
    if (!amount || amount <= 0) {
      setError("Amount must be a positive number")
      return
    }

    setSubmittingTopUp(true)
    setError("")
    setSuccessMsg("")
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/admin/llm/providers/${props.providerId}/top-up`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            amount,
            ...(topUpDate() ? { date: new Date(topUpDate()).toISOString() } : {}),
            ...(topUpNotes() ? { notes: topUpNotes() } : {}),
          }),
        },
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      setTopUpAmount("")
      setTopUpDate("")
      setTopUpNotes("")
      setSuccessMsg(`Added ${formatUsd(amount)} top-up`)
      refetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add top-up")
    } finally {
      setSubmittingTopUp(false)
    }
  }

  const handleSyncCosts = async () => {
    if (!syncStartDate() || !syncEndDate()) {
      setError("Both start and end dates are required")
      return
    }

    setSyncing(true)
    setError("")
    setSuccessMsg("")
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/admin/llm/providers/${props.providerId}/sync-costs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            startDate: syncStartDate(),
            endDate: syncEndDate(),
          }),
        },
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const data = (await res.json()) as {
        synced: number
        updated: number
        totalCost: string
      }

      setSuccessMsg(
        `Synced ${data.synced} new, ${data.updated} updated. ` +
        `Total cost for period: ${formatUsd(data.totalCost)}`,
      )
      refetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync costs")
    } finally {
      setSyncing(false)
    }
  }

  const totalPages = () => {
    const data = txData()
    if (!data) return 1
    return Math.max(1, Math.ceil(data.pagination.total / pageSize))
  }

  const supportsSync = () => props.protocol !== "CLOUDFLARE"

  return (
    <Stack direction="vertical" gap="md">
      <Show when={error()}>
        <Alert variant="error" title="Error" dismissible onDismiss={() => setError("")}>
          {error()}
        </Alert>
      </Show>

      <Show when={successMsg()}>
        <Alert variant="success" title="Success" dismissible onDismiss={() => setSuccessMsg("")}>
          {successMsg()}
        </Alert>
      </Show>

      {/* Balance summary */}
      <Show when={balance.loading}>
        <Stack direction="horizontal" justify="center">
          <Spinner size="md" />
        </Stack>
      </Show>

      <Show when={balance()}>
        {(bal) => (
          <div class={styles.balanceGrid}>
            <Card variant="outlined" padding="md">
              <CardBody>
                <Stack direction="vertical" gap="xs" align="center">
                  <Text size="xs" color="secondary" weight="semibold">
                    BALANCE
                  </Text>
                  <Text
                    size="xl"
                    weight="bold"
                    color={Number.parseFloat(bal().balance) >= 0 ? undefined : "error"}
                  >
                    {formatUsd(bal().balance)}
                  </Text>
                </Stack>
              </CardBody>
            </Card>
            <Card variant="outlined" padding="md">
              <CardBody>
                <Stack direction="vertical" gap="xs" align="center">
                  <Text size="xs" color="secondary" weight="semibold">
                    TOTAL TOP-UPS
                  </Text>
                  <Text size="lg" weight="semibold">
                    {formatUsd(bal().totalTopUps)}
                  </Text>
                </Stack>
              </CardBody>
            </Card>
            <Card variant="outlined" padding="md">
              <CardBody>
                <Stack direction="vertical" gap="xs" align="center">
                  <Text size="xs" color="secondary" weight="semibold">
                    TOTAL COSTS
                  </Text>
                  <Text size="lg" weight="semibold">
                    {formatUsd(bal().totalCosts)}
                  </Text>
                </Stack>
              </CardBody>
            </Card>
          </div>
        )}
      </Show>

      {/* Actions row */}
      <Stack direction="horizontal" gap="lg" wrap>
        {/* Add Top-up form */}
        <Card variant="outlined" padding="md" class={styles.actionCard}>
          <CardBody>
            <Stack direction="vertical" gap="sm">
              <Heading level={4} size="sm">
                Add Top-up
              </Heading>
              <div class={styles.formGrid}>
                <label class={styles.formLabel}>
                  Amount (USD)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="100.00"
                    value={topUpAmount()}
                    onInput={(e) => setTopUpAmount(e.currentTarget.value)}
                    class={styles.formInput}
                  />
                </label>
                <label class={styles.formLabel}>
                  Date (optional)
                  <input
                    type="date"
                    value={topUpDate()}
                    onInput={(e) => setTopUpDate(e.currentTarget.value)}
                    class={styles.formInput}
                  />
                </label>
                <label class={styles.formLabel}>
                  Notes (optional)
                  <input
                    type="text"
                    placeholder="April credit purchase"
                    value={topUpNotes()}
                    onInput={(e) => setTopUpNotes(e.currentTarget.value)}
                    class={styles.formInput}
                  />
                </label>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddTopUp}
                disabled={submittingTopUp() || !topUpAmount()}
              >
                {submittingTopUp() ? "Adding..." : "Add Top-up"}
              </Button>
            </Stack>
          </CardBody>
        </Card>

        {/* Sync Costs form */}
        <Show when={supportsSync()}>
          <Card variant="outlined" padding="md" class={styles.actionCard}>
            <CardBody>
              <Stack direction="vertical" gap="sm">
                <Heading level={4} size="sm">
                  Sync Costs from Provider
                </Heading>
                <Text size="xs" color="muted">
                  Fetches costs from the provider's API. Requires an admin API key.
                </Text>
                <div class={styles.formGrid}>
                  <label class={styles.formLabel}>
                    Start Date
                    <input
                      type="date"
                      value={syncStartDate()}
                      onInput={(e) => setSyncStartDate(e.currentTarget.value)}
                      class={styles.formInput}
                    />
                  </label>
                  <label class={styles.formLabel}>
                    End Date
                    <input
                      type="date"
                      value={syncEndDate()}
                      onInput={(e) => setSyncEndDate(e.currentTarget.value)}
                      class={styles.formInput}
                    />
                  </label>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncCosts}
                  disabled={syncing() || !syncStartDate() || !syncEndDate()}
                >
                  {syncing() ? "Syncing..." : "Sync Costs"}
                </Button>
              </Stack>
            </CardBody>
          </Card>
        </Show>

        <Show when={!supportsSync()}>
          <Card variant="outlined" padding="md" class={styles.actionCard}>
            <CardBody>
              <Stack direction="vertical" gap="sm">
                <Heading level={4} size="sm">
                  Cost Sync
                </Heading>
                <Text size="sm" color="muted">
                  Cost sync is not available for Cloudflare providers. Add costs manually as top-ups with negative notes if needed.
                </Text>
              </Stack>
            </CardBody>
          </Card>
        </Show>
      </Stack>

      {/* Transaction history */}
      <Heading level={3} size="base">
        Transaction History
      </Heading>

      <Show when={txData.loading}>
        <Stack direction="horizontal" justify="center">
          <Spinner size="md" />
        </Stack>
      </Show>

      <Show when={txData() && txData()!.transactions.length === 0}>
        <Text color="muted">No transactions yet.</Text>
      </Show>

      <Show when={txData() && txData()!.transactions.length > 0}>
        <div class={styles.transactionTable}>
          <div class={styles.tableHeaderRow}>
            <div class={styles.tableHeaderCell}>Date</div>
            <div class={styles.tableHeaderCell}>Type</div>
            <div class={styles.tableHeaderCell}>Amount</div>
            <div class={styles.tableHeaderCell}>Notes</div>
          </div>
          <For each={txData()!.transactions}>
            {(tx) => (
              <div class={styles.tableRow}>
                <div class={styles.tableCell}>{formatDate(tx.date)}</div>
                <div class={styles.tableCell}>
                  <Badge
                    variant={tx.type === "TOP_UP" ? "success" : "error"}
                    size="sm"
                  >
                    {tx.type === "TOP_UP" ? "Top-up" : "Cost"}
                  </Badge>
                </div>
                <div class={`${styles.tableCell} ${tx.type === "TOP_UP" ? styles.amountPositive : styles.amountNegative}`}>
                  {tx.type === "TOP_UP" ? "+" : "-"}{formatUsd(tx.amount)}
                </div>
                <div class={`${styles.tableCell} ${styles.notesCell}`}>{tx.notes ?? "—"}</div>
              </div>
            )}
          </For>
        </div>

        {/* Pagination */}
        <Show when={totalPages() > 1}>
          <Stack direction="horizontal" gap="sm" justify="center" align="center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page() <= 1}
            >
              Previous
            </Button>
            <Text size="sm" color="secondary">
              Page {page()} of {totalPages()}
            </Text>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages(), p + 1))}
              disabled={page() >= totalPages()}
            >
              Next
            </Button>
          </Stack>
        </Show>
      </Show>
    </Stack>
  )
}
