import { Button, FormField, Input, Select, Stack } from "@mythweavers/ui"
import { createSignal, Show } from "solid-js"

interface ProviderFormProps {
  initial?: {
    name?: string
    displayName?: string
    endpointUrl?: string
    protocol?: "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE"
    envKeyName?: string
    sortOrder?: number
  }
  /** Hide the name field (not editable after creation) */
  hideName?: boolean
  onSubmit: (data: {
    name: string
    displayName: string
    endpointUrl: string
    protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE"
    envKeyName: string
    sortOrder: number
  }) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}

export function ProviderForm(props: ProviderFormProps) {
  const [name, setName] = createSignal(props.initial?.name ?? "")
  const [displayName, setDisplayName] = createSignal(
    props.initial?.displayName ?? "",
  )
  const [endpointUrl, setEndpointUrl] = createSignal(
    props.initial?.endpointUrl ?? "",
  )
  const [protocol, setProtocol] = createSignal<
    "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE"
  >(props.initial?.protocol ?? "OPENAI_COMPATIBLE")
  const [envKeyName, setEnvKeyName] = createSignal(
    props.initial?.envKeyName ?? "",
  )
  // Track whether the user has manually edited the env key field.
  // If not, we auto-derive it from the slug.
  const [envKeyTouched, setEnvKeyTouched] = createSignal(
    !!(props.initial?.envKeyName),
  )

  const deriveEnvKey = (slug: string) =>
    `LLM_PROVIDER_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`
  const [sortOrder, setSortOrder] = createSignal(
    props.initial?.sortOrder ?? 0,
  )
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal("")

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await props.onSubmit({
        name: name(),
        displayName: displayName(),
        endpointUrl: endpointUrl(),
        protocol: protocol(),
        envKeyName: envKeyName(),
        sortOrder: sortOrder(),
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
        <Show when={!props.hideName}>
          <FormField
            label="Name (slug)"
            required
            hint='Unique identifier, e.g. "moonshot"'
          >
            <Input
              value={name()}
              onInput={(e) => {
                const slug = e.currentTarget.value
                setName(slug)
                if (!envKeyTouched()) {
                  setEnvKeyName(slug ? deriveEnvKey(slug) : "")
                }
              }}
              placeholder="moonshot"
              required
            />
          </FormField>
        </Show>

        <FormField label="Display Name" required>
          <Input
            value={displayName()}
            onInput={(e) => setDisplayName(e.currentTarget.value)}
            placeholder="Moonshot AI"
            required
          />
        </FormField>

        <FormField label="Endpoint URL" required>
          <Input
            value={endpointUrl()}
            onInput={(e) => setEndpointUrl(e.currentTarget.value)}
            placeholder="https://api.moonshot.cn"
            required
          />
        </FormField>

        <FormField label="Protocol" required>
          <Select
            value={protocol()}
            onChange={(e) =>
              setProtocol(
                e.currentTarget.value as "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE",
              )
            }
            options={[
              { value: "OPENAI_COMPATIBLE", label: "OpenAI Compatible" },
              { value: "ANTHROPIC", label: "Anthropic" },
              { value: "CLOUDFLARE", label: "Cloudflare Workers AI" },
            ]}
          />
        </FormField>

        <FormField
          label="Env Key Name"
          required
          hint="Set this environment variable on the server to configure the API key. The key value is never stored in the database."
        >
          <Input
            value={envKeyName()}
            onInput={(e) => {
              setEnvKeyName(e.currentTarget.value)
              setEnvKeyTouched(true)
            }}
            placeholder="LLM_PROVIDER_MOONSHOT_API_KEY"
            required
          />
        </FormField>

        <FormField label="Sort Order" hint="Lower numbers sort first.">
          <Input
            type="number"
            value={sortOrder()}
            onInput={(e) =>
              setSortOrder(Number.parseInt(e.currentTarget.value) || 0)
            }
          />
        </FormField>

        <Show when={error()}>
          <div style={{ color: "var(--color-semantic-error, #e53e3e)" }}>
            {error()}
          </div>
        </Show>

        <Stack direction="horizontal" gap="sm" justify="end">
          <Show when={props.onCancel}>
            <Button
              variant="ghost"
              onClick={props.onCancel}
              type="button"
            >
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
