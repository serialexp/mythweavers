import { type Component, Show } from 'solid-js'
import { Button } from '@mythweavers/ui'
import { effectiveSettings } from '../../stores/effectiveSettingsStore'
import { adventureStore } from '../../stores/adventureStore'
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
        variant="ghost"
        size="sm"
        onClick={() =>
          adventureStore.setShowDirectorNotes(
            !adventureStore.showDirectorNotes,
          )
        }
        title="View latest director notes"
        disabled={!adventureStore.turns.some((t) => t.directorNotes)}
      >
        <Show when={adventureStore.isDirectorRunning}>
          <span class={styles.directorIndicator}>🎬 </span>
        </Show>
        {adventureStore.showDirectorNotes ? 'Hide Director' : 'Director'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          adventureStore.setShowDirective(!adventureStore.showDirective)
        }
        title="Edit per-turn directive"
      >
        {adventureStore.showDirective ? 'Hide Directive' : 'Directive'}
      </Button>
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

      {/* Director notes panel */}
      <Show
        when={
          adventureStore.phase === 'playing' &&
          adventureStore.showDirectorNotes
        }
      >
        {(() => {
          const latest = [...adventureStore.turns]
            .reverse()
            .find((t) => t.directorNotes)
          return (
            <div class={styles.headerDirectivePanel}>
              <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
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
              <Show
                when={latest?.directorNotes}
                fallback={
                  <div class={styles.directiveHint}>
                    {adventureStore.isDirectorRunning
                      ? 'Director is analyzing the story...'
                      : 'No director notes yet.'}
                  </div>
                }
              >
                <div class={styles.directorNotesContent}>
                  {latest!.directorNotes}
                </div>
              </Show>
            </div>
          )
        })()}
      </Show>

      {/* Per-turn directive panel */}
      <Show
        when={
          adventureStore.phase === 'playing' && adventureStore.showDirective
        }
      >
        <div class={styles.headerDirectivePanel}>
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
            This instruction is included in the system prompt on every turn.
            Changes take effect on the next generation.
          </div>
        </div>
      </Show>
    </>
  )
}
