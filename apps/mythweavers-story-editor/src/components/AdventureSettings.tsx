import { type Component, For, Show } from 'solid-js'
import * as styles from '../pages/AdventurePage.css'

/**
 * The per-adventure behavioural toggles. These were historically only
 * configurable mid-adventure (inline in the Story panel); they are now
 * surfaced both before starting (NewAdventureForm) and during play
 * (AdventureSettingsModal) through this single shared component.
 */
export interface AdventureSettingsValues {
  autoAdvanceWorld: boolean
  nonsenseCheckEnabled: boolean
  gateApprovalEnabled: boolean
  steeringEnabled: boolean
  directorEnabled: boolean
  livingWorldEnabled: boolean
  conditionTrackingEnabled: boolean
}

/**
 * Defaults for a brand-new adventure. Mirrors the store initialisation in
 * `adventureStore.ts` and the `?? default` fallbacks in
 * `adventureStore.initialize`, so a new adventure that never touches these
 * settings behaves exactly as before.
 */
export const ADVENTURE_SETTING_DEFAULTS: AdventureSettingsValues = {
  autoAdvanceWorld: false,
  nonsenseCheckEnabled: true,
  gateApprovalEnabled: false,
  steeringEnabled: true,
  directorEnabled: false,
  livingWorldEnabled: true,
  conditionTrackingEnabled: false,
}

interface SettingDescriptor {
  key: keyof AdventureSettingsValues
  label: string
  hint: string
  /**
   * If set, this toggle is only shown when the named setting is enabled.
   * Used to hide the storyline-gate toggle when living world is off — the
   * gate runs against the synthesized/authored storyline, which only
   * advances as part of the living-world subsystem.
   */
  dependsOn?: keyof AdventureSettingsValues
}

// Labels and help text are lifted verbatim from the original inline toggles in
// AdventureHeader.tsx so the wording is unchanged.
const ADVENTURE_SETTINGS: SettingDescriptor[] = [
  {
    key: 'autoAdvanceWorld',
    label: 'Let the world react after each action',
    hint:
      'When on, NPCs act and the scene moves forward automatically after ' +
      'each of your turns. When off, the scene waits for you — use the ' +
      '"Advance world" button on the latest turn to step it manually.',
  },
  {
    key: 'nonsenseCheckEnabled',
    label: 'Check narrative consistency',
    hint:
      'When on, an extra pass scans each generated narrative for physical ' +
      'or logical contradictions and surfaces a warning you can choose to ' +
      'revise. When off, turns finish faster and you skip the check ' +
      'entirely — useful if the check model is flaky or the spinner gets ' +
      'stuck.',
  },
  {
    key: 'gateApprovalEnabled',
    dependsOn: 'livingWorldEnabled',
    label: 'Review storyline-gate brief before each turn',
    hint:
      'When on, generation pauses after the storyline-gate pass and shows ' +
      'you the slice of the arc it\'s about to forward to the narrative. ' +
      'Accept it to continue, or reject it to generate this turn without ' +
      'arc context. Useful while iterating on a storyline that\'s prone to ' +
      'drift — you can veto bad gate output before it reaches the page, ' +
      'instead of resetting the storyline after the fact.',
  },
  {
    key: 'steeringEnabled',
    label: 'Vary execution quality (luck rolls)',
    hint:
      'When on, each action gets a hidden roll that biases how gracefully ' +
      'or clumsily the protagonist pulls it off — most turns are neutral, ' +
      'but some land especially well or especially badly. When off, every ' +
      'action resolves at face value with no luck overlay. Turn this off if ' +
      'disaster / friction outcomes feel like they take over scenes more ' +
      'than you\'d like.',
  },
  {
    key: 'directorEnabled',
    label: 'Use director model (two-pass writing)',
    hint:
      'When on, every turn first runs a "director" pass on the ' +
      'Analysis-category model — it produces a structured plan (beats, NPC ' +
      'reactions, ending beat, things to avoid) — and then the writer model ' +
      'renders that plan as prose. Useful when the writer model has great ' +
      'prose but drifts off plot. Roughly doubles the per-turn LLM cost and ' +
      'latency. The brief is saved with each turn so you can inspect it if ' +
      'the prose still drifts.',
  },
  {
    key: 'livingWorldEnabled',
    label: 'Automate the living world (update cast / plot points / agenda)',
    hint:
      'When on, a background analysis pass runs after each turn to patch ' +
      'the cast, plot points and NPC agendas, a synthesis pass rebuilds the ' +
      'model-side storyline summary, and all of that is injected into every ' +
      'writer prompt. Turn this off for shorter / more freeform sessions ' +
      'where you don\'t want the extra background LLM traffic or the prompt ' +
      'bloat from auto-tracked world state. Off-mode is not character-less: ' +
      'you can still add and describe characters yourself and they still ' +
      'reach every writer prompt (by name and description — motive and ' +
      'disposition are fields this automation maintains, so they\'re hidden ' +
      'while it\'s off). What stops is the engine maintaining its own ' +
      'evolving picture: plot points, the world agenda and the synthesized ' +
      'story arc go with it.',
  },
  {
    key: 'conditionTrackingEnabled',
    label: 'Track physical state (injuries / conditions / gear)',
    hint:
      'When on, a short background pass after each turn maintains a ledger ' +
      'of who is hurt, exhausted, soaked, unarmed, bound, and so on — for ' +
      'the protagonist and any named characters in the scene. That ledger ' +
      'is injected into every writer prompt as a reminder, so the model ' +
      "can't quietly forget that a character can't use a broken arm, no " +
      'longer has their sword, or is too spent to sprint. Independent of ' +
      'living world: it tracks the protagonist even when the cast / plot ' +
      'subsystem is off. Costs one extra cheap model call per turn.',
  },
]

interface AdventureSettingsProps {
  values: AdventureSettingsValues
  onChange: (key: keyof AdventureSettingsValues, value: boolean) => void
}

// Render independent toggles first, then dependent ones as a trailing group.
// This keeps a dependent toggle adjacent to (just below) the setting it hangs
// off, instead of popping into the middle of the list when its dependency is
// switched on.
const INDEPENDENT_SETTINGS = ADVENTURE_SETTINGS.filter((s) => !s.dependsOn)
const DEPENDENT_SETTINGS = ADVENTURE_SETTINGS.filter((s) => s.dependsOn)

/**
 * Presentational, store-agnostic list of the per-adventure toggles. Both the
 * pre-adventure form and the in-adventure popup bind their own value source
 * and change handler.
 */
export const AdventureSettings: Component<AdventureSettingsProps> = (props) => {
  const row = (setting: SettingDescriptor, indented = false) => (
    <div
      class={
        indented
          ? `${styles.storyPanelSection} ${styles.storyPanelSubSection}`
          : styles.storyPanelSection
      }
    >
      <label class={styles.formLabel}>
        <input
          type="checkbox"
          checked={props.values[setting.key]}
          onChange={(e) => props.onChange(setting.key, e.currentTarget.checked)}
          style={{ 'margin-right': '8px' }}
        />
        {setting.label}
      </label>
      <div class={styles.directiveHint}>{setting.hint}</div>
    </div>
  )

  return (
    <>
      <For each={INDEPENDENT_SETTINGS}>{(setting) => row(setting)}</For>
      <For each={DEPENDENT_SETTINGS}>
        {(setting) => (
          <Show when={props.values[setting.dependsOn!]}>{row(setting, true)}</Show>
        )}
      </For>
    </>
  )
}
