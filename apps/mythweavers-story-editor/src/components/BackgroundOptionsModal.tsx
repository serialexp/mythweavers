import { Button, Modal } from '@mythweavers/ui'
import {
  Component,
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
} from 'solid-js'
import {
  getMyImagesModels,
  postMyImagesGenerate,
} from '../client/config'
import { saveService } from '../services/saveService'
import { currentStoryStore } from '../stores/currentStoryStore'
import { resolveStoryImageUrl } from '../utils/uploadStoryImage'
import * as styles from './BackgroundOptionsModal.css'
import { FilePicker } from './FilePicker'

export type BackgroundTargetLevel = 'story' | 'book' | 'arc' | 'chapter' | 'scene'

export interface BackgroundTarget {
  level: BackgroundTargetLevel
  entityId: string
  /** Pre-fill: current default file id on the entity, if any. */
  initialFileId: string | null
  /** Pre-fill: resolved URL path for the current default file, if any. */
  initialUrl: string | null
  /** Display label, e.g. "Chapter 3" or the node title. */
  displayName?: string
}

interface BackgroundOptionsModalProps {
  isOpen: boolean
  target: BackgroundTarget | null
  onClose: () => void
}

type SourceTab = 'library' | 'generate'

// Default 16:9 size for backgrounds — clamped to model maxWidth/maxHeight
// server-side. Cloudflare Schnell will produce 1024-class output here.
const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 720

type ImageModel = NonNullable<
  Awaited<ReturnType<typeof getMyImagesModels>>['data']
>['models'][number]

/**
 * Generic modal for setting / clearing the default background image at any
 * node level (story, book, arc, chapter, scene). Only nodes that have an
 * explicit default fire a background change in the reader; everything else
 * inherits via narrative position.
 *
 * Source tabs:
 *   - "Library" — pick / upload via FilePicker (POST /my/files multipart).
 *   - "Generate" — prompt + model select, calls POST /my/images/generate
 *     which produces a regular File row owned by the user.
 *
 * Either path lands a file id in `setFileId()`; the existing Save button is
 * unchanged — it patches `defaultBackgroundFileId` via saveService.
 */
