import { type Component, Show, createSignal } from 'solid-js'
import { Button } from '@mythweavers/ui'
import { effectiveSettings } from '../../stores/effectiveSettingsStore'
import { adventureStore } from '../../stores/adventureStore'
import { llmActivityStore } from '../../stores/llmActivityStore'
import { quickLlmStore } from '../../stores/quickLlmStore'
import { LlmActivityPanel } from '../../components/LlmActivityPanel'
import { LlmCacheDots } from '../../components/LlmCacheDots'
import { QuickLlmDialog } from '../../components/QuickLlmDialog'
import { AdventureSettingsModal } from '../../components/AdventureSettingsModal'
import { OverlayPanel } from '../../components/OverlayPanel'
import { useEngine } from './useAdventureEngine'
import { WorldPanel } from './WorldPanel'
import * as styles from '../AdventurePage.css'

// --- Header action buttons (shared between desktop and mobile) ---

const HeaderActions: Component<{ onOpenSettings: () => void }> = (props) => {
  const engine = useEngine()
  let importInput: HTMLInputElement | undefined

  const effectiveThinking = () =>
    effectiveSettings.thinkingBudget
      ? Math.min(
          effectiveSettings.thinkingBudget,
          Math.floor(effectiveSettings.maxTokens / 2),
        )
      : 0

  function handleExport() {
    const snapshot = adventureStore.buildSnapshot()
    const json = JSON.stringify(snapshot, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    // Derive a filename from the setting description's first line
    const firstLine = snapshot.settingDescription.split('\n')[0]?.trim() || 'adventure'
    const safeName = firstLine.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 60) || 'adventure'
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeName}.mythweavers-adventure.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport() {
    importInput?.click()
  }

  async function onImportFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      // Basic validation: must have phase, settingDescription, turns
      if (
        typeof data !== 'object' ||
        !data ||
        !('phase' in data) ||
        !('settingDescription' in data) ||
        !('turns' in data)
      ) {
        alert('This file does not appear to be a valid MythWeavers adventure export.')
        return
      }
      if (!window.confirm('Import this adventure? This will replace your current adventure.')) {
        return
      }
      adventureStore.initialize(data)
      // Persist the imported state, then navigate to the adventure
      engine.persist()
      // If the imported adventure is in playing phase, the UI will update automatically
      // Force a re-render by navigating (the store phase will drive the view)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      alert(`Failed to import adventure: ${message}`)
    } finally {
      // Reset the input so the same file can be re-imported
      input.value = ''
    }
  }

  return (
    <>
      <span class={styles.modelInfo}>
        {effectiveSettings.provider} / {effectiveSettings.model}
        {' · '}
        {effectiveSettings.maxTokens} tokens
        <Show when={effectiveThinking() > 0}>
          {' · '}
          {effectiveThinking()} thinking
        </Show>
      </span>
      <input
        ref={importInput}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={onImportFile}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExport}
        title="Export adventure as a JSON file"
      >
        📤 Export
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleImport}
        title="Import an adventure from a JSON file"
      >
        📥 Import
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          adventureStore.setShowStoryPanel(!adventureStore.showStoryPanel)
        }
        title="Story tools — world bible and per-turn directive"
      >
        {adventureStore.showStoryPanel ? 'Hide Story' : '📋 Story'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => props.onOpenSettings()}
        title="Adventure settings"
      >
        ⚙️ Settings
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => quickLlmStore.toggle()}
        title="Quick LLM chat"
      >
        💬 LLM
      </Button>
      <LlmCacheDots />
      <Button variant="secondary" size="sm" onClick={engine.handleReset}>
        New Adventure
      </Button>
    </>
  )
}

// --- Main header component ---

