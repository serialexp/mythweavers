import type { Paragraph, ParagraphInventoryAction } from '@mythweavers/shared'
import { DecorationSet, InlineContent, type NodeViewProps, WidgetsAt, setPosInfo } from '@writer/solid-editor'
import { type Accessor, For, type JSX, Show, createEffect } from 'solid-js'
import { inventoryBadge, inventoryBadgeAdd, inventoryBadgeRemove, inventoryBadgesContainer } from '../scene-editor.css'

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
export function createParagraphStateNodeView(paragraphs: Accessor<Paragraph[]>): (props: NodeViewProps) => JSX.Element {
  return function ParagraphStateView(props: NodeViewProps): JSX.Element {
    let elementRef: HTMLParagraphElement | undefined

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

    // Keep position info updated reactively
    createEffect(() => {
      if (elementRef) {
        setPosInfo(elementRef, { pos: props.pos, node: props.node })
      }
    })

    return (
      <p
        id={paragraphId() || undefined}
        data-state={paragraphState()}
        data-has-script={hasScript() || undefined}
        data-has-inventory={hasInventory() || undefined}
        data-extra={extra() || undefined}
        data-extra-loading={extraLoading() || undefined}
        class="solid-editor-paragraph"
        ref={(el) => (elementRef = el)}
      >
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