export const BackgroundOptionsModal: Component<BackgroundOptionsModalProps> = (props) => {
  const [fileId, setFileId] = createSignal<string | null>(null)
  const [url, setUrl] = createSignal<string | null>(null)
  const [isSaving, setIsSaving] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  // Source tab + generate state.
  const [sourceTab, setSourceTab] = createSignal<SourceTab>('library')
  const [prompt, setPrompt] = createSignal('')
  const [selectedModel, setSelectedModel] = createSignal<string>('')
  const [isGenerating, setIsGenerating] = createSignal(false)

  // Lazy-load model catalog when the modal opens. Re-fetches on each fresh
  // open in case the admin enables a new model mid-session.
  const [modelsResource, { refetch: refetchModels }] = createResource<ImageModel[]>(
    async () => {
      const { data, error: err } = await getMyImagesModels()
      if (err || !data) {
        throw new Error(
          (err as { error?: string } | null)?.error ?? 'Failed to load image models',
        )
      }
      return data.models
    },
  )

  // Seed form from the target whenever we reopen / switch targets.
  createEffect(
    on(
      () => [props.isOpen, props.target?.entityId, props.target?.level] as const,
      ([isOpen]) => {
        if (isOpen && props.target) {
          setFileId(props.target.initialFileId ?? null)
          setUrl(props.target.initialUrl ?? null)
          setError(null)
          setIsSaving(false)
          setSourceTab('library')
          setPrompt('')
          setIsGenerating(false)
          // Trigger lazy load (no-op if already cached).
          void refetchModels()
        }
      },
    ),
  )

  // Default-select the first available model once models load.
  createEffect(() => {
    const models = modelsResource()
    if (!models || models.length === 0) return
    if (!selectedModel() || !models.some((m) => m.name === selectedModel())) {
      setSelectedModel(models[0].name)
    }
  })

  const titleSuffix = () => {
    const t = props.target
    if (!t) return ''
    const levelLabel = t.level.charAt(0).toUpperCase() + t.level.slice(1)
    return t.displayName ? `${levelLabel}: ${t.displayName}` : levelLabel
  }

  const handlePicked = (file: { id: string; path: string }) => {
    setFileId(file.id)
    setUrl(file.path)
  }

  const handleRemove = () => {
    setFileId(null)
    setUrl(null)
  }

  const currentModel = createMemo(() => {
    const models = modelsResource() ?? []
    return models.find((m) => m.name === selectedModel()) ?? null
  })

  // Cost estimate at our current default size. Mirrors backend computeCost().
  const costEstimate = createMemo<string | null>(() => {
    const model = currentModel()
    if (!model) return null
    const width = DEFAULT_WIDTH
    const height = DEFAULT_HEIGHT
    const steps = model.defaultSteps ?? 4
    const p = model.pricing
    switch (model.pricingMode) {
      case 'FLAT_PER_IMAGE':
        return p.priceFlat != null ? `~$${p.priceFlat.toFixed(4)}` : null
      case 'PER_MP_TIERED': {
        if (p.priceFirstMP == null || p.priceSubsequentMP == null) return null
        const mp = (width * height) / 1_000_000
        const first = Math.min(mp, 1)
        const rest = Math.max(0, mp - 1)
        const cost = first * p.priceFirstMP + rest * p.priceSubsequentMP
        return `~$${cost.toFixed(4)}`
      }
      case 'PER_TILE_STEP': {
        if (p.pricePerTileStep == null) return null
        const tiles = Math.ceil(width / 512) * Math.ceil(height / 512)
        const cost = tiles * steps * p.pricePerTileStep
        return `~$${cost.toFixed(4)}`
      }
    }
  })

  const handleGenerate = async () => {
    const target = props.target
    if (!target) return
    const storyId = currentStoryStore.id
    if (!storyId) {
      setError('No story is currently loaded')
      return
    }
    const trimmedPrompt = prompt().trim()
    if (!trimmedPrompt) {
      setError('Enter a prompt to generate an image')
      return
    }
    const model = selectedModel()
    if (!model) {
      setError('Select an image model')
      return
    }

    setIsGenerating(true)
    setError(null)
    try {
      const { data, error: err } = await postMyImagesGenerate({
        body: {
          storyId,
          model,
          prompt: trimmedPrompt,
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
        },
      })
      if (err || !data) {
        const message =
          (err as { error?: string } | null)?.error ?? 'Image generation failed'
        throw new Error(message)
      }
      // Slot the freshly generated file into the form. The existing Save
      // button will patch defaultBackgroundFileId via saveService below.
      setFileId(data.fileId)
      setUrl(data.path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    const target = props.target
    if (!target) return
    const storyId = currentStoryStore.id
    if (!storyId) {
      setError('No story is currently loaded')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const fid = fileId()
      switch (target.level) {
        case 'story':
          await saveService.saveStoryBackground(storyId, fid)
          break
        case 'book':
          await saveService.saveBookBackground(storyId, target.entityId, fid)
          break
        case 'arc':
          await saveService.saveArcBackground(storyId, target.entityId, fid)
          break
        case 'chapter':
          await saveService.saveChapterBackground(storyId, target.entityId, fid)
          break
        case 'scene':
          await saveService.saveSceneBackground(storyId, target.entityId, fid)
          break
      }
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save background')
    } finally {
      setIsSaving(false)
    }
  }

  const displayUrl = () => resolveStoryImageUrl(url())
  const busy = () => isSaving() || isGenerating()

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title={`Default Background — ${titleSuffix()}`}
      size="md"
      footer={
        <div class={styles.actions}>
          <Button variant="secondary" onClick={props.onClose} disabled={busy()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy()}>
            {isSaving() ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div class={styles.modalContent}>
        <Show when={error()}>
          <div class={styles.errorBox}>{error()}</div>
        </Show>

        <div class={styles.formSection}>
          <span class={styles.help}>
            This background will be used at the start of this {props.target?.level ?? 'node'} in the
            reader. Inline background overrides inside this {props.target?.level ?? 'node'}'s
            descendants will persist until the next node that sets its own default.
          </span>
        </div>

        <div class={styles.formSection}>
          <label class={styles.label}>Current selection</label>
          <div class={styles.previewRow}>
            <div class={styles.preview}>
              <Show when={displayUrl()} fallback={<span>No background</span>}>
                <img class={styles.previewImage} src={displayUrl()!} alt="Background" />
              </Show>
            </div>
            <div class={styles.actionsCol}>
              <Show
                when={fileId()}
                fallback={
                  <div class={styles.help}>
                    Pick an image from your library, upload one, or generate from a prompt below.
                    Recommended aspect ratio 16:9.
                  </div>
                }
              >
                <Button variant="secondary" onClick={handleRemove} disabled={busy()}>
                  Clear Background
                </Button>
                <div class={styles.help}>
                  This will be cleared if you press Save without picking another image.
                </div>
              </Show>
            </div>
          </div>
        </div>

        <div class={styles.formSection}>
          <div class={styles.tabRow} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={sourceTab() === 'library'}
              class={`${styles.tab} ${sourceTab() === 'library' ? styles.tabActive : ''}`}
              onClick={() => setSourceTab('library')}
              disabled={busy()}
            >
              Library / Upload
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sourceTab() === 'generate'}
              class={`${styles.tab} ${sourceTab() === 'generate' ? styles.tabActive : ''}`}
              onClick={() => setSourceTab('generate')}
              disabled={busy()}
            >
              Generate with AI
            </button>
          </div>

          <Show when={sourceTab() === 'library'}>
            <FilePicker
              selectedFileId={fileId()}
              onSelect={handlePicked}
              onUpload={handlePicked}
              mimePrefix="image/"
              disabled={busy()}
            />
          </Show>

          <Show when={sourceTab() === 'generate'}>
            <div class={styles.generatePanel}>
              <Show
                when={!modelsResource.loading && (modelsResource() ?? []).length > 0}
                fallback={
                  <div class={styles.help}>
                    <Show when={modelsResource.loading} fallback="No image models are configured.">
                      Loading available models…
                    </Show>
                  </div>
                }
              >
                <div>
                  <label class={styles.label} for="bgom-model">
                    Model
                  </label>
                  <select
                    id="bgom-model"
                    class={styles.selectInput}
                    value={selectedModel()}
                    onChange={(e) => setSelectedModel(e.currentTarget.value)}
                    disabled={busy()}
                  >
                    <For each={modelsResource() ?? []}>
                      {(m) => (
                        <option value={m.name}>
                          {(m.displayName ?? m.name) + ` — ${m.provider}`}
                        </option>
                      )}
                    </For>
                  </select>
                  <Show when={currentModel()?.description}>
                    <div class={styles.help}>{currentModel()!.description}</div>
                  </Show>
                </div>

                <div>
                  <label class={styles.label} for="bgom-prompt">
                    Prompt
                  </label>
                  <textarea
                    id="bgom-prompt"
                    class={styles.promptInput}
                    placeholder="A misty fantasy forest at dusk, painterly style…"
                    value={prompt()}
                    onInput={(e) => setPrompt(e.currentTarget.value)}
                    disabled={busy()}
                    maxLength={2000}
                  />
                </div>

                <div class={styles.generateRow}>
                  <span class={styles.costEstimate}>
                    <Show
                      when={costEstimate()}
                      fallback={`Output: ${DEFAULT_WIDTH}×${DEFAULT_HEIGHT}`}
                    >
                      Output: {DEFAULT_WIDTH}×{DEFAULT_HEIGHT} · estimated cost {costEstimate()}
                    </Show>
                  </span>
                  <Button
                    onClick={handleGenerate}
                    disabled={busy() || !prompt().trim() || !selectedModel()}
                  >
                    {isGenerating() ? 'Generating…' : 'Generate'}
                  </Button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Modal>
  )
}
