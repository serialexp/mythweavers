import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Divider,
  FormField,
  Heading,
  Input,
  ListDetailPanel,
  Modal,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@mythweavers/ui"
import { createResource, createSignal, Show } from "solid-js"
import {
  getAdminUsers,
  putAdminUsersById,
  postAdminUsersByIdBalance,
} from "../api/config"
import * as styles from "./UsersPage.css"

type AdminUser = {
  id: number
  email: string
  username: string
  role: string
  avatarUrl: string | null
  balance: string
  createdAt: string
  updatedAt: string
  _count: {
    ownedStories: number
    sessions: number
  }
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

function formatBalance(val: string): string {
  const n = Number.parseFloat(val)
  return `$${n.toFixed(2)}`
}

export function UsersPage() {
  const [page, setPage] = createSignal(1)
  const [search, setSearch] = createSignal("")
  const [activeSearch, setActiveSearch] = createSignal("")
  const [error, setError] = createSignal("")
  const [confirmRoleChange, setConfirmRoleChange] = createSignal<{
    user: AdminUser
    newRole: string
  } | null>(null)
  const [balanceModal, setBalanceModal] = createSignal<AdminUser | null>(null)
  const [balanceAmount, setBalanceAmount] = createSignal("")
  const [balanceReason, setBalanceReason] = createSignal("")
  const [balanceSubmitting, setBalanceSubmitting] = createSignal(false)
  let searchTimer: ReturnType<typeof setTimeout> | undefined

  const [data, { refetch }] = createResource(
    () => ({ page: page(), search: activeSearch() }),
    async ({ page, search }) => {
      const res = await getAdminUsers({
        query: {
          page,
          pageSize: 50,
          ...(search ? { search } : {}),
        },
      })
      return res.data as
        | { users: AdminUser[]; pagination: Pagination }
        | undefined
    },
  )

  const users = () => data()?.users ?? []
  const pagination = () => data()?.pagination

  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      setPage(1)
      setActiveSearch(val)
    }, 300)
  }

  const handleRoleChange = async () => {
    const change = confirmRoleChange()
    if (!change) return
    try {
      setError("")
      await putAdminUsersById({
        path: { id: change.user.id },
        body: { role: change.newRole as "user" | "admin" },
      })
      setConfirmRoleChange(null)
      refetch()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update role",
      )
      setConfirmRoleChange(null)
    }
  }

  const handleBalanceAdjust = async () => {
    const user = balanceModal()
    const amount = Number.parseFloat(balanceAmount())
    const description = balanceReason().trim()
    if (!user || Number.isNaN(amount) || !description) return

    setBalanceSubmitting(true)
    try {
      setError("")
      await postAdminUsersByIdBalance({
        path: { id: user.id },
        body: { amount, description },
      })
      setBalanceModal(null)
      setBalanceAmount("")
      setBalanceReason("")
      refetch()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to adjust balance",
      )
    } finally {
      setBalanceSubmitting(false)
    }
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Items need string ids for ListDetailPanel
  const usersWithStringIds = () =>
    users().map((u) => ({ ...u, id: String(u.id) }))

  return (
    <>
      <Stack direction="vertical" gap="lg">
        <Heading level={1} size="xl">
          Users
        </Heading>

        <Show when={error()}>
          <Alert
            variant="error"
            title="Error"
            dismissible
            onDismiss={() => setError("")}
          >
            {error()}
          </Alert>
        </Show>

        <div class={styles.searchRow}>
          <FormField label="Search users">
            <Input
              placeholder="Search by username or email..."
              value={search()}
              onInput={(e) => handleSearch(e.currentTarget.value)}
            />
          </FormField>
        </div>

        <Show when={data.loading && !data()}>
          <Stack direction="horizontal" justify="center">
            <Spinner size="lg" />
          </Stack>
        </Show>

        <Show when={data()}>
          <ListDetailPanel
            items={usersWithStringIds()}
            emptyStateMessage="Select a user to see details."
            renderListItem={(user, _isSelected) => (
              <div class={styles.userRow}>
                <div class={styles.userInfo}>
                  <Stack direction="horizontal" gap="sm" align="center">
                    <Text weight="semibold">{user.username}</Text>
                    <Show when={user.role === "admin"}>
                      <Badge variant="primary" size="sm">
                        admin
                      </Badge>
                    </Show>
                  </Stack>
                  <div class={styles.userMeta}>
                    <span>{user.email}</span>
                    <span>{formatBalance(user.balance)}</span>
                  </div>
                </div>
              </div>
            )}
            detailTitle={(u) => u.username}
            renderDetail={(user) => (
              <Stack direction="vertical" gap="md">
                {/* Balance card */}
                <Card
                  variant={
                    Number.parseFloat(user.balance) > 0
                      ? "outlined"
                      : "elevated"
                  }
                  padding="md"
                >
                  <CardBody>
                    <Stack
                      direction="horizontal"
                      justify="between"
                      align="center"
                    >
                      <Stack direction="vertical" gap="xs">
                        <Text size="xs" color="secondary">
                          Balance
                        </Text>
                        <Heading level={3} size="lg">
                          {formatBalance(user.balance)}
                        </Heading>
                      </Stack>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setBalanceModal({ ...user, id: Number(user.id) })
                          setBalanceAmount("")
                          setBalanceReason("")
                        }}
                      >
                        Adjust Balance
                      </Button>
                    </Stack>
                  </CardBody>
                </Card>

                {/* User info */}
                <Card variant="outlined" padding="md">
                  <CardBody gap="md">
                    <Stack direction="vertical" gap="sm">
                      <Stack direction="horizontal" gap="sm">
                        <Text size="sm" color="secondary">
                          Email
                        </Text>
                        <Text size="sm">{user.email}</Text>
                      </Stack>
                      <Stack direction="horizontal" gap="sm">
                        <Text size="sm" color="secondary">
                          User ID
                        </Text>
                        <Text size="sm">{user.id}</Text>
                      </Stack>
                      <Stack direction="horizontal" gap="sm">
                        <Text size="sm" color="secondary">
                          Joined
                        </Text>
                        <Text size="sm">{formatDate(user.createdAt)}</Text>
                      </Stack>
                      <Stack direction="horizontal" gap="sm">
                        <Text size="sm" color="secondary">
                          Stories
                        </Text>
                        <Text size="sm">{user._count.ownedStories}</Text>
                      </Stack>
                      <Stack direction="horizontal" gap="sm">
                        <Text size="sm" color="secondary">
                          Active sessions
                        </Text>
                        <Text size="sm">{user._count.sessions}</Text>
                      </Stack>
                    </Stack>
                  </CardBody>
                </Card>

                <Divider spacing="sm" />

                {/* Role */}
                <Heading level={4} size="sm">
                  Role
                </Heading>
                <Stack direction="horizontal" gap="sm" align="center">
                  <Badge
                    variant={user.role === "admin" ? "primary" : "default"}
                    size="md"
                  >
                    {user.role}
                  </Badge>
                  <Show when={user.role === "user"}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setConfirmRoleChange({
                          user: { ...user, id: Number(user.id) },
                          newRole: "admin",
                        })
                      }
                    >
                      Promote to Admin
                    </Button>
                  </Show>
                  <Show when={user.role === "admin"}>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        setConfirmRoleChange({
                          user: { ...user, id: Number(user.id) },
                          newRole: "user",
                        })
                      }
                    >
                      Demote to User
                    </Button>
                  </Show>
                </Stack>
              </Stack>
            )}
          />

          {/* Pagination */}
          <Show when={pagination() && pagination()!.totalPages > 1}>
            <div class={styles.paginationRow}>
              <Button
                variant="ghost"
                size="sm"
                disabled={page() <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                &larr; Previous
              </Button>
              <Text size="sm" color="secondary">
                Page {pagination()!.page} of {pagination()!.totalPages} (
                {pagination()!.total} users)
              </Text>
              <Button
                variant="ghost"
                size="sm"
                disabled={page() >= pagination()!.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next &rarr;
              </Button>
            </div>
          </Show>
        </Show>
      </Stack>

      {/* Role change confirmation */}
      <Modal
        open={!!confirmRoleChange()}
        onClose={() => setConfirmRoleChange(null)}
        title="Change User Role"
        size="sm"
        footer={
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="ghost" onClick={() => setConfirmRoleChange(null)}>
              Cancel
            </Button>
            <Button
              variant={
                confirmRoleChange()?.newRole === "admin" ? "primary" : "danger"
              }
              onClick={handleRoleChange}
            >
              {confirmRoleChange()?.newRole === "admin"
                ? "Promote"
                : "Demote"}
            </Button>
          </Stack>
        }
      >
        <Text>
          Are you sure you want to change{" "}
          <strong>{confirmRoleChange()?.user.username}</strong>'s role from{" "}
          <strong>{confirmRoleChange()?.user.role}</strong> to{" "}
          <strong>{confirmRoleChange()?.newRole}</strong>?
        </Text>
      </Modal>

      {/* Balance adjustment modal */}
      <Modal
        open={!!balanceModal()}
        onClose={() => setBalanceModal(null)}
        title={`Adjust Balance — ${balanceModal()?.username}`}
        size="sm"
        footer={
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="ghost" onClick={() => setBalanceModal(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBalanceAdjust}
              disabled={
                balanceSubmitting() ||
                !balanceAmount() ||
                !balanceReason().trim()
              }
            >
              {balanceSubmitting() ? "Adjusting..." : "Apply"}
            </Button>
          </Stack>
        }
      >
        <Stack direction="vertical" gap="md">
          <Text size="sm" color="secondary">
            Current balance:{" "}
            <strong>{formatBalance(balanceModal()?.balance ?? "0")}</strong>
          </Text>
          <FormField
            label="Amount"
            required
            hint="Positive to add credit, negative to deduct."
          >
            <Input
              type="number"
              step="0.01"
              value={balanceAmount()}
              onInput={(e) => setBalanceAmount(e.currentTarget.value)}
              placeholder="10.00"
            />
          </FormField>
          <FormField label="Reason" required>
            <Textarea
              value={balanceReason()}
              onInput={(e) => setBalanceReason(e.currentTarget.value)}
              placeholder="Top-up, refund, correction..."
            />
          </FormField>
        </Stack>
      </Modal>
    </>
  )
}
