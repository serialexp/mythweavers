import type { Paragraph, ParagraphInventoryAction, ParagraphState } from '@mythweavers/shared'
import { DecorationSet, InlineContent, type NodeViewProps, WidgetsAt, setPosInfo } from '@serialexp/solidjs-editor'
import { type Accessor, For, type JSX, Show, createEffect, createSignal, onCleanup } from 'solid-js'
import {
  inventoryBadge,
  inventoryBadgeAdd,
  inventoryBadgeRemove,
  inventoryBadgesContainer,
  paragraphStateHitArea,
  paragraphStatePicker,
  paragraphStatePickerButton,
} from '../scene-editor.css'

const STATE_OPTIONS: Array<{ id: ParagraphState; label: string; title: string }> = [
  { id: 'draft', label: 'Draft', title: 'Set as Draft' },
  { id: 'revise', label: 'Revise', title: 'Set as Revise' },
  { id: 'ai', label: 'AI', title: 'Set as AI' },
  { id: 'final', label: 'Final', title: 'Set as Final' },
]

/**
 * Creates a paragraph nodeView factory that renders paragraphs with
 * data-state and data-id attributes based on external paragraph data.
 *
 * This is used via the nodeViews prop on EditorView, not as a plugin.
 *
 * Usage:
 * ```tsx
 * const paragraphView = createParagraphStateNodeView(() => paragraphs)
 *
 * <EditorView
 *   nodeViews={{ paragraph: paragraphView }}
 *   ...
 * />
 * ```
 */
