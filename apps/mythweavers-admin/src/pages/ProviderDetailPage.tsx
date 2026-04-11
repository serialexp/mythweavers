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
import { createStore, produce } from "solid-js/store"
import {
  getAdminLlmProvidersById,
  getAdminLlmProvidersByProviderIdDiscover,
  putAdminLlmProvidersById,
  postAdminLlmProvidersByProviderIdModels,
  putAdminLlmModelsById,
  deleteAdminLlmModelsById,
} from "../api/config"
import { getApiBaseUrl } from "../api/config"
import { ModelForm, type ModelFormData, type ModelFormStrings, toFormStrings, fromFormStrings, DEFAULT_MARKUP, applyMarkupToNumber } from "../components/ModelForm"
import { ProtocolBadge } from "../components/ProtocolBadge"
import { ProviderForm } from "../components/ProviderForm"
import { StatusDot } from "../components/StatusDot"
import * as styles from "./ProviderDetailPage.css"

type Provider = {
  id: string
  name: string
  displayName: string
  endpointUrl: string
  protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE"
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
  return `$${val.toFixed(4)}`
}

/** Compare two ModelFormData values to check if anything actually changed */
function hasModelChanged(original: Model, edited: ModelFormData): boolean {
  return (
    original.modelId !== edited.modelId ||
    (original.displayName ?? "") !== edited.displayName ||
    original.contextLength !== edited.contextLength ||
    original.costInput !== edited.costInput ||
    original.costOutput !== edited.costOutput ||
    original.costCacheRead !== edited.costCacheRead ||
    original.costCacheWrite !== edited.costCacheWrite ||
    original.priceInput !== edited.priceInput ||
    original.priceOutput !== edited.priceOutput ||
    original.priceCacheRead !== edited.priceCacheRead ||
    original.priceCacheWrite !== edited.priceCacheWrite ||
    original.sortOrder !== edited.sortOrder
  )
}

