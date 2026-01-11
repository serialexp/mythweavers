import type { ParagraphState } from '@mythweavers/shared'
import type { EditorState } from '@writer/solid-editor'
import { type Accessor, type JSX, Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useThemeClass } from '../../../theme/ThemeClassContext'
import { Button } from '../../Button'
import { paragraphActionsGroup, paragraphActionsMenu } from '../scene-editor.css'
import { getParagraphIdAtPos, getParagraphRange } from '../solid-editor/paragraph-conversion'

/**
 * Configuration for paragraph actions
 */
export interface ParagraphActionsConfig {
  onMoveUp?: (paragraphId: string) => void
  onMoveDown?: (paragraphId: string) => void
  onDelete?: (paragraphId: string) => void
  onAddAfter?: (paragraphId: string) => void
  onGenerateBetween?: (paragraphId: string) => void
  onSpellCheck?: (paragraphId: string) => void
  onRewrite?: (paragraphId: string) => void
  onRefineStyle?: (paragraphId: string) => void
  onAddSensory?: (paragraphId: string) => void
  onSetState?: (paragraphId: string, state: ParagraphState) => void
  onToggleInventory?: (paragraphId: string) => void
  onTogglePlotpoint?: (paragraphId: string) => void
  onEditScript?: (paragraphId: string) => void
  onCustomRewrite?: (paragraphId: string) => void
  onConvertPerspective?: (paragraphId: string) => void
  onSplitScene?: (paragraphId: string) => void
  isProtagonistSet?: boolean
}

interface MenuPosition {
  top: number
  left: number
}

export interface ParagraphActionsProps {
  /** Accessor for current editor state */
  state: Accessor<EditorState | null>
  /** Actions configuration */
  config: ParagraphActionsConfig
  /** Reference to the editor container for positioning */
  editorRef?: Accessor<HTMLElement | null>
  /** Whether the editor is currently focused */
  isFocused?: Accessor<boolean>
}

/**
 * Action button component
 */
function ActionButton(props: {
  icon: string
  title: string
  onClick: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      manualPress
      title={props.title}
      disabled={props.disabled}
      onClick={(e) => {
        e.stopPropagation()
        if (!props.disabled) {
          props.onClick()
        }
      }}
    >
      {props.icon}
    </Button>
  )
}

/**
 * Paragraph actions menu component.
 * Renders a floating menu above the active paragraph with various actions.
 */
