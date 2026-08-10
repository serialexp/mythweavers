import { type Component, For, Show } from 'solid-js'
import { Button } from '@mythweavers/ui'
import { adventureStore } from '../../stores/adventureStore'
import { generateMessageId } from '../../utils/id'
import type {
  CharacterCard,
  Disposition,
} from '../../hooks/useAdventurePersistence'
import { DISPOSITIONS } from '../../hooks/useAdventurePersistence'
import { useEngine } from './useAdventureEngine'
import * as styles from '../AdventurePage.css'

/**
 * Character panel — view & edit the cast on file. Always available,
 * independent of the living-world toggle: having a cast and letting a
 * background model maintain it are two different things.
 *
 * With `livingWorldEnabled` on, the analysis pass patches these cards via
 * tool calls and the full card (motive + disposition included) is injected
 * into every writer prompt. With it off, the cards are user-authored only
 * and reach the prompt as name + description; the motive and disposition
 * inputs are hidden rather than shown-and-ignored, since nothing reads them
 * in that mode. Values already on file survive the toggle either way — they
 * live in the store and reappear when it's switched back on.
 *
 * Renders a fragment of `storyPanelSection` divs (NOT wrapped in a
 * container): `storyPanelSection` uses an `& + &` sibling selector for its
 * dividers, so a wrapper element would break the divider chain both for this
 * section and for whichever section follows it.
 */
export const CharacterPanel: Component = () => {
  const engine = useEngine()
  const persist = () => engine.persist()

  const addCharacter = () => {
    const card: CharacterCard = {
      id: generateMessageId(),
      name: 'New character',
      description: '',
      motive: '',
      disposition: 'indifference',
    }
    adventureStore.upsertCharacter(card)
    persist()
  }

  const patchChar = (id: string, patch: Partial<Omit<CharacterCard, 'id'>>) => {
    adventureStore.patchCharacter(id, patch)
    persist()
  }

  const toggleArchived = (c: CharacterCard) => {
    patchChar(c.id, { archived: !c.archived })
  }

  const deleteChar = (id: string) => {
    if (!confirm('Delete this character entirely? Use archive instead to keep them on the roster off-screen.')) return
    adventureStore.removeCharacter(id)
    persist()
  }

  // Reactive derived list. Use functions inside For callbacks; the list
  // itself can be a plain getter because the For tracks it.
  const characterList = () => Object.values(adventureStore.characters)

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
   * With the living-world toggle off no analysis pass ever runs, so
   * `isAnalyzing` is never true: the fields are never locked and the banner
   * below never renders.
   */
  const isLocked = () => adventureStore.isAnalyzing

  return (
    <>
      {/* Lock banner */}
      <Show when={isLocked()}>
        <div class={styles.worldPanelLockBanner}>
          🔒 Analysis pass is updating the world state — edits paused for a few
          seconds. Your changes will be re-enabled as soon as it finishes.
        </div>
      </Show>

      {/* Characters */}
      <div class={styles.storyPanelSection}>
        <div class={styles.storyPanelSectionHeader}>
          <label class={styles.formLabel}>👥 Characters</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addCharacter}
            disabled={isLocked()}
          >
            + Add
          </Button>
        </div>
        <div class={styles.directiveHint}>
          <Show
            when={adventureStore.livingWorldEnabled}
            fallback={
              <>
                Per-character cards injected into every narrative turn. Keep
                descriptions concise — one paragraph each. These cards are
                yours alone: with world automation off, nothing rewrites them
                between turns. Archived characters stay on file but are not
                shown to the model.
              </>
            }
          >
            Per-character cards injected into every narrative turn. Keep
            descriptions and motives concise — one paragraph / one sentence
            each. Disposition is the character's standing stance toward the
            protagonist (hatred → love). Archived characters stay on file but
            are not shown to the model.
          </Show>
        </div>

        <Show
          when={characterList().length > 0}
          fallback={
            <div class={styles.worldPanelEmpty}>
              No characters yet. Add the protagonist's allies, antagonists, or
              recurring NPCs as you meet them.
            </div>
          }
        >
          <div class={styles.worldPanelList}>
            <For each={characterList()}>
              {(c) => {
                const isArchived = () =>
                  !!adventureStore.characters[c.id]?.archived
                return (
                  <div
                    class={`${styles.worldPanelCard} ${
                      isArchived() ? styles.worldPanelCardArchived : ''
                    }`}
                  >
                    <div class={styles.worldPanelCardHeader}>
                      <input
                        class={styles.worldPanelCardTitle}
                        value={c.name}
                        onInput={(e) =>
                          patchChar(c.id, { name: e.currentTarget.value })
                        }
                        placeholder="Character name"
                        disabled={isLocked()}
                      />
                      <div class={styles.worldPanelCardActions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleArchived(c)}
                          disabled={isLocked()}
                          title={
                            isArchived()
                              ? 'Unarchive — re-include in narrative prompts'
                              : 'Archive — keep on file, exclude from prompts'
                          }
                        >
                          {isArchived() ? '↩︎' : '📥'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteChar(c.id)}
                          disabled={isLocked()}
                          title="Delete entirely"
                        >
                          ✕
                        </Button>
                      </div>
                    </div>

                    {/* Motive + disposition are maintained by the analysis
                        pass and only reach the prompt when world automation
                        is on; hidden otherwise so we never collect input
                        that nothing reads. */}
                    <Show when={adventureStore.livingWorldEnabled}>
                      <div class={styles.worldPanelInlineGrid}>
                        <div class={styles.worldPanelField}>
                          <label class={styles.worldPanelFieldLabel}>
                            Motive
                          </label>
                          <input
                            class={styles.worldPanelFieldInput}
                            value={c.motive}
                            onInput={(e) =>
                              patchChar(c.id, { motive: e.currentTarget.value })
                            }
                            placeholder="What they currently want"
                            disabled={isLocked()}
                          />
                        </div>
                        <div class={styles.worldPanelField}>
                          <label
                            class={styles.worldPanelFieldLabel}
                            title="Standing stance toward the protagonist on a 7-step scale, anchored at hatred and love."
                          >
                            Disposition
                          </label>
                          <select
                            class={styles.worldPanelFieldSelect}
                            value={c.disposition ?? 'indifference'}
                            onChange={(e) =>
                              patchChar(c.id, {
                                disposition: e.currentTarget
                                  .value as Disposition,
                              })
                            }
                            disabled={isLocked()}
                          >
                            <For each={DISPOSITIONS}>
                              {(d) => <option value={d}>{d}</option>}
                            </For>
                          </select>
                        </div>
                      </div>
                    </Show>

                    <div class={styles.worldPanelField}>
                      <label class={styles.worldPanelFieldLabel}>
                        Description
                      </label>
                      <textarea
                        class={styles.worldPanelFieldTextarea}
                        value={c.description}
                        onInput={(e) =>
                          patchChar(c.id, {
                            description: e.currentTarget.value,
                          })
                        }
                        placeholder="One paragraph: appearance, personality, voice, relevant skills."
                        rows={3}
                        disabled={isLocked()}
                      />
                    </div>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </div>
    </>
  )
}
