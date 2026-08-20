import { Button } from '@mythweavers/ui'
import { Component, For, Show, createSignal } from 'solid-js'
import { getMyAdventuresById } from '../client/config'
import * as styles from '../pages/AdventurePage.css'
import { SETTING_KNOBS, buildSettingGenerationMessages, pickRandom } from '../pages/adventure/prompts'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import { LLMClientFactory } from '../utils/llm/LLMClientFactory'
import { resolveModel } from '../utils/llm/resolveModel'
import { ADVENTURE_SETTING_DEFAULTS, AdventureSettings, type AdventureSettingsValues } from './AdventureSettings'

export interface ReusableAdventureSetting {
  id: string
  name: string
  settingPreview?: string
}

export interface NewAdventureResult {
  worldSetting: string
  startPrompt: string
  protagonistInput: string
  deuteragonistInput: string
  directive: string
  settings: AdventureSettingsValues
}

interface NewAdventureFormProps {
  onStart: (result: NewAdventureResult) => void | Promise<void>
  onCancel?: () => void
  reusableSettings?: ReusableAdventureSetting[]
  isCreating?: boolean
  createError?: string | null
}

export const NewAdventureForm: Component<NewAdventureFormProps> = (props) => {
  const [worldSetting, setWorldSetting] = createSignal('')
  const [modifyInstruction, setModifyInstruction] = createSignal('')
  const [startPrompt, setStartPrompt] = createSignal('')
  const [importAdventureId, setImportAdventureId] = createSignal('')
  const [isImporting, setIsImporting] = createSignal(false)
  const [protagonistInput, setProtagonistInput] = createSignal('')
  const [deuteragonistInput, setDeuteragonistInput] = createSignal('')
  const [directive, setDirective] = createSignal('')
  const [showDirective, setShowDirective] = createSignal(false)
  const [showKnobs, setShowKnobs] = createSignal(false)
  const [showSettings, setShowSettings] = createSignal(false)
  const [advSettings, setAdvSettings] = createSignal<AdventureSettingsValues>({
    ...ADVENTURE_SETTING_DEFAULTS,
  })
  const [isGeneratingSetting, setIsGeneratingSetting] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [settingGenFailed, setSettingGenFailed] = createSignal(false)
  const [knobValues, setKnobValues] = createSignal<Record<string, string>>(
    Object.fromEntries(SETTING_KNOBS.map((k) => [k.id, ''])),
  )
  const [knobLocks, setKnobLocks] = createSignal<Record<string, boolean>>(
    Object.fromEntries(SETTING_KNOBS.map((k) => [k.id, false])),
  )

  function toggleKnobLock(knobId: string) {
    setKnobLocks((prev) => ({ ...prev, [knobId]: !prev[knobId] }))
  }

  function setKnobValue(knobId: string, value: string) {
    setKnobValues((prev) => ({ ...prev, [knobId]: value }))
    setKnobLocks((prev) => ({ ...prev, [knobId]: true }))
  }

  async function handleGenerateSetting() {
    if (!effectiveSettings.model || !effectiveSettings.provider) {
      setError('Please configure your AI provider and model first.')
      return
    }

    setIsGeneratingSetting(true)
    setError(null)
    setSettingGenFailed(false)

    const locks = knobLocks()
    const values = { ...knobValues() }
    for (const knob of SETTING_KNOBS) {
      if (!locks[knob.id]) {
        values[knob.id] = pickRandom(knob.options)
      }
    }
    setKnobValues(values)

    const existingText = worldSetting().trim()
    const modification = modifyInstruction().trim()

    try {
      const settingResolved = resolveModel('adventure-setting')
      const client = LLMClientFactory.getClient(settingResolved.provider)

      const messages = buildSettingGenerationMessages({
        parameters: values,
        ...(existingText && modification
          ? { currentSetting: existingText, modification }
          : { baseConcept: existingText }),
      })

      let accumulated = ''
      let doneThinking = false
      const response = client.generate({
        model: settingResolved.model,
        messages,
        max_tokens: settingResolved.maxTokens,
        thinking_budget: settingResolved.thinkingBudget
          ? Math.min(settingResolved.thinkingBudget, Math.floor(settingResolved.maxTokens / 2))
          : undefined,
        metadata: { callType: 'adventure-setting' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
          if (accumulated.includes('</think>')) {
            doneThinking = true
          }
          if (doneThinking || !accumulated.includes('<think>')) {
            const display = accumulated.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
            if (display) {
              setWorldSetting(display)
            }
          }
        }
      }

      const cleaned = accumulated.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      if (cleaned) {
        setWorldSetting(cleaned)
        if (modification) setModifyInstruction('')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate setting'
      setError(message)
      setSettingGenFailed(true)
      console.error('Setting generation error:', err)
    } finally {
      setIsGeneratingSetting(false)
    }
  }

  async function handleImportSetting() {
    const id = importAdventureId()
    if (!id) return
    if (worldSetting().trim() && !confirm('Replace the current world setting with the imported setting?')) return

    setIsImporting(true)
    setError(null)
    try {
      const { data } = await getMyAdventuresById({ path: { id } })
      const state = data?.adventure.data as Record<string, unknown> | undefined
      const imported =
        (typeof state?.worldBible === 'string' && state.worldBible.trim()) ||
        (typeof state?.settingDescription === 'string' && state.settingDescription.trim()) ||
        ''
      if (!imported) throw new Error('That adventure has no reusable world setting.')
      setWorldSetting(imported)
      setModifyInstruction('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import setting')
    } finally {
      setIsImporting(false)
    }
  }

  function handleStart() {
    props.onStart({
      worldSetting: worldSetting().trim(),
      startPrompt: startPrompt().trim(),
      protagonistInput: protagonistInput(),
      deuteragonistInput: deuteragonistInput(),
      directive: directive(),
      settings: advSettings(),
    })
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
      <Show when={error() || props.createError}>
        <div class={styles.errorRow}>
          <div class={styles.errorText}>{error() || props.createError}</div>
          <Show when={settingGenFailed()}>
            <Button variant="secondary" size="sm" onClick={handleGenerateSetting}>
              Retry
            </Button>
          </Show>
        </div>
      </Show>

      <div class={styles.settingGenerator}>
        <label class={styles.formLabel}>World Setting</label>
        <div class={styles.directiveHint}>
          Persistent world lore and rules. This is kept in the World Bible throughout the adventure.
        </div>
        <div class={styles.generateRow}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateSetting}
            disabled={!effectiveSettings.model || isGeneratingSetting() || props.isCreating}
          >
            {isGeneratingSetting()
              ? 'Generating...'
              : worldSetting().trim() && modifyInstruction().trim()
                ? 'Modify Setting'
                : 'Generate Setting'}
          </Button>
          <button class={styles.knobsToggle} onClick={() => setShowKnobs(!showKnobs())}>
            {showKnobs() ? '▾ Parameters' : '▸ Parameters'}
          </button>
        </div>

        <Show when={showKnobs()}>
          <div class={styles.knobsPanel}>
            <For each={SETTING_KNOBS}>
              {(knob) => (
                <div class={styles.knobRow}>
                  <span class={styles.knobLabel}>{knob.label}</span>
                  <select
                    class={styles.knobSelect}
                    value={knobValues()[knob.id] || ''}
                    onChange={(e) => setKnobValue(knob.id, e.target.value)}
                  >
                    <option value="">Random</option>
                    <For each={knob.options}>{(opt) => <option value={opt}>{opt}</option>}</For>
                  </select>
                  <button
                    class={`${styles.lockButton} ${knobLocks()[knob.id] ? styles.lockButtonLocked : ''}`}
                    onClick={() => toggleKnobLock(knob.id)}
                    title={knobLocks()[knob.id] ? 'Unlock (will randomize)' : 'Lock (keep this value)'}
                  >
                    {knobLocks()[knob.id] ? '🔒' : '🔓'}
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class={styles.formGroup}>
        <textarea
          class={styles.formTextarea}
          value={worldSetting()}
          onInput={(e) => setWorldSetting(e.currentTarget.value)}
          placeholder="Describe the world, its places, cultures, technology or magic, and stable rules—or enter a rough world idea and generate it..."
          rows={5}
          disabled={isGeneratingSetting() || props.isCreating}
        />
      </div>

      <Show when={(props.reusableSettings?.length ?? 0) > 0}>
        <div class={styles.formGroup}>
          <label class={styles.formLabel}>Import setting from an existing adventure</label>
          <div class={styles.generateRow}>
            <select
              class={styles.formInput}
              value={importAdventureId()}
              onChange={(event) => setImportAdventureId(event.currentTarget.value)}
              disabled={isImporting() || props.isCreating}
            >
              <option value="">Choose an adventure…</option>
              <For each={props.reusableSettings}>
                {(adventure) => (
                  <option value={adventure.id}>
                    {adventure.name}
                    {adventure.settingPreview ? ` — ${adventure.settingPreview}` : ''}
                  </option>
                )}
              </For>
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleImportSetting}
              disabled={!importAdventureId() || isImporting() || props.isCreating}
            >
              {isImporting() ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </div>
      </Show>

      <div class={styles.formGroup}>
        <label class={styles.formLabel}>Modify (optional)</label>
        <input
          class={styles.formInput}
          type="text"
          value={modifyInstruction()}
          onInput={(event) => setModifyInstruction(event.currentTarget.value)}
          placeholder="e.g., Remove magic, add political tension, and focus on floating cities"
          disabled={!worldSetting().trim() || isGeneratingSetting() || props.isCreating}
        />
        <div class={styles.directiveHint}>
          Describe changes, then choose Modify Setting. This instruction is not saved as lore.
        </div>
      </div>

      <div class={styles.formGroup}>
        <label class={styles.formLabel}>Adventure Start</label>
        <textarea
          class={styles.formTextarea}
          value={startPrompt()}
          onInput={(event) => setStartPrompt(event.currentTarget.value)}
          placeholder="What happens to begin this adventure? e.g., During the midsummer treaty ceremony, the sky-city's engines suddenly stop."
          rows={4}
          disabled={props.isCreating}
        />
        <div class={styles.directiveHint}>
          The immediate situation for this adventure's opening. It is separate from the persistent world setting.
        </div>
      </div>

      <div class={styles.formGroup}>
        <label class={styles.formLabel}>Protagonist (optional)</label>
        <input
          class={styles.formInput}
          type="text"
          value={protagonistInput()}
          onInput={(e) => setProtagonistInput(e.currentTarget.value)}
          placeholder="e.g., A retired soldier with a mysterious past"
        />
      </div>

      <div class={styles.formGroup}>
        <label class={styles.formLabel}>Partner / Deuteragonist (optional)</label>
        <input
          class={styles.formInput}
          type="text"
          value={deuteragonistInput()}
          onInput={(e) => setDeuteragonistInput(e.currentTarget.value)}
          placeholder="e.g., A quick-witted rogue named Lyra"
        />
        <div class={styles.directiveHint}>
          If filled in, this character will accompany you and take their own actions each turn, driven by AI.
        </div>
      </div>

      <div>
        <button class={styles.directiveToggle} onClick={() => setShowDirective(!showDirective())}>
          {showDirective() ? '▾ Per-Turn Directive' : '▸ Per-Turn Directive'}
        </button>
        <Show when={showDirective()}>
          <div class={styles.directivePanel}>
            <textarea
              class={styles.directiveTextarea}
              value={directive()}
              onInput={(e) => setDirective(e.currentTarget.value)}
              placeholder="Instructions repeated with every story turn..."
              rows={3}
            />
            <div class={styles.directiveHint}>This instruction is injected into the system prompt on every turn.</div>
          </div>
        </Show>
      </div>

      <div>
        <button class={styles.directiveToggle} onClick={() => setShowSettings(!showSettings())}>
          {showSettings() ? '▾ Adventure Settings' : '▸ Adventure Settings'}
        </button>
        <Show when={showSettings()}>
          <div class={styles.directivePanel}>
            <AdventureSettings
              values={advSettings()}
              onChange={(key, value) => setAdvSettings((prev) => ({ ...prev, [key]: value }))}
            />
          </div>
        </Show>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', 'margin-top': '0.25rem' }}>
        <Button
          variant="primary"
          onClick={handleStart}
          disabled={
            !worldSetting().trim() ||
            !startPrompt().trim() ||
            !effectiveSettings.model ||
            isGeneratingSetting() ||
            props.isCreating
          }
          style={{ flex: '1' }}
        >
          {props.isCreating ? 'Creating…' : 'Begin Adventure'}
        </Button>
        <Show when={props.onCancel}>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
        </Show>
      </div>
    </div>
  )
}
