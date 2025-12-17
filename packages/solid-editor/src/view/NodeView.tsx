import { For, Index, type JSX, Show, createEffect } from 'solid-js'
import type { Node as PMNode } from '../model'
import { InlineContent } from './TextView'
import { DecorationSet, type NodeDecoration } from './decoration'
import { setPosInfo } from './selection'

import type { Selection } from '../state'

export interface NodeViewProps {
  /** The node to render */
  node: PMNode
  /** Document position of this node */
  pos: number
  /** Custom node views for specific node types */
  nodeViews?: NodeViewMap
  /** Decorations to render */
  decorations?: DecorationSet
  /** Whether this node is selected (cursor is inside or node is fully selected) */
  selected?: boolean
  /** Current selection (for passing to children) */
  selection?: Selection
  /** Callback to select this node (called by node views that want click-to-select behavior) */
  onSelect?: () => void
  /** Callback to select a node by position range (passed down for inline node selection) */
  onSelectNode?: (from: number, to: number) => void
}

/**
 * Map of node type names to custom view components
 */
export type NodeViewMap = {
  [nodeType: string]: (props: NodeViewProps) => JSX.Element
}

/**
 * Renders widget decorations at a specific position.
 * This is where SolidJS shines - we just render the JSX components directly!
 */
function WidgetsAt(props: { decorations: DecorationSet; pos: number; side?: 'before' | 'after' }): JSX.Element {
  const widgets = () => {
    const all = props.decorations.findWidgetsAt(props.pos)
    // Filter by side if specified
    if (props.side === 'before') {
      return all.filter((w) => (w.spec.side ?? 0) < 0)
    }
    if (props.side === 'after') {
      return all.filter((w) => (w.spec.side ?? 0) >= 0)
    }
    return all
  }

  return (
    <For each={widgets()}>
      {(widget) => (
        <span class="solid-editor-widget" data-widget-key={widget.spec.key} contentEditable={false}>
          {widget.widget()}
        </span>
      )}
    </For>
  )
}

/**
 * Get node decoration for a specific node position.
 */
function getNodeDecoration(
  decorations: DecorationSet | undefined,
  from: number,
  to: number,
): NodeDecoration | undefined {
  if (!decorations) return undefined
  return decorations.findNodeAt(from, to)
}

/**
 * Merge attributes from a node decoration into element props.
 */
function withNodeDecorationAttrs(baseClass: string, nodeDec: NodeDecoration | undefined): Record<string, string> {
  const attrs: Record<string, string> = { class: baseClass }
  if (nodeDec?.attrs) {
    // Merge class names
    if (nodeDec.attrs.class) {
      attrs.class = `${baseClass} ${nodeDec.attrs.class}`
    }
    // Copy other attributes
    for (const [key, value] of Object.entries(nodeDec.attrs)) {
      if (key !== 'class') {
        attrs[key] = value
      }
    }
  }
  return attrs
}

/**
 * Component for rendering a document node
 */
export function NodeView(props: NodeViewProps): JSX.Element {
  // Check for custom node view
  const typeName = props.node.type.name
  const customView = props.nodeViews?.[typeName]
  if (customView) {
    return customView(props)
  }

  // Default rendering based on node type
  // Use plain JS switch instead of <Switch>/<Match> to avoid recreation
  // when props.node changes but type stays the same.
  // Node type never changes for a given node instance, so this is safe.
  switch (typeName) {
    case 'doc':
      return <DocView {...props} />
    case 'paragraph':
      return <ParagraphView {...props} />
    case 'heading':
      return <HeadingView {...props} />
    case 'blockquote':
      return <BlockquoteView {...props} />
    case 'code_block':
      return <CodeBlockView {...props} />
    case 'horizontal_rule':
      return <HorizontalRuleView {...props} />
    case 'hard_break':
      return <HardBreakView {...props} />
    case 'bullet_list':
      return <BulletListView {...props} />
    case 'ordered_list':
      return <OrderedListView {...props} />
    case 'list_item':
      return <ListItemView {...props} />
    default:
      if (props.node.isLeaf) {
        return <LeafNodeView {...props} />
      }
      return <DefaultNodeView {...props} />
  }
}

