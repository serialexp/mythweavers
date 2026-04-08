import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Divider,
  Heading,
  ListDetailPanel,
  type ListDetailPanelRef,
  Modal,
  Spinner,
  Stack,
  Tabs,
  Tab,
  TabList,
  TabPanel,
  Text,
} from "@mythweavers/ui"
import { useNavigate, useParams } from "@solidjs/router"
import { For, createResource, createSignal, Show } from "solid-js"
import {
  getAdminLlmProvidersById,
  getAdminLlmProvidersByProviderIdDiscover,
  putAdminLlmProvidersById,
  postAdminLlmProvidersByProviderIdModels,
  putAdminLlmModelsById,
  deleteAdminLlmModelsById,
} from "../api/config"
import { ModelForm } from "../components/ModelForm"
import { ProtocolBadge } from "../components/ProtocolBadge"
import { ProviderForm } from "../components/ProviderForm"
import { StatusDot } from "../components/StatusDot"
import * as styles from "./ProviderDetailPage.css"

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

type Model = {
  id: string
  modelId: string
  displayName: string | null
  providerId: string
  enabled: boolean
  contextLength: number | null
  costInput: number
  costOutput: number
  costCacheRead: number | null
  costCacheWrite: number | null
  priceInput: number
  priceOutput: number
  priceCacheRead: number | null
  priceCacheWrite: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

function formatPrice(val: number | null | undefined): string {
  if (val == null) return "—"
  return `$${val.toFixed(2)}`
}

export function ProviderDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [detail, { refetch }] = createResource(
    () => params.id,
    async (id) => {
      const res = await getAdminLlmProvidersById({ path: { id } })
      return res.data as { provider: Provider; models: Model[] } | undefined
    },
  )
  const [error, setError] = createSignal("")
  const [confirmDeleteModel, setConfirmDeleteModel] = createSignal<Model | null>(null)
  const [discoverOpen, setDiscoverOpen] = createSignal(false)
  const [discoverLoading, setDiscoverLoading] = createSignal(false)
  const [discoveredModels, setDiscoveredModels] = createSignal<
    Array<{
      id: string
      name: string | null
      owned_by: string | null
      created: number | null
      imported: boolean
      selected: boolean
    }>
  >([])
  const [importingModels, setImportingModels] = createSignal(false)
  let modelPanelRef: ListDetailPanelRef | undefined

  const provider = () => detail()?.provider
  const models = () => detail()?.models ?? []

  // --- Discover actions ---

  const handleDiscover = async () => {
    setDiscoverOpen(true)
    setDiscoverLoading(true)
    setError("")
    try {
      const res = await getAdminLlmProvidersByProviderIdDiscover({
        path: { providerId: params.id },
      })
      const models = (res.data?.models ?? []) as Array<{
        id: string
        name: string | null
        owned_by: string | null
        created: number | null
        imported: boolean
      }>
      setDiscoveredModels(models.map((m) => ({ ...m, selected: false })))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discover models")
      setDiscoverOpen(false)
    } finally {
      setDiscoverLoading(false)
    }
  }

  const toggleDiscoverSelect = (id: string) => {
    setDiscoveredModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m)),
    )
  }

  const handleImportSelected = async () => {
    const toImport = discoveredModels().filter((m) => m.selected && !m.imported)
    if (toImport.length === 0) return

    setImportingModels(true)
    setError("")
    try {
      for (const m of toImport) {
        await postAdminLlmProvidersByProviderIdModels({
          path: { providerId: params.id },
          body: { modelId: m.id, displayName: m.name || undefined },
        })
      }
      setDiscoverOpen(false)
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import models")
    } finally {
      setImportingModels(false)
    }
  }

  // --- Provider actions ---

  const handleUpdateProvider = async (data: {
    name: string
    displayName: string
    endpointUrl: string
    protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE"
    envKeyName: string
    sortOrder: number
  }) => {
    setError("")
    const { name: _name, ...rest } = data // name is not editable
    await putAdminLlmProvidersById({
      path: { id: params.id },
      body: rest,
    })
    refetch()
  }

  // --- Model actions ---

  const handleToggleModel = async (model: Model) => {
    try {
      setError("")
      await putAdminLlmModelsById({
        path: { id: model.id },
        body: { enabled: !model.enabled },
      })
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle model")
    }
  }

  const handleCreateModel = async (data: {
    modelId: string
    displayName: string
    contextLength: number | null
    costInput: number
    costOutput: number
    costCacheRead: number | null
    costCacheWrite: number | null
    priceInput: number
    priceOutput: number
    priceCacheRead: number | null
    priceCacheWrite: number | null
    sortOrder: number
  }) => {
    setError("")
    await postAdminLlmProvidersByProviderIdModels({
      path: { providerId: params.id },
      body: {
        ...data,
        displayName: data.displayName || undefined,
        contextLength: data.contextLength ?? undefined,
        costCacheRead: data.costCacheRead,
        costCacheWrite: data.costCacheWrite,
        priceCacheRead: data.priceCacheRead,
        priceCacheWrite: data.priceCacheWrite,
      },
    })
    modelPanelRef?.clearSelection()
    refetch()
  }

  const handleUpdateModel = async (
    modelId: string,
    data: {
      modelId: string
      displayName: string
      contextLength: number | null
      costInput: number
      costOutput: number
      costCacheRead: number | null
      costCacheWrite: number | null
      priceInput: number
      priceOutput: number
      priceCacheRead: number | null
      priceCacheWrite: number | null
      sortOrder: number
    },
  ) => {
    setError("")
    await putAdminLlmModelsById({
      path: { id: modelId },
      body: {
        ...data,
        displayName: data.displayName || undefined,
        contextLength: data.contextLength ?? undefined,
        costCacheRead: data.costCacheRead,
        costCacheWrite: data.costCacheWrite,
        priceCacheRead: data.priceCacheRead,
        priceCacheWrite: data.priceCacheWrite,
      },
    })
    refetch()
  }

  const handleDeleteModel = async () => {
    const model = confirmDeleteModel()
    if (!model) return
    try {
      setError("")
      await deleteAdminLlmModelsById({ path: { id: model.id } })
      setConfirmDeleteModel(null)
      modelPanelRef?.clearSelection()
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete model")
    }
  }

  return (
    <Stack direction="vertical" gap="lg">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/providers")}>
        &larr; All Providers
      </Button>

      <Show when={detail.loading}>
        <Stack direction="horizontal" justify="center">
          <Spinner size="lg" />
        </Stack>
      </Show>

      <Show when={detail.error}>
        <Alert variant="error" title="Error loading provider">
          {String(detail.error)}
        </Alert>
      </Show>

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

      <Show when={provider()}>
        {(prov) => (
          <Tabs defaultTab="models">
            <TabList>
              <Tab id="models">
                Models ({models().length})
              </Tab>
              <Tab id="settings">Provider Settings</Tab>
            </TabList>

            {/* ========== MODELS TAB ========== */}
            <TabPanel id="models">
              <Stack direction="vertical" gap="md">
                {/* Provider summary header */}
                <Card variant="flat" padding="md">
                  <CardBody>
                    <Stack direction="horizontal" gap="md" align="center" wrap>
                      <Heading level={2} size="lg">
                        {prov().displayName}
                      </Heading>
                      <ProtocolBadge protocol={prov().protocol} />
                      <Badge
                        variant={prov().enabled ? "success" : "error"}
                        size="sm"
                      >
                        {prov().enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Stack direction="horizontal" gap="xs" align="center">
                        <StatusDot
                          status={
                            prov().keyConfigured ? "success" : "warning"
                          }
                        />
                        <Text size="xs" color="muted">
                          {prov().keyConfigured
                            ? "Key configured"
                            : `Set ${prov().envKeyName}`}
                        </Text>
                      </Stack>
                    </Stack>
                  </CardBody>
                </Card>

                {/* Models list-detail panel */}
                <Stack
                  direction="horizontal"
                  justify="between"
                  align="center"
                >
                  <Heading level={3} size="base">
                    Models
                  </Heading>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDiscover}
                  >
                    Discover Models
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => modelPanelRef?.select("new")}
                  >
                    Add Model
                  </Button>
                </Stack>

                <ListDetailPanel
                  ref={(r) => {
                    modelPanelRef = r
                  }}
                  items={models()}
                  emptyStateMessage="Select a model to view or edit details."
                  renderListItem={(model, _isSelected) => (
                    <div class={styles.modelRow}>
                      <StatusDot
                        status={model.enabled ? "success" : "error"}
                        title={model.enabled ? "Enabled" : "Disabled"}
                      />
                      <div class={styles.modelInfo}>
                        <Text weight="medium">
                          {model.displayName || model.modelId}
                        </Text>
                        <div class={styles.modelMeta}>
                          <Show when={model.displayName}>
                            <span>{model.modelId}</span>
                          </Show>
                          <Show when={model.contextLength}>
                            <span>
                              {(model.contextLength! / 1000).toFixed(0)}k ctx
                            </span>
                          </Show>
                          <span>
                            {formatPrice(model.priceInput)}/
                            {formatPrice(model.priceOutput)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  detailTitle={(m) => m.displayName || m.modelId}
                  renderDetail={(model) => (
                    <Stack direction="vertical" gap="md">
                      {/* Quick actions */}
                      <Stack direction="horizontal" gap="sm">
                        <Button
                          variant={model.enabled ? "outline" : "primary"}
                          size="sm"
                          onClick={() => handleToggleModel(model)}
                        >
                          {model.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setConfirmDeleteModel(model)}
                        >
                          Delete
                        </Button>
                      </Stack>

                      {/* Pricing summary */}
                      <Card variant="outlined" padding="sm">
                        <CardBody>
                          <div class={styles.pricingGrid}>
                            <div />
                            <div class={styles.pricingHeader}>Cost</div>
                            <div class={styles.pricingHeader}>Price</div>

                            <div class={styles.pricingLabel}>Input</div>
                            <div>{formatPrice(model.costInput)}</div>
                            <div>{formatPrice(model.priceInput)}</div>

                            <div class={styles.pricingLabel}>Output</div>
                            <div>{formatPrice(model.costOutput)}</div>
                            <div>{formatPrice(model.priceOutput)}</div>

                            <div class={styles.pricingLabel}>Cache Read</div>
                            <div>{formatPrice(model.costCacheRead)}</div>
                            <div>{formatPrice(model.priceCacheRead)}</div>

                            <div class={styles.pricingLabel}>Cache Write</div>
                            <div>{formatPrice(model.costCacheWrite)}</div>
                            <div>{formatPrice(model.priceCacheWrite)}</div>
                          </div>
                        </CardBody>
                      </Card>

                      <Divider spacing="sm" />

                      {/* Edit form */}
                      <Heading level={4} size="sm">
                        Edit Model
                      </Heading>
                      <ModelForm
                        initial={{
                          modelId: model.modelId,
                          displayName: model.displayName ?? "",
                          contextLength: model.contextLength,
                          costInput: model.costInput,
                          costOutput: model.costOutput,
                          costCacheRead: model.costCacheRead,
                          costCacheWrite: model.costCacheWrite,
                          priceInput: model.priceInput,
                          priceOutput: model.priceOutput,
                          priceCacheRead: model.priceCacheRead,
                          priceCacheWrite: model.priceCacheWrite,
                          sortOrder: model.sortOrder,
                        }}
                        onSubmit={(data) => handleUpdateModel(model.id, data)}
                        submitLabel="Update Model"
                      />
                    </Stack>
                  )}
                  newItemTitle="Add Model"
                  renderNewForm={() => (
                    <ModelForm
                      onSubmit={handleCreateModel}
                      onCancel={() => modelPanelRef?.clearSelection()}
                      submitLabel="Create Model"
                    />
                  )}
                />
              </Stack>
            </TabPanel>

            {/* ========== SETTINGS TAB ========== */}
            <TabPanel id="settings">
              <Stack direction="vertical" gap="md">
                <Heading level={3} size="base">
                  Provider Settings
                </Heading>
                <Card variant="outlined" padding="md">
                  <CardBody>
                    <ProviderForm
                      initial={{
                        name: prov().name,
                        displayName: prov().displayName,
                        endpointUrl: prov().endpointUrl,
                        protocol: prov().protocol,
                        envKeyName: prov().envKeyName,
                        sortOrder: prov().sortOrder,
                      }}
                      hideName
                      onSubmit={handleUpdateProvider}
                      submitLabel="Update Provider"
                    />
                  </CardBody>
                </Card>
              </Stack>
            </TabPanel>
          </Tabs>
        )}
      </Show>

      {/* Delete model confirmation */}
      <Modal
        open={!!confirmDeleteModel()}
        onClose={() => setConfirmDeleteModel(null)}
        title="Delete Model"
        size="sm"
        footer={
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="ghost" onClick={() => setConfirmDeleteModel(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteModel}>
              Delete
            </Button>
          </Stack>
        }
      >
        <Text>
          Are you sure you want to delete model{" "}
          <strong>
            {confirmDeleteModel()?.displayName ||
              confirmDeleteModel()?.modelId}
          </strong>
          ? This cannot be undone.
        </Text>
      </Modal>

      {/* Discover models modal */}
      <Modal
        open={discoverOpen()}
        onClose={() => setDiscoverOpen(false)}
        title="Discover Models"
        size="lg"
        footer={
          <Stack direction="horizontal" gap="sm" justify="between" align="center">
            <Text size="sm" color="secondary">
              {discoveredModels().filter((m) => m.selected && !m.imported).length} selected
            </Text>
            <Stack direction="horizontal" gap="sm">
              <Button variant="ghost" onClick={() => setDiscoverOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImportSelected}
                disabled={
                  importingModels() ||
                  discoveredModels().filter((m) => m.selected && !m.imported).length === 0
                }
              >
                {importingModels() ? "Importing..." : "Import Selected"}
              </Button>
            </Stack>
          </Stack>
        }
      >
        <Show when={discoverLoading()}>
          <Stack direction="horizontal" justify="center">
            <Spinner size="lg" />
          </Stack>
        </Show>
        <Show when={!discoverLoading() && discoveredModels().length === 0}>
          <Text color="muted">No models found from this provider.</Text>
        </Show>
        <Show when={!discoverLoading() && discoveredModels().length > 0}>
          <Stack direction="vertical" gap="xs">
            <For each={discoveredModels()}>
              {(model) => (
                <div
                  class={styles.discoverRow}
                  onClick={() => !model.imported && toggleDiscoverSelect(model.id)}
                  style={{ opacity: model.imported ? 0.5 : 1, cursor: model.imported ? "default" : "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={model.selected || model.imported}
                    disabled={model.imported}
                    onChange={() => toggleDiscoverSelect(model.id)}
                  />
                  <div class={styles.modelInfo}>
                    <Text weight={model.selected ? "semibold" : "normal"} size="sm">
                      {model.id}
                    </Text>
                    <Show when={model.name || model.owned_by}>
                      <div class={styles.modelMeta}>
                        <Show when={model.name}>
                          <span>{model.name}</span>
                        </Show>
                        <Show when={model.owned_by}>
                          <span>{model.owned_by}</span>
                        </Show>
                      </div>
                    </Show>
                  </div>
                  <Show when={model.imported}>
                    <Badge variant="success" size="sm">
                      Imported
                    </Badge>
                  </Show>
                </div>
              )}
            </For>
          </Stack>
        </Show>
      </Modal>
    </Stack>
  )
}
