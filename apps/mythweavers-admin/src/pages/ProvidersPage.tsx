import {
  Alert,
  Button,
  Card,
  CardBody,
  Heading,
  ListDetailPanel,
  type ListDetailPanelRef,
  Modal,
  Spinner,
  Stack,
  Text,
} from "@mythweavers/ui"
import { useNavigate } from "@solidjs/router"
import { createResource, createSignal, Show } from "solid-js"
import {
  getAdminLlmProviders,
  postAdminLlmProviders,
  putAdminLlmProvidersById,
  deleteAdminLlmProvidersById,
} from "../api/config"
import { ProtocolBadge } from "../components/ProtocolBadge"
import { ProviderForm } from "../components/ProviderForm"
import { StatusDot } from "../components/StatusDot"
import * as styles from "./ProvidersPage.css"

type Provider = {
  id: string
  name: string
  displayName: string
  endpointUrl: string
  protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE"
  envKeyName: string
  enabled: boolean
  sortOrder: number
  keyConfigured: boolean
  createdAt: string
  updatedAt: string
}

export function ProvidersPage() {
  const navigate = useNavigate()
  const [providers, { refetch }] = createResource(async () => {
    const res = await getAdminLlmProviders()
    return (res.data?.providers ?? []) as Provider[]
  })
  const [error, setError] = createSignal("")
  const [confirmDelete, setConfirmDelete] = createSignal<Provider | null>(null)
  let panelRef: ListDetailPanelRef | undefined

  const handleToggleEnabled = async (provider: Provider) => {
    try {
      setError("")
      const res = await putAdminLlmProvidersById({
        path: { id: provider.id },
        body: { enabled: !provider.enabled },
      })
      if (res.error) throw new Error((res.error as any)?.error ?? "Failed to toggle provider")
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle provider")
    }
  }

  const handleDelete = async () => {
    const provider = confirmDelete()
    if (!provider) return
    try {
      setError("")
      const res = await deleteAdminLlmProvidersById({ path: { id: provider.id } })
      if (res.error) throw new Error((res.error as any)?.error ?? "Failed to delete provider")
      setConfirmDelete(null)
      panelRef?.clearSelection()
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete provider")
    }
  }

  const handleCreate = async (data: {
    name: string
    displayName: string
    endpointUrl: string
    protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE"
    envKeyName: string
    sortOrder: number
  }) => {
    const res = await postAdminLlmProviders({ body: data })
    if (res.error) {
      throw new Error((res.error as any)?.error ?? "Failed to create provider")
    }
    panelRef?.clearSelection()
    refetch()
  }

  return (
    <>
      <Stack direction="vertical" gap="lg">
        <Stack direction="horizontal" justify="between" align="center">
          <Heading level={1} size="xl">
            LLM Providers
          </Heading>
          <Button
            variant="primary"
            size="sm"
            onClick={() => panelRef?.select("new")}
          >
            Add Provider
          </Button>
        </Stack>

        <Show when={error()}>
          <Alert variant="error" title="Error" dismissible onDismiss={() => setError("")}>
            {error()}
          </Alert>
        </Show>

        <Show when={providers.loading}>
          <Stack direction="horizontal" justify="center">
            <Spinner size="lg" />
          </Stack>
        </Show>

        <Show when={!providers.loading && providers()}>
          <ListDetailPanel
            ref={(r) => {
              panelRef = r
            }}
            items={providers() ?? []}
            emptyStateMessage="Select a provider to see details, or add a new one."
            renderListItem={(provider, _isSelected) => (
              <div class={styles.providerRow}>
                <div class={styles.indicators}>
                  <StatusDot
                    status={provider.enabled ? "success" : "error"}
                    title={provider.enabled ? "Enabled" : "Disabled"}
                  />
                  <StatusDot
                    status={provider.keyConfigured ? "success" : "warning"}
                    title={
                      provider.keyConfigured
                        ? "API key configured"
                        : "API key not set"
                    }
                  />
                </div>
                <div class={styles.providerInfo}>
                  <Text weight="semibold">{provider.displayName}</Text>
                  <div class={styles.providerSlug}>{provider.name}</div>
                </div>
                <ProtocolBadge protocol={provider.protocol} />
              </div>
            )}
            detailTitle={(p) => p.displayName}
            renderDetail={(provider) => (
              <Stack direction="vertical" gap="md">
                <Stack direction="horizontal" gap="sm" wrap>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/providers/${provider.id}`)}
                  >
                    Edit & Manage Models
                  </Button>
                  <Button
                    variant={provider.enabled ? "outline" : "primary"}
                    size="sm"
                    onClick={() => handleToggleEnabled(provider)}
                  >
                    {provider.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmDelete(provider)}
                  >
                    Delete
                  </Button>
                </Stack>

                <Stack direction="vertical" gap="xs">
                  <Text size="sm" color="secondary">
                    Endpoint
                  </Text>
                  <Text size="sm">{provider.endpointUrl}</Text>
                </Stack>

                <Stack direction="vertical" gap="xs">
                  <Stack direction="horizontal" gap="sm" align="center">
                    <Text size="sm" color="secondary">
                      Env Key
                    </Text>
                    <StatusDot
                      status={provider.keyConfigured ? "success" : "warning"}
                      title={
                        provider.keyConfigured
                          ? "Key is set"
                          : "Key is NOT set"
                      }
                    />
                  </Stack>
                  <Text size="sm" as="code" style={{ "font-family": "monospace" }}>
                    {provider.envKeyName}
                  </Text>
                </Stack>
              </Stack>
            )}
            newItemTitle="Add Provider"
            renderNewForm={() => (
              <Card variant="outlined" padding="md">
                <CardBody>
                  <ProviderForm
                    onSubmit={handleCreate}
                    onCancel={() => panelRef?.clearSelection()}
                    submitLabel="Create Provider"
                  />
                </CardBody>
              </Card>
            )}
          />
        </Show>
      </Stack>

      {/* Delete confirmation modal */}
      <Modal
        open={!!confirmDelete()}
        onClose={() => setConfirmDelete(null)}
        title="Delete Provider"
        size="sm"
        footer={
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </Stack>
        }
      >
        <Text>
          Are you sure you want to delete{" "}
          <strong>{confirmDelete()?.displayName}</strong> and all its models?
          This cannot be undone.
        </Text>
      </Modal>
    </>
  )
}
