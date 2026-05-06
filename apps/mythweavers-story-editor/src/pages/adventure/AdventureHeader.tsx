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
              Use for world background, character lists, personalities, lore, and rules that rarely change.
            </div>
            <textarea
              class={styles.directiveTextarea}
              value={adventureStore.worldBible}
              onInput={(e) => {
                adventureStore.setWorldBible(e.currentTarget.value)
                engine.persist()
              }}
              placeholder="Background world info, character lists, personalities, lore, rules of magic..."
              rows={6}
            />
          </div>

          {/* World reactions toggle */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>
              <input
                type="checkbox"
                checked={adventureStore.autoAdvanceWorld}
                onChange={(e) => {
                  adventureStore.setAutoAdvanceWorld(e.currentTarget.checked)
                  engine.persist()
                }}
                style={{ 'margin-right': '8px' }}
              />
              Let the world react after each action
            </label>
            <div class={styles.directiveHint}>
              When on, NPCs act and the scene moves forward automatically after
              each of your turns. When off, the scene waits for you — use the
              "Advance world" button on the latest turn to step it manually.
            </div>
          </div>

          {/* Narrative consistency check toggle */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>
              <input
                type="checkbox"
                checked={adventureStore.nonsenseCheckEnabled}
                onChange={(e) => {
                  adventureStore.setNonsenseCheckEnabled(
                    e.currentTarget.checked,
                  )
                  engine.persist()
                }}
                style={{ 'margin-right': '8px' }}
              />
              Check narrative consistency
            </label>
            <div class={styles.directiveHint}>
              When on, an extra pass scans each generated narrative for
              physical or logical contradictions and surfaces a warning you
              can choose to revise. When off, turns finish faster and you
              skip the check entirely — useful if the check model is flaky
              or the spinner gets stuck.
            </div>
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