export function ParagraphActionsMenu(props: ParagraphActionsProps): JSX.Element {
  const [position, setPosition] = createSignal<MenuPosition | null>(null)
  const [currentParagraphId, setCurrentParagraphId] = createSignal<string | null>(null)

  // Update position based on paragraph element's current location
  const updatePosition = () => {
    const paragraphId = currentParagraphId()
    if (!paragraphId) return

    const paragraphEl = document.getElementById(paragraphId)
    if (paragraphEl) {
      const rect = paragraphEl.getBoundingClientRect()
      // Using position: fixed, so use viewport-relative coordinates
      setPosition({
        top: rect.top - 48, // Above paragraph
        left: rect.left,
      })
    }
  }

  // Track active paragraph and update position
  createEffect(() => {
    const state = props.state()
    if (!state) {
      setPosition(null)
      setCurrentParagraphId(null)
      return
    }

    const { selection } = state

    // Only show for cursor (empty selection)
    if (selection.from !== selection.to) {
      setPosition(null)
      setCurrentParagraphId(null)
      return
    }

    const paragraphId = getParagraphIdAtPos(state.doc, selection.from)
    if (!paragraphId) {
      setPosition(null)
      setCurrentParagraphId(null)
      return
    }

    setCurrentParagraphId(paragraphId)

    // Get paragraph range for positioning
    const range = getParagraphRange(state.doc, paragraphId)
    if (!range) {
      setPosition(null)
      return
    }

    // Update position immediately
    const paragraphEl = document.getElementById(paragraphId)
    if (paragraphEl) {
      const rect = paragraphEl.getBoundingClientRect()
      setPosition({
        top: rect.top - 48,
        left: rect.left,
      })
    }
  })

  // Update position on scroll to keep menu anchored to paragraph
  createEffect(() => {
    if (!currentParagraphId()) return

    const handleScroll = () => updatePosition()
    window.addEventListener('scroll', handleScroll, true) // Use capture to catch all scroll events

    onCleanup(() => {
      window.removeEventListener('scroll', handleScroll, true)
    })
  })

  // Cleanup on unmount
  onCleanup(() => {
    setPosition(null)
  })

  const config = () => props.config
  const isDisabled = () => !config().isProtagonistSet
  const themeClass = useThemeClass()

  // Check if editor is focused (default to true if not provided for backwards compatibility)
  const editorFocused = () => props.isFocused?.() ?? true

  // Check if any actions are configured - don't show menu if nothing to display
  const hasAnyAction = () => {
    const c = config()
    return !!(
      c.onMoveUp ||
      c.onMoveDown ||
      c.onDelete ||
      c.onAddAfter ||
      c.onGenerateBetween ||
      c.onSpellCheck ||
      c.onRewrite ||
      c.onRefineStyle ||
      c.onAddSensory ||
      c.onSetState ||
      c.onToggleInventory ||
      c.onTogglePlotpoint ||
      c.onEditScript ||
      c.onCustomRewrite ||
      c.onConvertPerspective ||
      c.onSplitScene
    )
  }

  return (
    <Show when={position() && currentParagraphId() && editorFocused() && hasAnyAction()}>
      <Portal>
        <div
          class={`${themeClass || ''} ${paragraphActionsMenu}`}
          style={{
            position: 'fixed',
            top: `${position()!.top}px`,
            left: `${position()!.left}px`,
            'z-index': '1000',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Movement group */}
          <div class={paragraphActionsGroup}>
            <Show when={config().onMoveUp}>
              <ActionButton
                icon="↑"
                title="Move paragraph up"
                onClick={() => config().onMoveUp!(currentParagraphId()!)}
              />
            </Show>
            <Show when={config().onMoveDown}>
              <ActionButton
                icon="↓"
                title="Move paragraph down"
                onClick={() => config().onMoveDown!(currentParagraphId()!)}
              />
            </Show>
            <Show when={config().onGenerateBetween}>
              <ActionButton
                icon="✨"
                title="Generate content after this paragraph"
                onClick={() => config().onGenerateBetween!(currentParagraphId()!)}
                disabled={isDisabled()}
              />
            </Show>
          </div>

          {/* AI Tools group */}
          <div class={paragraphActionsGroup}>
            <Show when={config().onSpellCheck}>
              <ActionButton
                icon="📝"
                title="Fix spelling and grammar"
                onClick={() => config().onSpellCheck!(currentParagraphId()!)}
                disabled={isDisabled()}
              />
            </Show>
            <Show when={config().onRewrite}>
              <ActionButton
                icon="🔄"
                title="Rewrite with style improvements"
                onClick={() => config().onRewrite!(currentParagraphId()!)}
                disabled={isDisabled()}
              />
            </Show>
            <Show when={config().onRefineStyle}>
              <ActionButton
                icon="⭐"
                title="Refine paragraph style"
                onClick={() => config().onRefineStyle!(currentParagraphId()!)}
                disabled={isDisabled()}
              />
            </Show>
            <Show when={config().onAddSensory}>
              <ActionButton
                icon="👁"
                title="Add sensory details"
                onClick={() => config().onAddSensory!(currentParagraphId()!)}
                disabled={isDisabled()}
              />
            </Show>
          </div>

          {/* Context/Script group */}
          <Show when={config().onToggleInventory || config().onTogglePlotpoint || config().onEditScript}>
            <div class={paragraphActionsGroup}>
              <Show when={config().onEditScript}>
                <ActionButton
                  icon="{ }"
                  title="Edit paragraph script"
                  onClick={() => config().onEditScript!(currentParagraphId()!)}
                />
              </Show>
              <Show when={config().onToggleInventory}>
                <ActionButton
                  icon="📦"
                  title="Toggle inventory actions"
                  onClick={() => config().onToggleInventory!(currentParagraphId()!)}
                />
              </Show>
              <Show when={config().onTogglePlotpoint}>
                <ActionButton
                  icon="📍"
                  title="Toggle plotpoint actions"
                  onClick={() => config().onTogglePlotpoint!(currentParagraphId()!)}
                />
              </Show>
            </div>
          </Show>

          {/* More AI Tools group */}
          <Show when={config().onCustomRewrite || config().onConvertPerspective}>
            <div class={paragraphActionsGroup}>
              <Show when={config().onCustomRewrite}>
                <ActionButton
                  icon="✏️"
                  title="Custom rewrite instructions"
                  onClick={() => config().onCustomRewrite!(currentParagraphId()!)}
                  disabled={isDisabled()}
                />
              </Show>
              <Show when={config().onConvertPerspective}>
                <ActionButton
                  icon="👤"
                  title="Convert to first person"
                  onClick={() => config().onConvertPerspective!(currentParagraphId()!)}
                  disabled={isDisabled()}
                />
              </Show>
            </div>
          </Show>

          {/* State group */}
          <Show when={config().onSetState}>
            <div class={paragraphActionsGroup}>
              <ActionButton
                icon="D"
                title="Set as Draft"
                onClick={() => config().onSetState!(currentParagraphId()!, 'draft')}
              />
              <ActionButton
                icon="R"
                title="Set as Revise"
                onClick={() => config().onSetState!(currentParagraphId()!, 'revise')}
              />
              <ActionButton
                icon="A"
                title="Set as AI"
                onClick={() => config().onSetState!(currentParagraphId()!, 'ai')}
              />
              <ActionButton
                icon="F"
                title="Set as Final"
                onClick={() => config().onSetState!(currentParagraphId()!, 'final')}
              />
            </div>
          </Show>

          {/* Management group */}
          <div class={paragraphActionsGroup}>
            <Show when={config().onSplitScene}>
              <ActionButton
                icon="✂️"
                title="Split into new scene"
                onClick={() => config().onSplitScene!(currentParagraphId()!)}
              />
            </Show>
            <Show when={config().onAddAfter}>
              <ActionButton
                icon="+"
                title="Add paragraph after"
                onClick={() => config().onAddAfter!(currentParagraphId()!)}
              />
            </Show>
            <Show when={config().onDelete}>
              <ActionButton
                icon="🗑"
                title="Delete paragraph"
                onClick={() => config().onDelete!(currentParagraphId()!)}
              />
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  )
}

/**
 * Factory function matching the plugin pattern.
 * Returns props that should be passed to the ParagraphActionsMenu component.
 */
export function createParagraphActionsPlugin(config: ParagraphActionsConfig) {
  return {
    config,
    Component: ParagraphActionsMenu,
  }
}
