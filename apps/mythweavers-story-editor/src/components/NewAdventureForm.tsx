import { Component, For, Show, createSignal } from 'solid-js'
import { Button } from '@mythweavers/ui'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import { LLMClientFactory } from '../utils/llm/LLMClientFactory'
import { resolveModel } from '../utils/llm/resolveModel'
import type { LLMMessage } from '../types/llm'
import {
  AdventureSettings,
  ADVENTURE_SETTING_DEFAULTS,
  type AdventureSettingsValues,
} from './AdventureSettings'
import * as styles from '../pages/AdventurePage.css'

// --- Setting generation knobs ---

interface SettingKnob {
  id: string
  label: string
  options: string[]
}

const SETTING_KNOBS: SettingKnob[] = [
  {
    id: 'era',
    label: 'Era',
    options: ['Antiquity', 'Medieval', 'Renaissance', 'Victorian', 'Modern', 'Near Future', 'Far Future', 'Stone Age', 'Mythic'],
  },
  {
    id: 'location',
    label: 'Start',
    options: ['City', 'Village', 'Wilderness', 'Underground', 'Coastal', 'Space', 'Desert', 'Mountains', 'Island', 'Floating'],
  },
  {
    id: 'tone',
    label: 'Tone',
    options: ['Dark', 'Whimsical', 'Gritty', 'Heroic', 'Horror', 'Mystery', 'Comedic', 'Melancholic', 'Surreal'],
  },
  {
    id: 'magictech',
    label: 'Power',
    options: ['No magic', 'Low magic', 'High magic', 'Steampunk', 'Sci-fi tech', 'Post-apocalyptic', 'Biopunk', 'Divine'],
  },
  {
    id: 'scale',
    label: 'Scale',
    options: ['Intimate', 'Local', 'Regional', 'Epic', 'Cosmic'],
  },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const SETTING_GEN_PROMPT = `You are a world-builder creating a setting for an interactive adventure. Given the following parameters, craft a vivid, specific setting description in 2-4 sentences. Describe the world and the immediate situation — do NOT describe or mention the protagonist. Focus on atmosphere, sensory details, and an interesting situation that invites exploration.

The "Location" parameter describes the STARTING LOCATION where the adventure begins, not a constraint on the entire world. A cosmic-scale adventure can absolutely start in a village — the village just happens to be where the protagonist is when things kick off.

Be creative and specific — don't just restate the parameters. Invent names, places, and details that make the setting feel alive.

If the user provides a base concept or rough idea, use it as the foundation and flesh it out into a rich setting using the parameters as guidance. The parameters should complement and enhance the base idea, not override it.

Respond with ONLY the setting description, no other text.`

export interface NewAdventureResult {
  settingInput: string
  protagonistInput: string
  deuteragonistInput: string
  directive: string
  settings: AdventureSettingsValues
}

interface NewAdventureFormProps {
  onStart: (result: NewAdventureResult) => void
  onCancel?: () => void
}

export const NewAdventureForm: Component<NewAdventureFormProps> = (props) => {
  const [settingInput, setSettingInput] = createSignal('')
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

    const paramLines = SETTING_KNOBS.map(
      (knob) => `- ${knob.label}: ${values[knob.id]}`,
    ).join('\n')

    const existingText = settingInput().trim()

    try {
      const settingResolved = resolveModel('adventure-setting')
      const client = LLMClientFactory.getClient(settingResolved.provider)

      let userContent = `Parameters:\n${paramLines}`
      if (existingText) {
        userContent += `\n\nBase concept:\n${existingText}`
      }

      const messages: LLMMessage[] = [
        { role: 'system', content: SETTING_GEN_PROMPT },
        { role: 'user', content: userContent },
      ]

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
            const display = accumulated
              .replace(/<think>[\s\S]*?<\/think>/g, '')
              .trim()
            if (display) {
              setSettingInput(display)
            }
          }
        }
      }

      const cleaned = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim()

      if (cleaned) {
        setSettingInput(cleaned)
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

  function handleStart() {
    props.onStart({
      settingInput: settingInput(),
      protagonistInput: protagonistInput(),
      deuteragonistInput: deuteragonistInput(),
      directive: directive(),
      settings: advSettings(),
    })
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
      <Show when={error()}>
        <div class={styles.errorRow}>
          <div class={styles.errorText}>{error()}</div>
          <Show when={settingGenFailed()}>
            <Button variant="secondary" size="sm" onClick={handleGenerateSetting}>
              Retry
            </Button>
          </Show>
        </div>
      </Show>

      <div class={styles.settingGenerator}>
        <label class={styles.formLabel}>Story Setting</label>
        <div class={styles.generateRow}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateSetting}
            disabled={!effectiveSettings.model || isGeneratingSetting()}
          >
            {isGeneratingSetting()
              ? 'Generating...'
              : settingInput().trim()
                ? 'Refine Setting'
                : 'Generate Setting'}
          </Button>
          <button
            class={styles.knobsToggle}
            onClick={() => setShowKnobs(!showKnobs())}
          >
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
                    <For each={knob.options}>
                      {(opt) => <option value={opt}>{opt}</option>}
                    </For>
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
          value={settingInput()}
          onInput={(e) => setSettingInput(e.currentTarget.value)}
          placeholder="Describe the world and starting situation, write a rough idea and hit Generate to refine it, or use Generate Setting above for a fully random setting..."
          rows={4}
        />
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
        <button
          class={styles.directiveToggle}
          onClick={() => setShowDirective(!showDirective())}
        >
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
            <div class={styles.directiveHint}>
              This instruction is injected into the system prompt on every turn.
            </div>
          </div>
        </Show>
      </div>

      <div>
        <button
          class={styles.directiveToggle}
          onClick={() => setShowSettings(!showSettings())}
        >
          {showSettings() ? '▾ Adventure Settings' : '▸ Adventure Settings'}
        </button>
        <Show when={showSettings()}>
          <div class={styles.directivePanel}>
            <AdventureSettings
              values={advSettings()}
              onChange={(key, value) =>
                setAdvSettings((prev) => ({ ...prev, [key]: value }))
              }
            />
          </div>
        </Show>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', 'margin-top': '0.25rem' }}>
        <Button
          variant="primary"
          onClick={handleStart}
          disabled={!settingInput().trim() || !effectiveSettings.model}
          style={{ flex: '1' }}
        >
          Begin Adventure
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