export function createParagraphStateNodeView(
  paragraphs: Accessor<Paragraph[]>,
  onSetState?: (paragraphId: string, state: ParagraphState) => void,
): (props: NodeViewProps) => JSX.Element {
  return function ParagraphStateView(props: NodeViewProps): JSX.Element {
    let elementRef: HTMLParagraphElement | undefined
    const [pickerOpen, setPickerOpen] = createSignal(false)

    const paragraphId = () => props.node.attrs.id as string | null
    const extra = () => props.node.attrs.extra as string | null
    const extraLoading = () => props.node.attrs.extraLoading as string | null

    // Find paragraph data from external data
    const paragraphData = () => {
      const id = paragraphId()
      if (!id) return null
      return paragraphs().find((p) => p.id === id) || null
    }

    // Get paragraph state
    const paragraphState = () => paragraphData()?.state || 'draft'

    // Check if paragraph has script or inventory actions
    const hasScript = () => {
      const data = paragraphData()
      return !!(data?.script && data.script.trim())
    }

    const hasInventory = () => {
      const data = paragraphData()
      return !!(data?.inventoryActions && data.inventoryActions.length > 0)
    }

    // Get inventory actions for display
    const inventoryActions = () => paragraphData()?.inventoryActions || []

    // Format an inventory action for display
    const formatInventoryAction = (action: ParagraphInventoryAction) => {
      const sign = action.type === 'add' ? '+' : '-'
      const amount = action.item_amount > 1 ? ` ×${action.item_amount}` : ''
      return `${sign}${action.item_name}${amount}`
    }

    // Get inline decorations for this paragraph's content
    // Note: For block nodes, content starts at pos + 1
    const inlineDecorations = () => {
      if (!props.decorations) return undefined
      const contentStart = props.pos + 1
      const contentEnd = props.pos + 1 + props.node.content.size
      const inlines = props.decorations.findInlineIn(contentStart, contentEnd)
      if (inlines.length === 0) return undefined
      return DecorationSet.create(props.node, inlines)
    }

    // Pick up node-level decoration attrs (e.g. `class: 'active-paragraph'`
    // from the active-paragraph plugin). The default ParagraphView in the
    // solid-editor package does this via internal helpers; we replicate it
    // here so custom NodeViews don't lose node-decoration attributes.
    const nodeDecoration = () => {
      if (!props.decorations) return null
      return props.decorations.findNodeAt(props.pos, props.pos + props.node.nodeSize) ?? null
    }

    // Merge the base paragraph class with any class coming from a node
    // decoration. Everything beyond `class` goes through the attrs spread.
    const decorationClass = () => nodeDecoration()?.attrs.class ?? ''
    const mergedClass = () => ['solidjs-editor-paragraph', decorationClass()].filter(Boolean).join(' ')

    // Keep position info updated reactively
    createEffect(() => {
      if (elementRef) {
        setPosInfo(elementRef, { pos: props.pos, node: props.node })
      }
    })

    // Close the state picker on any click outside it.
    createEffect(() => {
      if (!pickerOpen()) return
      const onDocClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null
        if (!target?.closest('[data-paragraph-state-picker]')) {
          setPickerOpen(false)
        }
      }
      // Defer so the click that opened the picker doesn't immediately close it.
      const t = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0)
      onCleanup(() => {
        clearTimeout(t)
        document.removeEventListener('mousedown', onDocClick)
      })
    })

    const handleHitAreaClick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setPickerOpen((v) => !v)
    }

    const applyState = (state: ParagraphState) => {
      const id = paragraphId()
      if (!id) return
      onSetState?.(id, state)
      setPickerOpen(false)
    }

    return (
      <p
        id={paragraphId() || undefined}
        data-state={paragraphState()}
        data-has-script={hasScript() || undefined}
        data-has-inventory={hasInventory() || undefined}
        data-extra={extra() || undefined}
        data-extra-loading={extraLoading() || undefined}
        class={mergedClass()}
        ref={(el) => (elementRef = el)}
      >
        {/* Clickable hit area over the colored left border — opens the state picker */}
        <Show when={onSetState}>
          <span
            class={paragraphStateHitArea}
            contentEditable={false}
            data-paragraph-state-picker
            title="Change paragraph state"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleHitAreaClick}
          />
        </Show>

        {/* Floating state picker */}
        <Show when={onSetState && pickerOpen()}>
          <span
            class={paragraphStatePicker}
            contentEditable={false}
            data-paragraph-state-picker
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <For each={STATE_OPTIONS}>
              {(opt) => (
                <button
                  type="button"
                  class={paragraphStatePickerButton}
                  data-state={opt.id}
                  data-active={paragraphState() === opt.id ? 'true' : undefined}
                  title={opt.title}
                  onClick={() => applyState(opt.id)}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </span>
        </Show>

        {/* Widgets at start of paragraph content (position after opening tag) */}
        <Show when={props.decorations}>
          <WidgetsAt decorations={props.decorations!} pos={props.pos + 1} side="before" />
        </Show>

        {props.node.content.size > 0 ? (
          <InlineContent
            node={props.node}
            startPos={props.pos + 1}
            decorations={inlineDecorations()}
            nodeViews={props.nodeViews}
            selection={props.selection}
            onSelectNode={props.onSelectNode}
          />
        ) : (
          <br />
        )}

        {/* Widgets at end of paragraph content (position before closing tag) */}
        <Show when={props.decorations}>
          <WidgetsAt decorations={props.decorations!} pos={props.pos + 1 + props.node.content.size} side="after" />
        </Show>

        {/* Inventory action badges - clickable to open inventory modal */}
        <Show when={inventoryActions().length > 0}>
          <span
            class={inventoryBadgesContainer}
            contentEditable={false}
            data-paragraph-action="edit-inventory"
            data-paragraph-id={paragraphId()}
          >
            <For each={inventoryActions()}>
              {(action) => (
                <span
                  class={`${inventoryBadge} ${action.type === 'add' ? inventoryBadgeAdd : inventoryBadgeRemove}`}
                >
                  {formatInventoryAction(action)}
                </span>
              )}
            </For>
          </span>
        </Show>
      </p>
    ) as JSX.Element
  }
}

/**
 * For backwards compatibility, also export as a "plugin" factory.
 * This returns the nodeViews configuration that should be merged into EditorView props.
 */
export function createParagraphStatePlugin(paragraphs: Accessor<Paragraph[]>) {
  return {
    nodeViews: {
      paragraph: createParagraphStateNodeView(paragraphs),
    },
  }
}
