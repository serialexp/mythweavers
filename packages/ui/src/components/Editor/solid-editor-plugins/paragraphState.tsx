import type { Paragraph } from '@mythweavers/shared'
import { DecorationSet, InlineContent, type NodeViewProps, setPosInfo } from '@writer/solid-editor'
import { type Accessor, type JSX, createEffect } from 'solid-js'

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

    // Find paragraph state from external data
    const paragraphState = () => {
      const id = paragraphId()
      if (!id) return 'draft'
      const paragraph = paragraphs().find((p) => p.id === id)
      return paragraph?.state || 'draft'
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
        data-extra={extra() || undefined}
        data-extra-loading={extraLoading() || undefined}
        class="solid-editor-paragraph"
        ref={(el) => (elementRef = el)}
      >
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