/**
 * Renders children of a block node, including widget decorations between nodes.
 */
function BlockChildren(props: {
  node: PMNode
  startPos: number
  nodeViews?: NodeViewMap
  decorations?: DecorationSet
  selection?: Selection
  onSelectNode?: (from: number, to: number) => void
}): JSX.Element {
  const getChildren = () => {
    const children: { node: PMNode; pos: number; endPos: number }[] = []
    const pos = props.startPos
    props.node.forEach((child, offset) => {
      const nodeStart = pos + offset
      const nodeEnd = nodeStart + child.nodeSize
      children.push({ node: child, pos: nodeStart, endPos: nodeEnd })
    })
    return children
  }

  return (
    <>
      {/* Widgets at the start of the block (before first child) */}
      <Show when={props.decorations}>
        <WidgetsAt decorations={props.decorations!} pos={props.startPos} side="before" />
      </Show>

      <Index each={getChildren()}>
        {(item) => (
          <>
            {/* Widgets before this node (if any, with side < 0) */}
            <Show when={props.decorations}>
              <WidgetsAt decorations={props.decorations!} pos={item().pos} side="before" />
            </Show>

            {/* The node itself */}
            <NodeView
              node={item().node}
              pos={item().pos}
              nodeViews={props.nodeViews}
              decorations={props.decorations}
              selection={props.selection}
              onSelectNode={props.onSelectNode}
            />

            {/* Widgets after this node (if any, with side >= 0) */}
            <Show when={props.decorations}>
              <WidgetsAt decorations={props.decorations!} pos={item().endPos} side="after" />
            </Show>
          </>
        )}
      </Index>
    </>
  )
}

/**
 * Doc node - the root of the document
 * Note: Unlike other block nodes, doc has no opening token, so content starts at pos 0, not pos + 1
 */
function DocView(props: NodeViewProps): JSX.Element {
  let elementRef: HTMLDivElement | undefined

  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solid-editor-doc', nodeDec())

  // Keep position info updated reactively
  createEffect(() => {
    if (elementRef) {
      setPosInfo(elementRef, { pos: props.pos, node: props.node })
    }
  })

  return (
    <div {...attrs()} ref={(el) => (elementRef = el)}>
      <BlockChildren
        node={props.node}
        startPos={props.pos}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </div>
  )
}

/**
 * Paragraph node
 */
function ParagraphView(props: NodeViewProps): JSX.Element {
  let elementRef: HTMLParagraphElement | undefined

  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solid-editor-paragraph', nodeDec())

  // Get inline decorations for this paragraph's content
  // Note: For block nodes, content starts at pos + 1 (after the opening token)
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
    <p {...attrs()} ref={(el) => (elementRef = el)}>
      {/* Widgets at start of paragraph content */}
      <Show when={props.decorations}>
        <WidgetsAt decorations={props.decorations!} pos={props.pos} side="before" />
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
        // Empty paragraph needs a BR for cursor positioning
        <br />
      )}

      {/* Widgets at end of paragraph content */}
      <Show when={props.decorations}>
        <WidgetsAt decorations={props.decorations!} pos={props.pos + props.node.content.size} side="after" />
      </Show>
    </p>
  )
}

/**
 * Heading node
 */
function HeadingView(props: NodeViewProps): JSX.Element {
  let elementRef: HTMLElement | undefined

  const level = () => (props.node.attrs.level as number) || 1
  const Tag = () => `h${Math.min(6, Math.max(1, level()))}` as keyof JSX.IntrinsicElements

  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const baseClass = () => `solid-editor-heading solid-editor-heading-${level()}`
  const attrs = () => withNodeDecorationAttrs(baseClass(), nodeDec())

  // Get inline decorations for heading content
  // Note: For block nodes, content starts at pos + 1 (after the opening token)
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
    <Dynamic
      component={Tag()}
      {...attrs()}
      ref={(el: HTMLElement) => (elementRef = el)}
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
    </Dynamic>
  )
}

