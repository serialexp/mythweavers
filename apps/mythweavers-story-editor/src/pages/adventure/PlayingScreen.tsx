import { type Component, For, Show, createMemo, createSignal } from 'solid-js'
import { Button, Text } from '@mythweavers/ui'
import { adventureStore } from '../../stores/adventureStore'
import {
  getCompactionRanges,
  type CompactionRange,
  type SteeringBucket,
} from './prompts'
import { useEngine } from './useAdventureEngine'
import * as styles from '../AdventurePage.css'

// --- Render helpers ---

function steeringLabel(b: SteeringBucket): string {
  switch (b) {
    case 'well':
      return 'Fortune +'
    case 'steady':
      return 'Neutral'
    case 'worse':
      return 'Friction'
    case 'hell':
      return 'Disaster'
  }
}

function steeringClass(b: SteeringBucket): string {
  switch (b) {
    case 'well':
      return styles.steeringChipWell
    case 'steady':
      return styles.steeringChipSteady
    case 'worse':
      return styles.steeringChipWorse
    case 'hell':
      return styles.steeringChipHell
  }
}

function renderNarrative(text: string) {
  const paragraphs = text.split('\n\n').filter((p) => p.trim())
  return (
    <div class={styles.narrative}>
      <For each={paragraphs}>
        {(paragraph) => {
          const parts = paragraph.trim().split('\n')
          return (
            <p class={styles.narrativeParagraph}>
              <For each={parts}>
                {(part, i) => (
                  <>
                    {part}
                    <Show when={i() < parts.length - 1}>
                      <br />
                    </Show>
                  </>
                )}
              </For>
            </p>
          )
        }}
      </For>
    </div>
  )
}

function renderStreamingContent() {
  const content = adventureStore.streamingContent
  if (!content) {
    return (
      <div class={styles.streamingIndicator}>
        <div class={styles.streamingDot} />
        <Text as="span" color="secondary">
          The story unfolds...
        </Text>
      </div>
    )
  }

  // Clean up any stray XML tags the model might still emit
  const displayText = content
    .replace(/<\/?narrative>/g, '')
    .replace(/<[a-z_]*$/i, '') // strip trailing incomplete tag
    .trim()

  if (!displayText) {
    return (
      <div class={styles.streamingIndicator}>
        <div class={styles.streamingDot} />
        <Text as="span" color="secondary">
          The story unfolds...
        </Text>
      </div>
    )
  }

  // IMPORTANT: render with the EXACT same wrapper + paragraph classes as
  // a committed turn (`renderNarrative`). On finalize, the streaming
  // block is replaced by a real turn at the same DOM position; if the
  // shapes match the swap is visually seamless and the autoscroll
  // effect has nothing to snap to. The inline cursor at the end is
  // zero-height (display:inline-block on baseline) so it doesn't add
  // structural height.
  const paragraphs = displayText.split('\n\n').filter((p) => p.trim())
  return (
    <div class={styles.narrative}>
      <For each={paragraphs}>
        {(paragraph, index) => {
          const isLast = () => index() === paragraphs.length - 1
          return (
            <p class={styles.narrativeParagraph}>
              {paragraph.trim()}
              <Show when={isLast()}>
                <span class={styles.streamingCursor} aria-hidden="true">
                  ▍
                </span>
              </Show>
            </p>
          )
        }}
      </For>
    </div>
  )
}

// --- Compaction block ---

