import type { ParagraphState } from '@mythweavers/shared'
import type { EditorState } from '@writer/solid-editor'
import { DecorationSet, widget } from '@writer/solid-editor'
import { type Accessor, type JSX, Show } from 'solid-js'
import { useThemeClass } from '../../../theme/ThemeClassContext'
import { Button } from '../../Button'
import { Dropdown, DropdownDivider, DropdownItem } from '../../Dropdown'
import { paragraphActionButton, paragraphActionButtonContainer } from '../scene-editor.css'
import { getParagraphIdAtPos, getParagraphRange } from '../solid-editor/paragraph-conversion'

/**
 * Configuration for paragraph actions
 */
export interface ParagraphActionsConfig {
  onMoveUp?: (paragraphId: string) => void
  onMoveDown?: (paragraphId: string) => void
  onDelete?: (paragraphId: string) => void
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

/**
 * Check if any actions are configured
 */
function hasAnyAction(config: ParagraphActionsConfig): boolean {
  return !!(
    config.onMoveUp ||
    config.onMoveDown ||
    config.onDelete ||
    config.onGenerateBetween ||
    config.onSpellCheck ||
    config.onRewrite ||
    config.onRefineStyle ||
    config.onAddSensory ||
    config.onSetState ||
    config.onToggleInventory ||
    config.onTogglePlotpoint ||
    config.onEditScript ||
    config.onCustomRewrite ||
    config.onConvertPerspective ||
    config.onSplitScene
  )
}

/**
 * The action button widget component rendered via decoration
 */
function ParagraphActionButton(props: { paragraphId: string; config: ParagraphActionsConfig }): JSX.Element {
  const themeClass = useThemeClass()
  const isDisabled = () => !props.config.isProtagonistSet

  // Don't render if no actions
  if (!hasAnyAction(props.config)) {
    return <></>
  }

  const trigger = (
    <Button variant="ghost" size="sm" iconOnly class={paragraphActionButton} tabIndex={-1}>
      ⋮
    </Button>
  )

  return (
    <span
      class={`${themeClass || ''} ${paragraphActionButtonContainer}`}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Dropdown trigger={trigger} alignRight portal>
        {/* Movement section */}
        <Show when={props.config.onMoveUp}>
          <DropdownItem onClick={() => props.config.onMoveUp!(props.paragraphId)}>↑ Move up</DropdownItem>
        </Show>
        <Show when={props.config.onMoveDown}>
          <DropdownItem onClick={() => props.config.onMoveDown!(props.paragraphId)}>↓ Move down</DropdownItem>
        </Show>
        <Show when={props.config.onGenerateBetween}>
          <DropdownItem
            onClick={() => props.config.onGenerateBetween!(props.paragraphId)}
            disabled={isDisabled()}
          >
            ✨ Generate after
          </DropdownItem>
        </Show>

        <Show when={props.config.onMoveUp || props.config.onMoveDown || props.config.onGenerateBetween}>
          <DropdownDivider />
        </Show>

        {/* AI Tools section */}
        <Show when={props.config.onSpellCheck}>
          <DropdownItem onClick={() => props.config.onSpellCheck!(props.paragraphId)} disabled={isDisabled()}>
            📝 Fix spelling
          </DropdownItem>
        </Show>
        <Show when={props.config.onRewrite}>
          <DropdownItem onClick={() => props.config.onRewrite!(props.paragraphId)} disabled={isDisabled()}>
            🔄 Rewrite
          </DropdownItem>
        </Show>
        <Show when={props.config.onRefineStyle}>
          <DropdownItem onClick={() => props.config.onRefineStyle!(props.paragraphId)} disabled={isDisabled()}>
            ⭐ Refine style
          </DropdownItem>
        </Show>
        <Show when={props.config.onAddSensory}>
          <DropdownItem onClick={() => props.config.onAddSensory!(props.paragraphId)} disabled={isDisabled()}>
            👁 Add sensory
          </DropdownItem>
        </Show>

        <Show
          when={
            props.config.onSpellCheck || props.config.onRewrite || props.config.onRefineStyle || props.config.onAddSensory
          }
        >
          <DropdownDivider />
        </Show>

        {/* More AI Tools */}
        <Show when={props.config.onCustomRewrite}>
          <DropdownItem onClick={() => props.config.onCustomRewrite!(props.paragraphId)} disabled={isDisabled()}>
            ✏️ Custom rewrite
          </DropdownItem>
        </Show>
        <Show when={props.config.onConvertPerspective}>
          <DropdownItem onClick={() => props.config.onConvertPerspective!(props.paragraphId)} disabled={isDisabled()}>
            👤 Convert perspective
          </DropdownItem>
        </Show>

        <Show when={props.config.onCustomRewrite || props.config.onConvertPerspective}>
          <DropdownDivider />
        </Show>

        {/* Script & Inventory section */}
        <Show when={props.config.onEditScript}>
          <DropdownItem onClick={() => props.config.onEditScript!(props.paragraphId)}>
            {'{ }'} Edit script/inventory
          </DropdownItem>
        </Show>
        <Show when={props.config.onToggleInventory}>
          <DropdownItem onClick={() => props.config.onToggleInventory!(props.paragraphId)}>
            📦 Toggle inventory
          </DropdownItem>
        </Show>
        <Show when={props.config.onTogglePlotpoint}>
          <DropdownItem onClick={() => props.config.onTogglePlotpoint!(props.paragraphId)}>
            📍 Toggle plotpoint
          </DropdownItem>
        </Show>

        <Show when={props.config.onEditScript || props.config.onToggleInventory || props.config.onTogglePlotpoint}>
          <DropdownDivider />
        </Show>

        {/* State section */}
        <Show when={props.config.onSetState}>
          <DropdownItem onClick={() => props.config.onSetState!(props.paragraphId, 'draft')}>
            D Set as Draft
          </DropdownItem>
          <DropdownItem onClick={() => props.config.onSetState!(props.paragraphId, 'revise')}>
            R Set as Revise
          </DropdownItem>
          <DropdownItem onClick={() => props.config.onSetState!(props.paragraphId, 'ai')}>A Set as AI</DropdownItem>
          <DropdownItem onClick={() => props.config.onSetState!(props.paragraphId, 'final')}>
            F Set as Final
          </DropdownItem>
          <DropdownDivider />
        </Show>

        {/* Management section */}
        <Show when={props.config.onSplitScene}>
          <DropdownItem onClick={() => props.config.onSplitScene!(props.paragraphId)}>
            ✂️ Split into scene
          </DropdownItem>
        </Show>
        <Show when={props.config.onDelete}>
          <DropdownItem onClick={() => props.config.onDelete!(props.paragraphId)} danger>
            🗑 Delete
          </DropdownItem>
        </Show>
      </Dropdown>
    </span>
  )
}

/**
 * Creates decorations for paragraph actions.
 * Returns a function that computes decorations based on current editor state.
 */
export function createParagraphActionsDecorations(
  config: Accessor<ParagraphActionsConfig>,
  isFocused: Accessor<boolean>,
) {
  return (state: EditorState): DecorationSet => {
    // Don't show when editor is not focused
    if (!isFocused()) {
      return DecorationSet.empty
    }

    const { selection } = state

    // Only show for cursor (empty selection)
    if (selection.from !== selection.to) {
      return DecorationSet.empty
    }

    const paragraphId = getParagraphIdAtPos(state.doc, selection.from)
    if (!paragraphId) {
      return DecorationSet.empty
    }

    // Get paragraph range
    const range = getParagraphRange(state.doc, paragraphId)
    if (!range) {
      return DecorationSet.empty
    }

    // Create widget at the end of the paragraph (before closing tag)
    // Position it at range.to - 1 to be inside the paragraph
    const widgetPos = range.to - 1

    const decoration = widget(
      widgetPos,
      () => <ParagraphActionButton paragraphId={paragraphId} config={config()} />,
      {
        side: 1, // Render after content at this position
        key: `paragraph-actions-${paragraphId}`,
        ignoreSelection: true,
      },
    )

    return DecorationSet.create(state.doc, [decoration])
  }
}
