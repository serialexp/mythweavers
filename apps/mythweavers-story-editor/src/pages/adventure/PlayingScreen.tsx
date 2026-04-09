import { type Component, For, Show } from 'solid-js'
import { Button, Text } from '@mythweavers/ui'
import { adventureStore } from '../../stores/adventureStore'
import { useEngine } from './useAdventureEngine'
import * as styles from '../AdventurePage.css'

// --- Render helpers ---

function renderNarrative(text: string, dead?: boolean) {
  const displayText = dead
    ? text
        .replace(
          /\n+\s*(?:what do you do\??|what will you do\??|what's your (?:next )?move\??|how do you (?:respond|react)\??)\.?\s*$/i,
          '',
        )
        .trim()
    : text
  const paragraphs = displayText.split('\n\n').filter((p) => p.trim())
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

  const paragraphs = displayText.split('\n\n').filter((p) => p.trim())
  return (
    <div class={styles.streamingContent}>
      <For each={paragraphs}>
        {(paragraph) => (
          <p class={styles.streamingParagraph}>{paragraph.trim()}</p>
        )}
      </For>
      <div class={styles.streamingIndicator}>
        <div class={styles.streamingDot} />
      </div>
    </div>
  )
}

// --- Component ---

export const PlayingScreen: Component = () => {
  const engine = useEngine()

  const isDead = () => {
    const t = adventureStore.turns
    return t.length > 0 && t[t.length - 1].dead
  }

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
          <For each={adventureStore.turns}>
            {(turn, index) => (
              <div class={styles.turn}>
                <Show when={turn.playerAction}>
                  <div class={styles.playerAction}>
                    <span class={styles.playerActionLabel}>You:</span>
                    {turn.playerAction}
                  </div>
                </Show>

                {renderNarrative(turn.narrative, turn.dead)}

                <div class={styles.turnFooter}>
                  <Show when={turn.worldTrajectory}>
                    <div
                      class={styles.worldTrajectory}
                      onClick={() =>
                        adventureStore.toggleTrajectory(index())
                      }
                    >
                      <div class={styles.worldTrajectoryLabel}>
                        {adventureStore.isTrajectoryExpanded(index())
                          ? '▾'
                          : '▸'}{' '}
                        World Momentum
                      </div>
                      <Show
                        when={adventureStore.isTrajectoryExpanded(index())}
                      >
                        <div class={styles.worldTrajectoryContent}>
                          {turn.worldTrajectory}
                        </div>
                      </Show>
                    </div>
                  </Show>

                  <Show
                    when={
                      !adventureStore.isGenerating &&
                      index() < adventureStore.turns.length - 1
                    }
                  >
                    <button
                      class={styles.rewindButton}
                      onClick={() => engine.handleRewindTo(index())}
                      title={`Rewind to this point (removes ${adventureStore.turns.length - 1 - index()} turn${adventureStore.turns.length - 1 - index() > 1 ? 's' : ''})`}
                    >
                      ↩ Rewind here
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>

          {/* Death screen */}
          <Show when={isDead()}>
            <div class={styles.deathScreen}>
              <div class={styles.deathIcon}>💀</div>
              <Text size="lg" weight="bold">
                You have perished
              </Text>
              <Text color="secondary">
                Your adventure ended after {adventureStore.turns.length} turn
                {adventureStore.turns.length !== 1 ? 's' : ''}.
              </Text>
              <div class={styles.deathActions}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    engine.handleRewindTo(
                      Math.max(0, adventureStore.turns.length - 2),
                    )
                  }
                >
                  ↩ Rewind one turn
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={engine.handleReset}
                >
                  New Adventure
                </Button>
              </div>
            </div>
          </Show>

          {/* Streaming content for current generation */}
          <Show when={adventureStore.isGenerating}>
            <div class={styles.turn}>
              <Show when={adventureStore.pendingAction}>
                <div class={styles.playerAction}>
                  <span class={styles.playerActionLabel}>You:</span>
                  {adventureStore.pendingAction}
                </div>
              </Show>
              {renderStreamingContent()}
            </div>
          </Show>
        </Show>

        <Show when={adventureStore.error}>
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
        </Show>
      </div>

      <Show when={!adventureStore.scrollLocked && adventureStore.isGenerating}>
        <button class={styles.scrollToBottom} onClick={engine.scrollToBottom}>
          ↓ Scroll to latest
        </button>
      </Show>

      <Show when={!isDead()}>
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
                  onClick={engine.handleRegenerate}
                  title="Regenerate the last turn"
                >
                  ↻
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
      </Show>
    </>
  )
}
