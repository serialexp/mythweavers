import { type Component, Show } from 'solid-js'
import { Button } from '@mythweavers/ui'
import { effectiveSettings } from '../../stores/effectiveSettingsStore'
import { adventureStore } from '../../stores/adventureStore'
import { llmActivityStore } from '../../stores/llmActivityStore'
import { quickLlmStore } from '../../stores/quickLlmStore'
import { LlmActivityPanel } from '../../components/LlmActivityPanel'
import { LlmCacheDots } from '../../components/LlmCacheDots'
import { QuickLlmDialog } from '../../components/QuickLlmDialog'
import { OverlayPanel } from '../../components/OverlayPanel'
import { useEngine } from './useAdventureEngine'
import * as styles from '../AdventurePage.css'

// --- Header action buttons (shared between desktop and mobile) ---

const HeaderActions: Component = () => {
  const engine = useEngine()

  const effectiveThinking = () =>
    effectiveSettings.thinkingBudget
      ? Math.min(
          effectiveSettings.thinkingBudget,
          Math.floor(effectiveSettings.maxTokens / 2),
        )
      : 0

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
      <Button
        variant={adventureStore.worldMomentumEnabled ? 'ghost' : 'secondary'}
        size="sm"
        onClick={() => {
          adventureStore.setWorldMomentumEnabled(!adventureStore.worldMomentumEnabled)
          engine.persist()
        }}
        title={adventureStore.worldMomentumEnabled
          ? 'World momentum is ON — director and trajectory run automatically'
          : 'World momentum is OFF — narrative only, no background systems'}
      >
        {adventureStore.worldMomentumEnabled ? '🌍 Momentum' : '⏸ Momentum'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          adventureStore.setShowStoryPanel(!adventureStore.showStoryPanel)
        }
        title="Story tools — world bible, director notes, and per-turn directive"
      >
        <Show when={adventureStore.isDirectorRunning}>
          <span class={styles.directorIndicator}>🎬 </span>
        </Show>
        {adventureStore.showStoryPanel ? 'Hide Story' : '📋 Story'}
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
            <HeaderActions />
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
            <HeaderActions />
          </div>
        </div>
      </Show>

      {/* Combined story panel: World Bible + Director Notes + Directive */}
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
              Use for world background, character lists, lore, and rules that rarely change.
            </div>
            <textarea
              class={styles.directiveTextarea}
              value={adventureStore.worldBible}
              onInput={(e) => {
                adventureStore.setWorldBible(e.currentTarget.value)
                engine.persist()
              }}
              placeholder="Background world info, character lists, lore, rules of magic..."
              rows={6}
            />
          </div>

          {/* Director Notes section */}
          <div class={styles.storyPanelSection}>
            {(() => {
              const latestNotes = () => {
                const turns = adventureStore.turns
                for (let i = turns.length - 1; i >= 0; i--) {
                  if (turns[i].directorNotes) return turns[i].directorNotes
                }
                return undefined
              }
              return (
                <>
                  <div class={styles.storyPanelSectionHeader}>
                    <label class={styles.formLabel}>🎬 Director Notes</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={engine.handleRegenerateDirector}
                      disabled={
                        adventureStore.isGenerating ||
                        adventureStore.isDirectorRunning ||
                        adventureStore.turns.length === 0
                      }
                      title="Regenerate director notes and world momentum for the last turn"
                    >
                      ↻ Regenerate
                    </Button>
                  </div>
                  <div class={styles.directiveHint}>
                    Auto-generated behind-the-scenes notes the LLM uses to maintain
                    story consistency. Updated every 5 turns. Editable.
                  </div>
                  <Show
                    when={latestNotes()}
                    fallback={
                      <div class={styles.directiveHint}>
                        {adventureStore.isDirectorRunning
                          ? 'Director is analyzing the story...'
                          : 'No director notes yet — they appear after the first few turns.'}
                      </div>
                    }
                  >
                    <textarea
                      class={styles.directorNotesContent}
                      value={latestNotes()!}
                      onInput={(e) => {
                        adventureStore.updateLastTurn({
                          directorNotes: e.currentTarget.value,
                        })
                        engine.persist()
                      }}
                      rows={10}
                      disabled={
                        adventureStore.isGenerating ||
                        adventureStore.isDirectorRunning
                      }
                    />
                  </Show>
                </>
              )
            })()}
          </div>

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