export const AdventureHeader: Component<{
  onBack: () => void
}> = (props) => {
  const engine = useEngine()
  const [showSettings, setShowSettings] = createSignal(false)

  return (
    <>
      {/* Header bar */}
      <div class={styles.header}>
        <div class={styles.headerLeft}>
          <Button variant="ghost" size="sm" onClick={props.onBack}>
            ← Back
          </Button>
          <h1 class={styles.title}>World Pulse</h1>
        </div>
        <Show when={adventureStore.phase === 'playing'}>
          <div class={styles.headerRight}>
            <HeaderActions onOpenSettings={() => setShowSettings(true)} />
          </div>
          <button
            class={styles.menuToggle}
            onClick={() =>
              adventureStore.setShowMenu(!adventureStore.showMenu)
            }
          >
            {adventureStore.showMenu ? '✕' : '☰'}
          </button>
        </Show>
      </div>

      {/* Mobile menu */}
      <Show when={adventureStore.phase === 'playing' && adventureStore.showMenu}>
        <div class={styles.mobileMenu}>
          <div class={styles.mobileMenuActions}>
            <HeaderActions onOpenSettings={() => setShowSettings(true)} />
          </div>
        </div>
      </Show>

      {/* Combined story panel: World Bible + Directive */}
      <Show
        when={
          adventureStore.phase === 'playing' &&
          adventureStore.showStoryPanel
        }
      >
        <div class={styles.headerDirectivePanel}>
          {/* World Bible section */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>📖 World Bible</label>
            <div class={styles.directiveHint}>
              Foundational context injected at the start of every LLM call.
              Use for world background, lore, and rules that rarely change.
              For per-character / per-plot tracking, use the structured
              sections below — they update during the story.
            </div>
            <textarea
              class={styles.directiveTextarea}
              value={adventureStore.worldBible}
              onInput={(e) => {
                adventureStore.setWorldBible(e.currentTarget.value)
                engine.persist()
              }}
              placeholder="Background world info, lore, rules of magic..."
              rows={6}
            />
          </div>

          {/* Protagonist — always visible, independent of living-world toggle */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>🧍 Protagonist</label>
            <div class={styles.directiveHint}>
              The player's character — injected into every narrative turn.
              Keep it concise — a sentence or two.
            </div>
            <textarea
              class={styles.directiveTextarea}
              value={adventureStore.protagonistInput}
              onInput={(e) => {
                adventureStore.setProtagonistInput(e.currentTarget.value)
                engine.persist()
              }}
              placeholder="e.g., A retired soldier with a mysterious past."
              rows={3}
              disabled={adventureStore.isAnalyzing}
            />
          </div>

          {/* Deuteragonist — always visible, independent of living-world toggle */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>🤝 Partner / Deuteragonist</label>
            <div class={styles.directiveHint}>
              An AI-controlled companion who takes their own actions each turn along
              with you. Their personality is fed into every narrative turn. Keep it
              concise — a sentence or two. Leave empty to disable.
            </div>
            <textarea
              class={styles.directiveTextarea}
              value={adventureStore.deuteragonistInput}
              onInput={(e) => {
                adventureStore.setDeuteragonistInput(e.currentTarget.value)
                engine.persist()
              }}
              placeholder="e.g., A quick-witted rogue named Lyra"
              rows={3}
            />
            {/* Party split toggle — only shown when a deuteragonist is configured */}
            <Show when={adventureStore.deuteragonistInput.trim()}>
              <label
                class={styles.partySplitLabel}
                title="When the party splits, each turn generates two parallel narratives — one for the protagonist, one for the deuteragonist — displayed in tabs."
              >
                <input
                  type="checkbox"
                  checked={adventureStore.partySplit}
                  onChange={(e) => {
                    adventureStore.setPartySplit(e.currentTarget.checked)
                    engine.persist()
                  }}
                />
                {' '}✂️ Party is split — generate separate narratives
              </label>
            </Show>
          </div>

          {/* Living-world fields (state + synthesized arc) — only meaningful
              when the living-world subsystem is on; hidden otherwise to keep
              the panel to World Bible + Per-Turn Directive. */}
          <Show when={adventureStore.livingWorldEnabled}>
            {/* Living world state — characters, plot points, agenda */}
            <WorldPanel />

            {/* Synthesized global storyline */}
            <div class={styles.storyPanelSection}>
              <label class={styles.formLabel}>
                🧵 Story Arc
                <Show when={adventureStore.isSynthesizing}>
                  <span style={{ 'margin-left': '8px', opacity: 0.6, 'font-size': '0.85em' }}>
                    synthesizing…
                  </span>
                </Show>
              </label>
              <div class={styles.directiveHint}>
                A model-synthesized paragraph describing what's actually
                happening across the whole story so far, taking the full
                narrative + every tracked plot point into account. Regenerated
                after each turn (right after the analysis pass) and fed back
                into the narrative prompt so the generator has a coherent
                throughline. You can edit it; your edits stick until the next
                synthesis pass overwrites them.
              </div>
              <textarea
                class={styles.directiveTextarea}
                value={adventureStore.storyline}
                onInput={(e) => {
                  adventureStore.setStoryline(e.currentTarget.value)
                  engine.persist()
                }}
                placeholder="(empty — will be filled in after the first turn's synthesis pass)"
                rows={6}
              />
            </div>
          </Show>

          {/* Directive section */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>Per-Turn Directive</label>
            <div class={styles.directiveHint}>
              Instructions appended to the end of every LLM call (recency bias).
              Use for style guidance, tone, or constraints for the current arc.
            </div>
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
          </div>
        </div>
      </Show>

      {/* Adventure settings popup */}
      <AdventureSettingsModal
        open={showSettings()}
        onClose={() => setShowSettings(false)}
      />

      {/* LLM Activity overlay */}
      <OverlayPanel
        show={llmActivityStore.isOpen}
        onClose={() => llmActivityStore.hide()}
        title="LLM Activity"
        position="right"
      >
        <LlmActivityPanel />
      </OverlayPanel>

      {/* Quick LLM overlay */}
      <OverlayPanel
        show={quickLlmStore.isOpen}
        onClose={() => quickLlmStore.hide()}
        title="Quick LLM"
        position="right"
      >
        <QuickLlmDialog />
      </OverlayPanel>
    </>
  )
}