// Dynamic component helper for heading levels
import { Dynamic } from 'solid-js/web'

/**
 * Blockquote node
 */
function BlockquoteView(props: NodeViewProps): JSX.Element {
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solid-editor-blockquote', nodeDec())

  return (
    <blockquote {...attrs()} ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}>
      <BlockChildren
        node={props.node}
        startPos={props.pos + 1}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </blockquote>
  )
}

/**
 * Code block node
 */
function CodeBlockView(props: NodeViewProps): JSX.Element {
  const language = () => props.node.attrs.language as string | undefined

  return (
    <pre
      class="solid-editor-code-block"
      data-language={language()}
      ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}
    >
      <code>{props.node.textContent || '\n'}</code>
    </pre>
  )
}

/**
 * Horizontal rule node
 */
function HorizontalRuleView(props: NodeViewProps): JSX.Element {
  return <hr class="solid-editor-hr" ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })} />
}

/**
 * Hard break node (line break within a paragraph)
 */
function HardBreakView(props: NodeViewProps): JSX.Element {
  return <br class="solid-editor-hard-break" ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })} />
}

/**
 * Bullet list node
 */
function BulletListView(props: NodeViewProps): JSX.Element {
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solid-editor-bullet-list', nodeDec())

  return (
    <ul {...attrs()} ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}>
      <BlockChildren
        node={props.node}
        startPos={props.pos + 1}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </ul>
  )
}

/**
 * Ordered list node
 */
function OrderedListView(props: NodeViewProps): JSX.Element {
  const start = () => (props.node.attrs.order as number) || 1
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => ({
    ...withNodeDecorationAttrs('solid-editor-ordered-list', nodeDec()),
    start: start(),
  })

  return (
    <ol {...attrs()} ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}>
      <BlockChildren
        node={props.node}
        startPos={props.pos + 1}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </ol>
  )
}

/**
 * List item node
 */
function ListItemView(props: NodeViewProps): JSX.Element {
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solid-editor-list-item', nodeDec())

  return (
    <li {...attrs()} ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}>
      <BlockChildren
        node={props.node}
        startPos={props.pos + 1}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </li>
  )
}

/**
 * Leaf node (atom node with no content)
 */
function LeafNodeView(props: NodeViewProps): JSX.Element {
  return (
    <span
      class={`solid-editor-leaf solid-editor-${props.node.type.name}`}
      data-node-type={props.node.type.name}
      ref={(el) => setPosInfo(el, { pos: props.pos, node: props.node })}
    >
      {props.node.type.spec.leafText?.(props.node) || '\u200B'}
    </span>
  )
}

/**
 * Default node view for unhandled node types
 */
function DefaultNodeView(props: NodeViewProps): JSX.Element {
  let elementRef: HTMLElement | undefined

  const isBlock = props.node.isBlock

  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)

  // Get inline decorations for textblock content
  // Note: For block nodes, content starts at pos + 1 (after the opening token)
  const inlineDecorations = () => {
    if (!props.decorations || !props.node.isTextblock) return undefined
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

  if (isBlock) {
    const attrs = () => withNodeDecorationAttrs(`solid-editor-block solid-editor-${props.node.type.name}`, nodeDec())

    return (
      <div {...attrs()} ref={(el) => (elementRef = el)}>
        {props.node.isTextblock ? (
          props.node.content.size > 0 ? (
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
          )
        ) : (
          <BlockChildren
            node={props.node}
            startPos={props.pos + 1}
            nodeViews={props.nodeViews}
            decorations={props.decorations}
            selection={props.selection}
            onSelectNode={props.onSelectNode}
          />
        )}
      </div>
    )
  }

  // Inline node
  const inlineAttrs = () =>
    withNodeDecorationAttrs(`solid-editor-inline solid-editor-${props.node.type.name}`, nodeDec())

  return (
    <span {...inlineAttrs()} ref={(el) => (elementRef = el)}>
      {props.node.isText ? props.node.text : '\u200B'}
    </span>
  )
}
