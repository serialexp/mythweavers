import { Button, FormField, Input, Stack, Text, Divider } from "@mythweavers/ui"
import { createSignal, Show } from "solid-js"

interface ModelFormData {
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
}

interface ModelFormProps {
  initial?: Partial<ModelFormData>
  onSubmit: (data: ModelFormData) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}

function numOrNull(v: string): number | null {
  if (v === "") return null
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? null : n
}

export function ModelForm(props: ModelFormProps) {
  const [modelId, setModelId] = createSignal(props.initial?.modelId ?? "")
  const [displayName, setDisplayName] = createSignal(
    props.initial?.displayName ?? "",
  )
  const [contextLength, setContextLength] = createSignal<string>(
    props.initial?.contextLength != null
      ? String(props.initial.contextLength)
      : "",
  )
  const [costInput, setCostInput] = createSignal(
    String(props.initial?.costInput ?? 0),
  )
  const [costOutput, setCostOutput] = createSignal(
    String(props.initial?.costOutput ?? 0),
  )
  const [costCacheRead, setCostCacheRead] = createSignal(
    props.initial?.costCacheRead != null
      ? String(props.initial.costCacheRead)
      : "",
  )
  const [costCacheWrite, setCostCacheWrite] = createSignal(
    props.initial?.costCacheWrite != null
      ? String(props.initial.costCacheWrite)
      : "",
  )
  const [priceInput, setPriceInput] = createSignal(
    String(props.initial?.priceInput ?? 0),
  )
  const [priceOutput, setPriceOutput] = createSignal(
    String(props.initial?.priceOutput ?? 0),
  )
  const [priceCacheRead, setPriceCacheRead] = createSignal(
    props.initial?.priceCacheRead != null
      ? String(props.initial.priceCacheRead)
      : "",
  )
  const [priceCacheWrite, setPriceCacheWrite] = createSignal(
    props.initial?.priceCacheWrite != null
      ? String(props.initial.priceCacheWrite)
      : "",
  )
  const [sortOrder, setSortOrder] = createSignal(
    String(props.initial?.sortOrder ?? 0),
  )
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal("")

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await props.onSubmit({
        modelId: modelId(),
        displayName: displayName(),
        contextLength: numOrNull(contextLength()),
        costInput: Number.parseFloat(costInput()) || 0,
        costOutput: Number.parseFloat(costOutput()) || 0,
        costCacheRead: numOrNull(costCacheRead()),
        costCacheWrite: numOrNull(costCacheWrite()),
        priceInput: Number.parseFloat(priceInput()) || 0,
        priceOutput: Number.parseFloat(priceOutput()) || 0,
        priceCacheRead: numOrNull(priceCacheRead()),
        priceCacheWrite: numOrNull(priceCacheWrite()),
        sortOrder: Number.parseInt(sortOrder()) || 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack direction="vertical" gap="md">
        <FormField
          label="Model ID"
          required
          hint="Actual model identifier sent to the API"
        >
          <Input
            value={modelId()}
            onInput={(e) => setModelId(e.currentTarget.value)}
            placeholder="claude-sonnet-4-20250514"
            required
          />
        </FormField>

        <FormField label="Display Name" showOptional>
          <Input
            value={displayName()}
            onInput={(e) => setDisplayName(e.currentTarget.value)}
            placeholder="Claude Sonnet 4"
          />
        </FormField>

        <FormField label="Context Length (tokens)" showOptional>
          <Input
            type="number"
            value={contextLength()}
            onInput={(e) => setContextLength(e.currentTarget.value)}
            placeholder="200000"
          />
        </FormField>

        <FormField label="Sort Order" hint="Lower numbers sort first.">
          <Input
            type="number"
            value={sortOrder()}
            onInput={(e) => setSortOrder(e.currentTarget.value)}
          />
        </FormField>

        <Divider spacing="sm" />
        <Text size="sm" color="secondary" weight="semibold">
          Cost (what we pay upstream, per million tokens)
        </Text>

        <Stack direction="horizontal" gap="md" wrap>
          <FormField label="Input">
            <Input
              type="number"
              value={costInput()}
              onInput={(e) => setCostInput(e.currentTarget.value)}
              step="0.01"
            />
          </FormField>
          <FormField label="Output">
            <Input
              type="number"
              value={costOutput()}
              onInput={(e) => setCostOutput(e.currentTarget.value)}
              step="0.01"
            />
          </FormField>
          <FormField label="Cache Read" showOptional>
            <Input
              type="number"
              value={costCacheRead()}
              onInput={(e) => setCostCacheRead(e.currentTarget.value)}
              step="0.01"
              placeholder="—"
            />
          </FormField>
          <FormField label="Cache Write" showOptional>
            <Input
              type="number"
              value={costCacheWrite()}
              onInput={(e) => setCostCacheWrite(e.currentTarget.value)}
              step="0.01"
              placeholder="—"
            />
          </FormField>
        </Stack>

        <Divider spacing="sm" />
        <Text size="sm" color="secondary" weight="semibold">
          Price (what we charge users, per million tokens)
        </Text>

        <Stack direction="horizontal" gap="md" wrap>
          <FormField label="Input">
            <Input
              type="number"
              value={priceInput()}
              onInput={(e) => setPriceInput(e.currentTarget.value)}
              step="0.01"
            />
          </FormField>
          <FormField label="Output">
            <Input
              type="number"
              value={priceOutput()}
              onInput={(e) => setPriceOutput(e.currentTarget.value)}
              step="0.01"
            />
          </FormField>
          <FormField label="Cache Read" showOptional>
            <Input
              type="number"
              value={priceCacheRead()}
              onInput={(e) => setPriceCacheRead(e.currentTarget.value)}
              step="0.01"
              placeholder="—"
            />
          </FormField>
          <FormField label="Cache Write" showOptional>
            <Input
              type="number"
              value={priceCacheWrite()}
              onInput={(e) => setPriceCacheWrite(e.currentTarget.value)}
              step="0.01"
              placeholder="—"
            />
          </FormField>
        </Stack>

        <Show when={error()}>
          <div style={{ color: "var(--color-semantic-error, #e53e3e)" }}>
            {error()}
          </div>
        </Show>

        <Stack direction="horizontal" gap="sm" justify="end">
          <Show when={props.onCancel}>
            <Button variant="ghost" onClick={props.onCancel} type="button">
              Cancel
            </Button>
          </Show>
          <Button variant="primary" type="submit" disabled={submitting()}>
            {submitting()
              ? "Saving..."
              : (props.submitLabel ?? "Save")}
          </Button>
        </Stack>
      </Stack>
    </form>
  )
}