function EditablePlayerAction(props: {
  action: string
  isLastTurn: boolean
  isGenerating: boolean
  engine: ReturnType<typeof useEngine>
}) {
  const [editing, setEditing] = createSignal(false)
  const [editText, setEditText] = createSignal('')
  let textareaRef: HTMLTextAreaElement | undefined

  function startEditing() {
    setEditText(props.action)
    setEditing(true)
    // Focus after render
    requestAnimationFrame(() => textareaRef?.focus())
  }

  function save() {
    const newAction = editText().trim()
    if (!newAction || newAction === props.action) {
      setEditing(false)
      return
    }
    setEditing(false)
    props.engine.handleEditAndRegenerate(newAction)
  }

  function cancel() {
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      cancel()
    }
  }

  return (
    <Show
      when={editing()}
      fallback={
        <div class={styles.playerAction}>
          <span class={styles.playerActionLabel}>You:</span>
          {props.action}
          <Show when={props.isLastTurn && !props.isGenerating}>
            <button
              class={styles.editActionButton}
              onClick={startEditing}
              title="Edit action and regenerate"
            >
              ✏️
            </button>
          </Show>
        </div>
      }
    >
      <div class={styles.playerActionEdit}>
        <span class={styles.playerActionLabel}>You:</span>
        <textarea
          ref={textareaRef}
          class={styles.playerActionTextarea}
          value={editText()}
          onInput={(e) => setEditText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          rows={2}
        />
        <div class={styles.playerActionEditButtons}>
          <Button variant="primary" size="sm" onClick={save}>
            Save & Regenerate
          </Button>
          <Button variant="ghost" size="sm" onClick={cancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Show>
  )
}

function renderTurn(index: number, engine: ReturnType<typeof useEngine>) {
  const turn = () => adventureStore.turns[index]
  if (!turn()) return null

  const isLastTurn = () => index === adventureStore.turns.length - 1
  const kind = () => turn().kind ?? 'resolution'
  const isWorldStep = () => kind() === 'world-step'

  return (
    <div class={isWorldStep() ? styles.worldStepTurn : styles.turn}>
      <Show when={isWorldStep()}>
        <div
          class={
            adventureStore.autoAdvanceWorld
              ? `${styles.worldStepChip} ${styles.worldStepChipAuto}`
              : styles.worldStepChip
          }
        >
          — the world moves —
        </div>
      </Show>

      <Show when={turn().playerAction}>
        <EditablePlayerAction
          action={turn().playerAction!}
          isLastTurn={isLastTurn()}
          isGenerating={adventureStore.isGenerating}
          engine={engine}
        />
      </Show>

      <Show when={turn().steering}>
        {(s) => (
          <div class={`${styles.steeringChip} ${steeringClass(s())}`}>
            {steeringLabel(s())}
          </div>
        )}
      </Show>

      {renderNarrative(turn().narrative)}

      {/* Director brief — present when the two-model flow ran for this
          turn. Closed by default; expand to audit the plan against the
          prose when the prose drifts. */}
      <Show when={turn().directorBrief}>
        {(brief) => (
          <details class={styles.directorBrief}>
            <summary class={styles.directorBriefSummary}>
              Director brief
            </summary>
            <pre class={styles.directorBriefBody}>{brief()}</pre>
          </details>
        )}
      </Show>

      {/* Empty/failed generation — offer retry on the last turn */}
      <Show
        when={
          !adventureStore.isGenerating &&
          index === adventureStore.turns.length - 1 &&
          turn().narrative.trim().length < 50
        }
      >
        <div class={styles.nonsenseWarning}>
          <div class={styles.nonsenseWarningHeader}>
            ⚠️ Generation appears to have failed
          </div>
          <div class={styles.nonsenseWarningContent}>
            The narrative for this turn is empty or too short. This usually means the LLM returned no usable content.
          </div>
          <div class={styles.nonsenseWarningActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => engine.handleRegenerate()}
            >
              ↻ Retry turn
            </Button>
          </div>
        </div>
      </Show>

      <div class={styles.turnFooter}>
        <Show
          when={
            !adventureStore.isGenerating &&
            index < adventureStore.turns.length - 1
          }
        >
          <button
            class={styles.rewindButton}
            onClick={() => engine.handleRewindTo(index)}
            title={`Rewind to this point (removes ${adventureStore.turns.length - 1 - index} turn${adventureStore.turns.length - 1 - index > 1 ? 's' : ''})`}
          >
            ↩ Rewind here
          </button>
        </Show>

        {/* Manual "Advance world" — only on the latest turn, when it's a
            resolution with a player action, and auto-advance is off. */}
        <Show
          when={
            !adventureStore.isGenerating &&
            isLastTurn() &&
            !isWorldStep() &&
            !adventureStore.autoAdvanceWorld &&
            turn().playerAction !== null
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => engine.handleAdvanceWorld()}
            title="Let NPCs and the world react before your next action"
          >
            ▸ Advance world
          </Button>
        </Show>
      </div>
    </div>
  )
}

const CompactionBlock: Component<{ range: CompactionRange }> = (props) => {
  const [expanded, setExpanded] = createSignal(false)

  const comp = () => adventureStore.compactions[props.range.key]
  const isCompacting = () => adventureStore.isCompacting(props.range.key)
  const engine = useEngine()

  return (
    <div class={styles.compactionBlock}>
      <div
        class={styles.compactionHeader}
        onClick={() => setExpanded(!expanded())}
      >
        <span>
          📦 Turns {props.range.start + 1}–{props.range.end + 1}
          <Show when={isCompacting()}>
            {' '}
            <span class={styles.compactionPending}>⏳ compacting...</span>
          </Show>
        </span>
        <div style={{ display: 'flex', gap: '8px', 'align-items': 'center' }}>
          <Show when={!isCompacting()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                engine.handleCompactRange(props.range)
              }}
            >
              {comp() ? '🔄 Regenerate' : 'Compact'}
            </Button>
          </Show>
          <span>{expanded() ? '▾' : '▸'}</span>
        </div>
      </div>

      {/* Summary (shown when collapsed and compaction exists) */}
      <Show when={comp()?.summary && !expanded()}>
        <div class={styles.compactionSummary}>{comp()!.summary}</div>
      </Show>

      {/* Expanded: show summary + original turns */}
      <Show when={expanded()}>
        <Show when={comp()?.summary}>
          <div class={styles.compactionSummary}>
            <div class={styles.compactionOriginalLabel}>Summary</div>
            {comp()!.summary}
          </div>
        </Show>
        <div class={styles.compactionOriginal}>
          <div class={styles.compactionOriginalLabel}>Original turns</div>
          <For each={Array.from({ length: props.range.end - props.range.start + 1 }, (_, i) => props.range.start + i)}>
            {(turnIndex) => renderTurn(turnIndex, engine)}
          </For>
        </div>
      </Show>
    </div>
  )
}

