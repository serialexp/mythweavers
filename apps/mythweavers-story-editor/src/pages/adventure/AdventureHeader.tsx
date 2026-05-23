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
import { WorldPanel } from './WorldPanel'
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

          {/* Storyline-gate approval toggle */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>
              <input
                type="checkbox"
                checked={adventureStore.gateApprovalEnabled}
                onChange={(e) => {
                  adventureStore.setGateApprovalEnabled(
                    e.currentTarget.checked,
                  )
                  engine.persist()
                }}
                style={{ 'margin-right': '8px' }}
              />
              Review storyline-gate brief before each turn
            </label>
            <div class={styles.directiveHint}>
              When on, generation pauses after the storyline-gate pass and
              shows you the slice of the arc it's about to forward to the
              narrative. Accept it to continue, or reject it to generate
              this turn without arc context. Useful while iterating on a
              storyline that's prone to drift — you can veto bad gate
              output before it reaches the page, instead of resetting the
              storyline after the fact.
            </div>
          </div>

          {/* Steering toggle */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>
              <input
                type="checkbox"
                checked={adventureStore.steeringEnabled}
                onChange={(e) => {
                  adventureStore.setSteeringEnabled(e.currentTarget.checked)
                  engine.persist()
                }}
                style={{ 'margin-right': '8px' }}
              />
              Vary execution quality (luck rolls)
            </label>
            <div class={styles.directiveHint}>
              When on, each action gets a hidden roll that biases how
              gracefully or clumsily the protagonist pulls it off — most
              turns are neutral, but some land especially well or
              especially badly. When off, every action resolves at face
              value with no luck overlay. Turn this off if disaster /
              friction outcomes feel like they take over scenes more than
              you'd like.
            </div>
          </div>

          {/* Director toggle — two-model flow */}
          <div class={styles.storyPanelSection}>
            <label class={styles.formLabel}>
              <input
                type="checkbox"
                checked={adventureStore.directorEnabled}
                onChange={(e) => {
                  adventureStore.setDirectorEnabled(e.currentTarget.checked)
                  engine.persist()
                }}
                style={{ 'margin-right': '8px' }}
              />
              Use director model (two-pass writing)
            </label>
            <div class={styles.directiveHint}>
              When on, every turn first runs a "director" pass on the
              Analysis-category model — it produces a structured plan
              (beats, NPC reactions, ending beat, things to avoid) — and
              then the writer model renders that plan as prose. Useful
              when the writer model has great prose but drifts off plot.
              Roughly doubles the per-turn LLM cost and latency. The
              brief is saved with each turn so you can inspect it if the
              prose still drifts.
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
