import { type Component, For, Show } from 'solid-js'
import { Button } from '@mythweavers/ui'
import { adventureStore } from '../../stores/adventureStore'
import { generateMessageId } from '../../utils/id'
import type {
  PlotPoint,
  AgendaItem,
} from '../../hooks/useAdventurePersistence'
import { useEngine } from './useAdventureEngine'
import * as styles from '../AdventurePage.css'

const PLOT_STATUSES: PlotPoint['status'][] = [
  'seeded',
  'active',
  'resolving',
  'resolved',
  'abandoned',
]

/**
 * World panel — view & edit the automated part of the living world state
 * (plot points, agenda) plus the analysis activity log, all injected into
 * every narrative turn.
 *
 * Only rendered when `livingWorldEnabled` is on: these are the fields the
 * background analysis pass maintains. The cast lives in its own always-
 * available `CharacterPanel` — see the comment there.
 */
export const WorldPanel: Component = () => {
  const engine = useEngine()
  const persist = () => engine.persist()

  // --- Plot point handlers ---

  const addPlotPoint = () => {
    const point: PlotPoint = {
      id: generateMessageId(),
      title: 'New plot point',
      description: '',
      status: 'seeded',
    }
    adventureStore.upsertPlotPoint(point)
    persist()
  }

  const patchPoint = (id: string, patch: Partial<Omit<PlotPoint, 'id'>>) => {
    adventureStore.patchPlotPoint(id, patch)
    persist()
  }

  const deletePoint = (id: string) => {
    if (!confirm('Delete this plot point?')) return
    adventureStore.removePlotPoint(id)
    persist()
  }

  // --- Agenda handlers ---

  const addAgendaItem = () => {
    const item: AgendaItem = {
      id: generateMessageId(),
      description: '',
      when: '',
    }
    adventureStore.upsertAgendaItem(item)
    persist()
  }

  const patchAgenda = (id: string, patch: Partial<Omit<AgendaItem, 'id'>>) => {
    adventureStore.patchAgendaItem(id, patch)
    persist()
  }

  const deleteAgenda = (id: string) => {
    adventureStore.removeAgendaItem(id)
    persist()
  }

  // Reactive derived list. Use a function inside For callbacks; the list
  // itself can be a plain getter because the For tracks it.
  const plotList = () => Object.values(adventureStore.plotPoints)

  /**
   * Edits are disabled while the analysis pass is in flight. The analysis
   * pass writes to the same fields the user might be editing, so a manual
   * edit landing mid-pass could either be overwritten by an applied tool
   * call, or could target an id the analysis pass just removed. Locking
   * for the few seconds the pass takes is far cheaper than reasoning about
   * the race in the store. We deliberately do NOT lock during the main
   * narrative generation (`isGenerating`) — that pass only READS the panel,
   * and narrative turns can run for 30+ seconds; locking that long would
   * be a worse UX than the (negligible) risk of an edit landing one turn
   * later than expected.
   *
   * The banner explaining the lock lives in `CharacterPanel`, which renders
   * directly above this panel whenever this one is visible.
   */
  const isLocked = () => adventureStore.isAnalyzing

  return (
    <>
      {/* Plot points */}
      <div class={styles.storyPanelSection}>
        <div class={styles.storyPanelSectionHeader}>
          <label class={styles.formLabel}>🪡 Plot points</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addPlotPoint}
            disabled={isLocked()}
          >
            + Add
          </Button>
        </div>
        <div class={styles.directiveHint}>
          Things on the books that may yet pay off. Resolved or abandoned
          plot points are kept for continuity but not shown to the model.
        </div>

        <Show
          when={plotList().length > 0}
          fallback={
            <div class={styles.worldPanelEmpty}>
              No plot points yet. Seed mysteries, threats, or pending events
              you want the model to track.
            </div>
          }
        >
          <div class={styles.worldPanelList}>
            <For each={plotList()}>
              {(p) => (
                <div class={styles.worldPanelCard}>
                  <div class={styles.worldPanelCardHeader}>
                    <input
                      class={styles.worldPanelCardTitle}
                      value={p.title}
                      onInput={(e) =>
                        patchPoint(p.id, { title: e.currentTarget.value })
                      }
                      placeholder="Plot point title"
                      disabled={isLocked()}
                    />
                    <div class={styles.worldPanelCardActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePoint(p.id)}
                        disabled={isLocked()}
                        title="Delete plot point"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>

                  <div class={styles.worldPanelField}>
                    <label class={styles.worldPanelFieldLabel}>Status</label>
                    <select
                      class={styles.worldPanelFieldSelect}
                      value={p.status}
                      onChange={(e) =>
                        patchPoint(p.id, {
                          status: e.currentTarget.value as PlotPoint['status'],
                        })
                      }
                      disabled={isLocked()}
                    >
                      <For each={PLOT_STATUSES}>
                        {(s) => <option value={s}>{s}</option>}
                      </For>
                    </select>
                  </div>

                  <div class={styles.worldPanelField}>
                    <label class={styles.worldPanelFieldLabel}>
                      Description
                    </label>
                    <textarea
                      class={styles.worldPanelFieldTextarea}
                      value={p.description}
                      onInput={(e) =>
                        patchPoint(p.id, {
                          description: e.currentTarget.value,
                        })
                      }
                      placeholder="One paragraph: what this plot point is, who it touches, and what it's pointing toward."
                      rows={3}
                      disabled={isLocked()}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Analysis activity log */}
      <div class={styles.storyPanelSection}>
        <div class={styles.worldPanelActivityHeader}>
          <label class={styles.formLabel}>📝 Analysis activity</label>
          <Show when={adventureStore.isAnalyzing}>
            <span class={styles.worldPanelAnalyzingBadge}>analyzing…</span>
          </Show>
          <Show when={adventureStore.analysisLog.length > 0}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!confirm('Clear the analysis activity log?')) return
                adventureStore.clearAnalysisLog()
                engine.persist()
              }}
              disabled={isLocked()}
              title="Clear log"
            >
              Clear
            </Button>
          </Show>
        </div>
        <div class={styles.directiveHint}>
          Updates the analysis model has applied to the world state. The
          freshest entry is at the bottom. If the model is making bad calls,
          you can edit cards directly above or change the analysis model in
          settings.
        </div>

        <Show
          when={adventureStore.analysisLog.length > 0}
          fallback={
            <div class={styles.worldPanelEmpty}>
              No analysis activity yet. The cheap analysis model runs in the
              background after each turn and updates the world state via tool
              calls. Make sure the <code>Analysis</code> category in your
              settings points to a tool-capable OpenAI-compatible model.
            </div>
          }
        >
          <div class={styles.worldPanelActivityList}>
            <For each={adventureStore.analysisLog}>
              {(entry) => {
                const statusClass = () => {
                  switch (entry.status) {
                    case 'failed':
                      return styles.worldPanelActivityStatusFailed
                    case 'noop':
                      return styles.worldPanelActivityStatusNoop
                    default:
                      return styles.worldPanelActivityStatusApplied
                  }
                }
                const formattedArgs = () => {
                  if (entry.args === undefined) return null
                  try {
                    return JSON.stringify(entry.args, null, 2)
                  } catch {
                    return String(entry.args)
                  }
                }
                return (
                  <div class={styles.worldPanelActivityEntry}>
                    <span class={styles.worldPanelActivityTime}>
                      {new Date(entry.at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span class={styles.worldPanelActivityTool}>
                      {entry.tool}
                    </span>
                    <Show when={entry.status}>
                      <span
                        class={`${styles.worldPanelActivityStatus} ${statusClass()}`}
                      >
                        {entry.status}
                      </span>
                    </Show>
                    <span class={styles.worldPanelActivitySummary}>
                      {entry.summary}
                    </span>
                    <Show when={formattedArgs()}>
                      <details class={styles.worldPanelActivityDetails}>
                        <summary
                          class={styles.worldPanelActivityDetailsSummary}
                        >
                          args
                        </summary>
                        <pre class={styles.worldPanelActivityArgs}>
                          {formattedArgs()}
                        </pre>
                        <Show when={entry.error}>
                          <div class={styles.worldPanelActivityError}>
                            {entry.error}
                          </div>
                        </Show>
                      </details>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* World agenda */}
      <div class={styles.storyPanelSection}>
        <div class={styles.storyPanelSectionHeader}>
          <label class={styles.formLabel}>⏱️ World agenda</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addAgendaItem}
            disabled={isLocked()}
          >
            + Add
          </Button>
        </div>
        <div class={styles.directiveHint}>
          Things in motion that will happen on their own timing regardless of
          the protagonist. Drives the world-step pass — at least one of these
          should advance per turn unless the player intervenes.
        </div>

        <Show
          when={adventureStore.agenda.length > 0}
          fallback={
            <div class={styles.worldPanelEmpty}>
              No agenda items yet. Add events with their own timeline (a guard
              patrol, a meeting, a deadline) to give the world independent
              forward motion.
            </div>
          }
        >
          <div class={styles.worldPanelList}>
            <For each={adventureStore.agenda}>
              {(a) => (
                <div class={styles.worldPanelCard}>
                  <div class={styles.worldPanelCardHeader}>
                    <input
                      class={styles.worldPanelCardTitle}
                      value={a.description}
                      onInput={(e) =>
                        patchAgenda(a.id, {
                          description: e.currentTarget.value,
                        })
                      }
                      placeholder='What happens (e.g. "the watch arrives at the tavern")'
                      disabled={isLocked()}
                    />
                    <div class={styles.worldPanelCardActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAgenda(a.id)}
                        disabled={isLocked()}
                        title="Remove from agenda"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                  <div class={styles.worldPanelField}>
                    <label class={styles.worldPanelFieldLabel}>When</label>
                    <input
                      class={styles.worldPanelFieldInput}
                      value={a.when}
                      onInput={(e) =>
                        patchAgenda(a.id, { when: e.currentTarget.value })
                      }
                      placeholder='e.g. "in 30 minutes", "at midnight", "when the bell rings"'
                      disabled={isLocked()}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  )
}