// --- Component ---

export const PlayingScreen: Component = () => {
  const engine = useEngine()

  const ranges = createMemo(() => getCompactionRanges(adventureStore.turns.length))

  // Turns between last compaction range and verbatim window (partial chunk, not yet compactable)
  const gapStart = createMemo(() => {
    const r = ranges()
    return r.length > 0 ? r[r.length - 1].end + 1 : 0
  })

  const verbatimStart = createMemo(() =>
    Math.max(0, adventureStore.turns.length - 30),
  )

  const gapIndices = createMemo(() => {
    const result: number[] = []
    for (let i = gapStart(); i < verbatimStart(); i++) {
      result.push(i)
    }
    return result
  })

  const verbatimIndices = createMemo(() => {
    const result: number[] = []
    for (let i = verbatimStart(); i < adventureStore.turns.length; i++) {
      result.push(i)
    }
    return result
  })

  return (
    <>
      <div
        class={styles.storyArea}
        ref={engine.setStoryAreaRef}
        onScroll={engine.onStoryAreaScroll}
      >
        <Show
          when={adventureStore.turns.length > 0 || adventureStore.isGenerating}
          fallback={
            <div class={styles.emptyState}>
              <div class={styles.emptyStateIcon}>⏳</div>
              <Text size="lg" color="secondary">
                Preparing your adventure...
              </Text>
            </div>
          }
        >
          {/* Compacted ranges */}
          <For each={ranges()}>
            {(range) => <CompactionBlock range={range} />}
          </For>

          {/* Gap turns (between last compaction and verbatim window) */}
          <For each={gapIndices()}>
            {(turnIndex) => renderTurn(turnIndex, engine)}
          </For>

          {/* Recent verbatim turns */}
          <For each={verbatimIndices()}>
            {(turnIndex) => renderTurn(turnIndex, engine)}
          </For>

          {/* Gate approval panel — shown while a storyline-gate brief is
              awaiting accept/reject. The narrative pass is parked behind
              this; the user picks accept (proceed with brief), reject
              (proceed without arc context this beat), or cancels via the
              normal abort button. */}
          <Show when={adventureStore.pendingGateBrief}>
            <div class={styles.nonsenseWarning}>
              <div class={styles.nonsenseWarningHeader}>
                🧵 Storyline brief — review before {adventureStore.pendingGateKind === 'world-step' ? 'world step' : 'this turn'}
              </div>
              <div
                class={styles.nonsenseWarningContent}
                style={{ 'white-space': 'pre-wrap' }}
              >
                {adventureStore.pendingGateBrief}
              </div>
              <div class={styles.nonsenseWarningActions}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => engine.acceptGateBrief()}
                >
                  Accept &amp; continue
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => engine.rejectGateBrief()}
                  title="Generate this turn without forwarding any storyline context"
                >
                  Reject (skip arc context)
                </Button>
              </div>
            </div>
          </Show>

          {/* Nonsense warning */}
          <Show when={adventureStore.nonsenseWarning && !adventureStore.isGenerating}>
            <div class={styles.nonsenseWarning}>
              <div class={styles.nonsenseWarningHeader}>
                ⚠️ Potential issues detected
              </div>
              <div class={styles.nonsenseWarningContent}>
                {adventureStore.nonsenseWarning}
              </div>
              <div class={styles.nonsenseWarningActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => engine.handleReviseNarrative()}
                >
                  Revise narrative
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => adventureStore.setNonsenseWarning(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </Show>

          {/* Streaming content for current generation */}
          <Show when={adventureStore.isGenerating}>
            {(() => {
              const isWorldStepStreaming = () =>
                adventureStore.streamingKind === 'world-step'
              return (
                <div
                  class={
                    isWorldStepStreaming() ? styles.worldStepTurn : styles.turn
                  }
                >
                  <Show when={isWorldStepStreaming()}>
                    <div
                      class={
                        adventureStore.autoAdvanceWorld
                          ? `${styles.worldStepChip} ${styles.worldStepChipAuto}`
                          : styles.worldStepChip
                      }
                    >
                      — the world moves —
                    </div>
                  </Show>
                  <Show
                    when={
                      adventureStore.pendingAction && !isWorldStepStreaming()
                    }
                  >
                    <div class={styles.playerAction}>
                      <span class={styles.playerActionLabel}>You:</span>
                      {adventureStore.pendingAction}
                    </div>
                  </Show>
                  <Show when={adventureStore.streamingSteering}>
                    {(s) => (
                      <div
                        class={`${styles.steeringChip} ${steeringClass(s())}`}
                      >
                        {steeringLabel(s())}
                      </div>
                    )}
                  </Show>
                  {renderStreamingContent()}
                </div>
              )
            })()}
          </Show>
        </Show>

        <Show when={adventureStore.error}>
          <div class={styles.turn}>
            <Show when={adventureStore.lastFailedAction}>
              {(action) => (
                <div class={styles.playerAction}>
                  <span class={styles.playerActionLabel}>You:</span>
                  {action()}
                </div>
              )}
            </Show>
            <div class={styles.errorRow}>
              <div class={styles.errorText}>Error: {adventureStore.error}</div>
              <Show when={adventureStore.lastFailedAction !== undefined}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={engine.handleRetry}
                >
                  Retry
                </Button>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      <Show when={!adventureStore.scrollLocked && adventureStore.isGenerating}>
        <button class={styles.scrollToBottom} onClick={engine.scrollToBottom}>
          ↓ Scroll to latest
        </button>
      </Show>

      <div class={styles.inputArea}>
          <div class={styles.inputWrapper}>
            <textarea
              ref={engine.setInputRef}
              class={styles.input}
              value={adventureStore.playerInput}
              onInput={(e) =>
                adventureStore.setPlayerInput(e.currentTarget.value)
              }
              onKeyDown={engine.handleKeyDown}
              placeholder={
                adventureStore.isGenerating
                  ? 'Waiting for the story...'
                  : 'What do you do?'
              }
              disabled={adventureStore.isGenerating}
              rows={1}
            />
            <Show
              when={!adventureStore.isGenerating}
              fallback={
                <Button variant="danger" onClick={engine.handleAbort}>
                  Stop
                </Button>
              }
            >
              <Show when={adventureStore.turns.length > 0}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    engine
                      .runAnalysisPass()
                      .then(() => engine.runSynthesisPass())
                      .catch((err) =>
                        console.warn(
                          '[Analysis→Synthesis] manual chain error:',
                          err,
                        ),
                      )
                  }
                  disabled={
                    adventureStore.isAnalyzing ||
                    adventureStore.isSynthesizing
                  }
                  title={
                    adventureStore.isAnalyzing
                      ? 'Analysis already running'
                      : adventureStore.isSynthesizing
                        ? 'Synthesis already running'
                        : 'Re-run the analysis + synthesis passes against the current world state and last turn(s)'
                  }
                >
                  🔍
                </Button>
              </Show>
              <Button
                variant="primary"
                onClick={engine.handleSubmit}
                disabled={!adventureStore.playerInput.trim()}
              >
                Act
              </Button>
            </Show>
          </div>
        </div>
    </>
  )
}
