import { Button, FormField, Input, Stack, Text, Divider } from "@mythweavers/ui"
import { createSignal, Show } from "solid-js"
import type { SetStoreFunction } from "solid-js/store"

export interface ModelFormData {
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

/** String representation of form fields for use in inputs */
export interface ModelFormStrings {
  modelId: string
  displayName: string
  contextLength: string
  costInput: string
  costOutput: string
  costCacheRead: string
  costCacheWrite: string
  priceInput: string
  priceOutput: string
  priceCacheRead: string
  priceCacheWrite: string
  sortOrder: string
}

interface ModelFormProps {
  /** Store slice for this model's data — the form reads and writes directly */
  values: ModelFormStrings
  setValues: SetStoreFunction<ModelFormStrings>
  /** Called on explicit submit (e.g. "Create Model") */
  onSubmit?: (data: ModelFormData) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}

function numOrNull(v: string): number | null {
  if (v === "") return null
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? null : n
}

/** Round to 4 decimal places */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function applyMarkup(costStr: string, markupPct: number): string {
  const cost = Number.parseFloat(costStr)
  if (Number.isNaN(cost) || cost === 0) return costStr
  return String(round4(cost * (1 + markupPct / 100)))
}

function applyMarkupNullable(costStr: string, markupPct: number): string {
  if (costStr === "") return ""
  return applyMarkup(costStr, markupPct)
}

function isPriceTouched(
  costStr: string,
  priceStr: string,
  defaultMarkup: number,
): boolean {
  const cost = Number.parseFloat(costStr)
  const price = Number.parseFloat(priceStr)
  if (Number.isNaN(cost) && Number.isNaN(price)) return false
  if (Number.isNaN(cost) || Number.isNaN(price)) return true
  if (cost === 0 && price === 0) return false
  const expected = round4(cost * (1 + defaultMarkup / 100))
  return Math.abs(price - expected) > 0.00005
}

export const DEFAULT_MARKUP = 5

/** Apply markup to a numeric cost, returning the marked-up value */
export function applyMarkupToNumber(cost: number | null, markupPct: number): number | null {
  if (cost == null || cost === 0) return cost
  return round4(cost * (1 + markupPct / 100))
}

/** Convert ModelFormData to the string representation used by inputs */
export function toFormStrings(data: Partial<ModelFormData>): ModelFormStrings {
  return {
    modelId: data.modelId ?? "",
    displayName: data.displayName ?? "",
    contextLength: data.contextLength != null ? String(data.contextLength) : "",
    costInput: String(data.costInput ?? 0),
    costOutput: String(data.costOutput ?? 0),
    costCacheRead: data.costCacheRead != null ? String(data.costCacheRead) : "",
    costCacheWrite: data.costCacheWrite != null ? String(data.costCacheWrite) : "",
    priceInput: String(data.priceInput ?? 0),
    priceOutput: String(data.priceOutput ?? 0),
    priceCacheRead: data.priceCacheRead != null ? String(data.priceCacheRead) : "",
    priceCacheWrite: data.priceCacheWrite != null ? String(data.priceCacheWrite) : "",
    sortOrder: String(data.sortOrder ?? 0),
  }
}

/** Convert string form values back to typed ModelFormData */
export function fromFormStrings(s: ModelFormStrings): ModelFormData {
  return {
    modelId: s.modelId,
    displayName: s.displayName,
    contextLength: numOrNull(s.contextLength),
    costInput: Number.parseFloat(s.costInput) || 0,
    costOutput: Number.parseFloat(s.costOutput) || 0,
    costCacheRead: numOrNull(s.costCacheRead),
    costCacheWrite: numOrNull(s.costCacheWrite),
    priceInput: Number.parseFloat(s.priceInput) || 0,
    priceOutput: Number.parseFloat(s.priceOutput) || 0,
    priceCacheRead: numOrNull(s.priceCacheRead),
    priceCacheWrite: numOrNull(s.priceCacheWrite),
    sortOrder: Number.parseInt(s.sortOrder) || 0,
  }
}

export function ModelForm(props: ModelFormProps) {
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal("")

  // --- Markup state ---
  const [markupPct, setMarkupPct] = createSignal(DEFAULT_MARKUP)

  // Track which price fields the user has manually edited
  const [priceInputTouched, setPriceInputTouched] = createSignal(
    isPriceTouched(props.values.costInput, props.values.priceInput, DEFAULT_MARKUP),
  )
  const [priceOutputTouched, setPriceOutputTouched] = createSignal(
    isPriceTouched(props.values.costOutput, props.values.priceOutput, DEFAULT_MARKUP),
  )
  const [priceCacheReadTouched, setPriceCacheReadTouched] = createSignal(
    isPriceTouched(props.values.costCacheRead, props.values.priceCacheRead, DEFAULT_MARKUP),
  )
  const [priceCacheWriteTouched, setPriceCacheWriteTouched] = createSignal(
    isPriceTouched(props.values.costCacheWrite, props.values.priceCacheWrite, DEFAULT_MARKUP),
  )

  /** Recalculate ALL price fields — used when the markup % changes explicitly */
  const recalcAllPrices = (markup: number) => {
    props.setValues("priceInput", applyMarkup(props.values.costInput, markup))
    props.setValues("priceOutput", applyMarkup(props.values.costOutput, markup))
    props.setValues("priceCacheRead", applyMarkupNullable(props.values.costCacheRead, markup))
    props.setValues("priceCacheWrite", applyMarkupNullable(props.values.costCacheWrite, markup))
    // Reset touched state — user is explicitly asking for markup-based pricing
    setPriceInputTouched(false)
    setPriceOutputTouched(false)
    setPriceCacheReadTouched(false)
    setPriceCacheWriteTouched(false)
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!props.onSubmit) return
    setError("")
    setSubmitting(true)
    try {
      await props.onSubmit(fromFormStrings(props.values))
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
            value={props.values.modelId}
            onInput={(e) => props.setValues("modelId", e.currentTarget.value)}
            placeholder="claude-sonnet-4-20250514"
            required
          />
        </FormField>

        <FormField label="Display Name" showOptional>
          <Input
            value={props.values.displayName}
            onInput={(e) => props.setValues("displayName", e.currentTarget.value)}
            placeholder="Claude Sonnet 4"
          />
        </FormField>

        <FormField label="Context Length (tokens)" showOptional>
          <Input
            type="number"
            value={props.values.contextLength}
            onInput={(e) => props.setValues("contextLength", e.currentTarget.value)}
            placeholder="200000"
          />
        </FormField>

        <FormField label="Sort Order" hint="Lower numbers sort first.">
          <Input
            type="number"
            value={props.values.sortOrder}
            onInput={(e) => props.setValues("sortOrder", e.currentTarget.value)}
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
              value={props.values.costInput}
              onInput={(e) => {
                props.setValues("costInput", e.currentTarget.value)
                if (!priceInputTouched()) {
                  props.setValues("priceInput", applyMarkup(e.currentTarget.value, markupPct()))
                }
              }}
              step="0.0001"
            />
          </FormField>
          <FormField label="Output">
            <Input
              type="number"
              value={props.values.costOutput}
              onInput={(e) => {
                props.setValues("costOutput", e.currentTarget.value)
                if (!priceOutputTouched()) {
                  props.setValues("priceOutput", applyMarkup(e.currentTarget.value, markupPct()))
                }
              }}
              step="0.0001"
            />
          </FormField>
          <FormField label="Cache Read" showOptional>
            <Input
              type="number"
              value={props.values.costCacheRead}
              onInput={(e) => {
                props.setValues("costCacheRead", e.currentTarget.value)
                if (!priceCacheReadTouched()) {
                  props.setValues("priceCacheRead", applyMarkupNullable(e.currentTarget.value, markupPct()))
                }
              }}
              step="0.0001"
              placeholder="—"
            />
          </FormField>
          <FormField label="Cache Write" showOptional>
            <Input
              type="number"
              value={props.values.costCacheWrite}
              onInput={(e) => {
                props.setValues("costCacheWrite", e.currentTarget.value)
                if (!priceCacheWriteTouched()) {
                  props.setValues("priceCacheWrite", applyMarkupNullable(e.currentTarget.value, markupPct()))
                }
              }}
              step="0.0001"
              placeholder="—"
            />
          </FormField>
        </Stack>

        <Divider spacing="sm" />
        <Stack direction="horizontal" gap="md" align="center" justify="between">
          <Text size="sm" color="secondary" weight="semibold">
            Price (what we charge users, per million tokens)
          </Text>
          <Stack direction="horizontal" gap="sm" align="center">
            <Text size="xs" color="muted">
              Markup
            </Text>
            <Input
              type="number"
              value={markupPct()}
              onInput={(e) => {
                const pct = Number.parseFloat(e.currentTarget.value)
                if (!Number.isNaN(pct)) {
                  setMarkupPct(pct)
                  recalcAllPrices(pct)
                }
              }}
              step="1"
              style={{ width: "70px" }}
            />
            <Text size="xs" color="muted">
              %
            </Text>
          </Stack>
        </Stack>

        <Stack direction="horizontal" gap="md" wrap>
          <FormField label="Input">
            <Input
              type="number"
              value={props.values.priceInput}
              onInput={(e) => {
                props.setValues("priceInput", e.currentTarget.value)
                setPriceInputTouched(true)
              }}
              step="0.0001"
            />
          </FormField>
          <FormField label="Output">
            <Input
              type="number"
              value={props.values.priceOutput}
              onInput={(e) => {
                props.setValues("priceOutput", e.currentTarget.value)
                setPriceOutputTouched(true)
              }}
              step="0.0001"
            />
          </FormField>
          <FormField label="Cache Read" showOptional>
            <Input
              type="number"
              value={props.values.priceCacheRead}
              onInput={(e) => {
                props.setValues("priceCacheRead", e.currentTarget.value)
                setPriceCacheReadTouched(true)
              }}
              step="0.0001"
              placeholder="—"
            />
          </FormField>
          <FormField label="Cache Write" showOptional>
            <Input
              type="number"
              value={props.values.priceCacheWrite}
              onInput={(e) => {
                props.setValues("priceCacheWrite", e.currentTarget.value)
                setPriceCacheWriteTouched(true)
              }}
              step="0.0001"
              placeholder="—"
            />
          </FormField>
        </Stack>

        <Show when={error()}>
          <div style={{ color: "var(--color-semantic-error, #e53e3e)" }}>
            {error()}
          </div>
        </Show>

        <Show when={props.onSubmit}>
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
        </Show>
      </Stack>
    </form>
  )
}