export function ProviderDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const [detail, { refetch }] = createResource(
    () => params.id,
    async (id) => {
      const res = await getAdminLlmProvidersById({ path: { id } })
      // Clear pending edits when we get fresh data from the server
      setPendingEdits({})
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
  const [saving, setSaving] = createSignal(false)
  const [togglingModelId, setTogglingModelId] = createSignal<string | null>(null)
  const [lookingUpPricing, setLookingUpPricing] = createSignal(false)
  let modelPanelRef: ListDetailPanelRef | undefined

  const provider = () => detail()?.provider
  const models = () => detail()?.models ?? []

  // --- Pending edits store ---
  // Keyed by model ID, stores string form values for models being edited.
  // The ModelForm reads/writes directly to its slice — no prop drilling needed.
  const [pendingEdits, setPendingEdits] = createStore<Record<string, ModelFormStrings>>({})

  /** Ensure a store entry exists for a model, initializing from server data if needed */
  const ensureFormStore = (model: Model) => {
    if (!pendingEdits[model.id]) {
      setPendingEdits(
        produce((edits) => {
          edits[model.id] = toFormStrings({
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
          })
        }),
      )
    }
  }

  const pendingEditCount = () => {
    const edits = pendingEdits
    const currentModels = models()
    let count = 0
    for (const modelId of Object.keys(edits)) {
      const original = currentModels.find((m) => m.id === modelId)
      if (original && hasModelChanged(original, fromFormStrings(edits[modelId]))) {
        count++
      }
    }
    return count
  }

  const isModelDirty = (modelId: string): boolean => {
    const edited = pendingEdits[modelId]
    if (!edited) return false
    const original = models().find((m) => m.id === modelId)
    if (!original) return false
    return hasModelChanged(original, fromFormStrings(edited))
  }

  const handleSaveAll = async () => {
    const edits = pendingEdits
    const currentModels = models()
    const toSave: Array<{ id: string; data: ModelFormData }> = []

    for (const modelId of Object.keys(edits)) {
      const original = currentModels.find((m) => m.id === modelId)
      const data = fromFormStrings(edits[modelId])
      if (original && hasModelChanged(original, data)) {
        toSave.push({ id: modelId, data })
      }
    }

    if (toSave.length === 0) return

    setSaving(true)
    setError("")
    try {
      await Promise.all(
        toSave.map(({ id, data }) =>
          putAdminLlmModelsById({
            path: { id },
            body: {
              ...data,
              displayName: data.displayName || undefined,
              contextLength: data.contextLength ?? undefined,
              costCacheRead: data.costCacheRead,
              costCacheWrite: data.costCacheWrite,
              priceCacheRead: data.priceCacheRead,
              priceCacheWrite: data.priceCacheWrite,
            },
          }),
        ),
      )
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save model changes")
    } finally {
      setSaving(false)
    }
  }

  // --- Pricing lookup ---

  const handleLookupPricing = async () => {
    const currentModels = models()
    const prov = provider()
    if (currentModels.length === 0 || !prov) return

    setLookingUpPricing(true)
    setError("")
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/llm/models/lookup-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          modelIds: currentModels.map((m) => m.modelId),
          providerName: prov.displayName,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const data = (await res.json()) as {
        results: Array<{
          modelId: string
          costInput: number | null
          costOutput: number | null
          costCacheRead: number | null
          costCacheWrite: number | null
          contextLength: number | null
          source: string | null
        }>
      }

      // Map results back to our models and populate pending edits store
      for (const result of data.results) {
        const model = currentModels.find((m) => m.modelId === result.modelId)
        if (!model) continue

        // Ensure a store entry exists so we can update individual fields
        ensureFormStore(model)

        // Update cost fields from the lookup + derive prices with default markup
        const markup = DEFAULT_MARKUP
        setPendingEdits(model.id, (prev: ModelFormStrings) => ({
          ...prev,
          ...(result.costInput != null ? {
            costInput: String(result.costInput),
            priceInput: String(applyMarkupToNumber(result.costInput, markup)),
          } : {}),
          ...(result.costOutput != null ? {
            costOutput: String(result.costOutput),
            priceOutput: String(applyMarkupToNumber(result.costOutput, markup)),
          } : {}),
          ...(result.costCacheRead != null ? {
            costCacheRead: String(result.costCacheRead),
            priceCacheRead: String(applyMarkupToNumber(result.costCacheRead, markup)),
          } : {}),
          ...(result.costCacheWrite != null ? {
            costCacheWrite: String(result.costCacheWrite),
            priceCacheWrite: String(applyMarkupToNumber(result.costCacheWrite, markup)),
          } : {}),
          ...(result.contextLength != null ? { contextLength: String(result.contextLength) } : {}),
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to look up pricing")
    } finally {
      setLookingUpPricing(false)
    }
  }

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
    protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE"
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
      setTogglingModelId(model.id)
      await putAdminLlmModelsById({
        path: { id: model.id },
        body: { enabled: !model.enabled },
      })
      refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle model")
    } finally {
      setTogglingModelId(null)
    }
  }

  const handleCreateModel = async (data: ModelFormData) => {
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

      <Show when={detail.loading && !detail()}>
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
                <Card variant="outlined" padding="md">
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

                {/* Models header with save button */}
                <Stack
                  direction="horizontal"
                  justify="between"
                  align="center"
                >
                  <Stack direction="horizontal" gap="md" align="center">
                    <Heading level={3} size="base">
                      Models
                    </Heading>
                    <Show when={pendingEditCount() > 0}>
                      <Badge variant="warning" size="sm">
                        {pendingEditCount()} unsaved
                      </Badge>
                    </Show>
                  </Stack>
                  <Stack direction="horizontal" gap="sm">
                    <Show when={pendingEditCount() > 0}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveAll}
                        disabled={saving()}
                      >
                        {saving()
                          ? "Saving..."
                          : `Save ${pendingEditCount()} Change${pendingEditCount() === 1 ? "" : "s"}`}
                      </Button>
                    </Show>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLookupPricing}
                      disabled={lookingUpPricing() || models().length === 0}
                    >
                      {lookingUpPricing()
                        ? `Looking up ${models().length}...`
                        : `Lookup Pricing (${models().length})`}
                    </Button>
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
                      <Show when={isModelDirty(model.id)}>
                        <div
                          class={styles.unsavedDot}
                          title="Unsaved changes"
                        />
                      </Show>
                    </div>
                  )}
                  detailTitle={(m) => m.displayName || m.modelId}
                  renderDetail={(model) => (
                    <Stack direction="vertical" gap="md">
                      {/* Quick actions */}
                      <Stack direction="horizontal" gap="sm" align="center">
                        <Button
                          variant={model.enabled ? "outline" : "primary"}
                          size="sm"
                          onClick={() => handleToggleModel(model)}
                          disabled={togglingModelId() === model.id}
                        >
                          {togglingModelId() === model.id
                            ? (model.enabled ? "Disabling..." : "Enabling...")
                            : (model.enabled ? "Disable" : "Enable")}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setConfirmDeleteModel(model)}
                        >
                          Delete
                        </Button>
                        <Show when={togglingModelId() === model.id}>
                          <Spinner size="sm" />
                        </Show>
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
                      <Stack direction="horizontal" gap="sm" align="center">
                        <Heading level={4} size="sm">
                          Edit Model
                        </Heading>
                        <Show when={isModelDirty(model.id)}>
                          <Badge variant="warning" size="sm">
                            unsaved
                          </Badge>
                        </Show>
                      </Stack>
                      <Card variant="outlined" padding="md">
                        <CardBody>
                          {(() => {
                            ensureFormStore(model)
                            return (
                              <ModelForm
                                values={pendingEdits[model.id]!}
                                setValues={(...args: any[]) =>
                                  (setPendingEdits as any)(model.id, ...args)
                                }
                              />
                            )
                          })()}
                        </CardBody>
                      </Card>
                    </Stack>
                  )}
                  newItemTitle="Add Model"
                  renderNewForm={() => {
                    const [newModel, setNewModel] = createStore(toFormStrings({}))
                    return (
                      <Card variant="outlined" padding="md">
                        <CardBody>
                          <ModelForm
                            values={newModel}
                            setValues={setNewModel}
                            onSubmit={handleCreateModel}
                            onCancel={() => modelPanelRef?.clearSelection()}
                            submitLabel="Create Model"
                          />
                        </CardBody>
                      </Card>
                    )
                  }}
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
