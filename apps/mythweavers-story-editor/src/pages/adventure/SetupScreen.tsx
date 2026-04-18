import { type Component, For, Show, createSignal } from 'solid-js'
import { Button, Text } from '@mythweavers/ui'
import { ProviderModelSelector } from '../../components/ProviderModelSelector'
import { effectiveSettings } from '../../stores/effectiveSettingsStore'
import { adventureStore } from '../../stores/adventureStore'
import { useEngine } from './useAdventureEngine'
import { SETTING_KNOBS } from './prompts'
import * as styles from '../AdventurePage.css'

export const SetupScreen: Component = () => {
  const engine = useEngine()
  const [showAdvanced, setShowAdvanced] = createSignal(false)

  return (
    <div class={styles.setupContainer}>
      <div class={styles.setupCard}>
        <h1 class={styles.setupTitle}>World Pulse Adventure</h1>
        <Text
          color="secondary"
          style={{ 'margin-bottom': '1.5rem', 'line-height': '1.5' }}
        >
          An interactive story where the world has its own momentum. Each turn,
          the AI generates what happens based on your actions — and also what{' '}
          <em>would</em> have happened if you'd done nothing. The world doesn't
          wait for you.
        </Text>

        <Show when={adventureStore.error}>
          <div class={styles.errorRow}>
            <div class={styles.errorText}>{adventureStore.error}</div>
            <Show when={adventureStore.settingGenFailed}>
              <Button
                variant="secondary"
                size="sm"
                onClick={engine.handleGenerateSetting}
              >
                Retry
              </Button>
            </Show>
          </div>
        </Show>

        <ProviderModelSelector autoFetchModels />

        <div
          class={styles.settingGenerator}
          style={{ 'margin-top': '1rem' }}
        >
          <label class={styles.formLabel}>Story Setting</label>
          <div class={styles.generateRow}>
            <Button
              variant="secondary"
              size="sm"
              onClick={engine.handleGenerateSetting}
              disabled={!effectiveSettings.model || adventureStore.isGeneratingSetting}
            >
              {adventureStore.isGeneratingSetting
                ? 'Generating...'
                : 'Generate Setting'}
            </Button>
            <button
              class={styles.knobsToggle}
              onClick={() =>
                adventureStore.setShowKnobs(!adventureStore.showKnobs)
              }
            >
              {adventureStore.showKnobs ? '▾ Parameters' : '▸ Parameters'}
            </button>
          </div>

          <Show when={adventureStore.showKnobs}>
            <div class={styles.knobsPanel}>
              <For each={SETTING_KNOBS}>
                {(knob) => (
                  <div class={styles.knobRow}>
                    <span class={styles.knobLabel}>{knob.label}</span>
                    <select
                      class={styles.knobSelect}
                      value={adventureStore.knobValues[knob.id] || ''}
                      onChange={(e) =>
                        adventureStore.setKnobValue(
                          knob.id,
                          e.target.value,
                        )
                      }
                    >
                      <option value="">Random</option>
                      <For each={knob.options}>
                        {(opt) => <option value={opt}>{opt}</option>}
                      </For>
                    </select>
                    <button
                      class={`${styles.lockButton} ${adventureStore.knobLocks[knob.id] ? styles.lockButtonLocked : ''}`}
                      onClick={() =>
                        adventureStore.toggleKnobLock(knob.id)
                      }
                      title={
                        adventureStore.knobLocks[knob.id]
                          ? 'Unlock (will randomize)'
                          : 'Lock (keep this value)'
                      }
                    >
                      {adventureStore.knobLocks[knob.id] ? '🔒' : '🔓'}
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class={styles.formGroup} style={{ 'margin-top': '0.75rem' }}>
          <textarea
            class={styles.formTextarea}
            value={adventureStore.settingInput}
            onInput={(e) => {
              adventureStore.setSettingInput(e.currentTarget.value)
              if (!adventureStore.isGeneratingSetting) engine.persist()
            }}
            placeholder="Describe the world and starting situation, or use Generate Setting above..."
            rows={4}
          />
        </div>

        <div class={styles.formGroup}>
          <label class={styles.formLabel}>Protagonist (optional)</label>
          <input
            class={styles.formInput}
            type="text"
            value={adventureStore.protagonistInput}
            onInput={(e) => {
              adventureStore.setProtagonistInput(e.currentTarget.value)
              engine.persist()
            }}
            placeholder="e.g., A retired soldier with a mysterious past"
          />
        </div>

        <div style={{ 'margin-top': '0.5rem' }}>
          <button
            class={styles.directiveToggle}
            onClick={() => setShowAdvanced(!showAdvanced())}
          >
            {showAdvanced()
              ? '▾ Advanced Options'
              : '▸ Advanced Options'}
          </button>
          <Show when={showAdvanced()}>
            <div class={styles.directivePanel}>
              <label class={styles.formLabel}>📖 World Bible</label>
              <textarea
                class={styles.directiveTextarea}
                value={adventureStore.worldBible}
                onInput={(e) => {
                  adventureStore.setWorldBible(e.currentTarget.value)
                  engine.persist()
                }}
                placeholder="Background world info, character lists, lore, rules of magic..."
                rows={4}
              />
              <div class={styles.directiveHint}>
                Foundational context injected at the start of every LLM call.
                Rarely changes during play.
              </div>

              <div style={{ 'margin-top': '0.75rem' }}>
                <label class={styles.formLabel}>Per-Turn Directive</label>
                <textarea
                  class={styles.directiveTextarea}
                  value={adventureStore.directive}
                  onInput={(e) => {
                    adventureStore.setDirective(e.currentTarget.value)
                    engine.persist()
                  }}
                  placeholder="Instructions repeated with every story turn..."
                  rows={3}
                />
                <div class={styles.directiveHint}>
                  Appended to the end of every LLM call (recency bias).
                  Use for style or tone guidance.
                </div>
              </div>
            </div>
          </Show>
        </div>

        <Button
          variant="primary"
          onClick={engine.handleStart}
          disabled={
            !adventureStore.settingInput.trim() || !effectiveSettings.model
          }
          style={{ width: '100%', 'margin-top': '0.5rem' }}
        >
          Begin Adventure
        </Button>
      </div>
    </div>
  )
}
