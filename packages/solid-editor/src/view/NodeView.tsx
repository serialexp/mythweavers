import { For, type JSX, Show } from 'solid-js'
import type { Node as PMNode } from '../model'
import { KeyedFor } from './KeyedFor'
import { InlineContent } from './TextView'
import { DecorationSet, type NodeDecoration } from './decoration'
import { registerNodeId } from './selection'

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
export function WidgetsAt(props: { decorations: DecorationSet; pos: number; side?: 'before' | 'after' }): JSX.Element {
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
        <span class="solidjs-editor-widget" data-widget-key={widget.spec.key} data-widget="" contentEditable={false}>
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
    case 'table':
      return <TableFallbackView {...props} />
    case 'table_row':
      return <TableRowFallbackView {...props} />
    case 'table_cell':
      return <TableCellFallbackView {...props} />
    case 'table_header':
      return <TableHeaderFallbackView {...props} />
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
  // Collect child nodes for rendering. Each node has a unique `id` that
  // persists across content edits, so KeyedFor reconciles by identity —
  // insertions/removals create/destroy the right DOM nodes, while
  // in-place edits (typing, mark changes) update the existing subtree.
  const getChildren = () => {
    const children: PMNode[] = []
    props.node.forEach((child) => {
      children.push(child)
    })
    return children
  }

  // Compute the start position for a child at a given index.
  // We derive this from startPos + the cumulative nodeSize of preceding siblings.
  const childPos = (index: number): number => {
    let pos = props.startPos
    for (let i = 0; i < index; i++) {
      pos += props.node.child(i).nodeSize
    }
    return pos
  }

  return (
    <>
      {/* Widgets at the start of the block (before first child) */}
      <Show when={props.decorations}>
        <WidgetsAt decorations={props.decorations!} pos={props.startPos} side="before" />
      </Show>

      <KeyedFor each={getChildren()} by={(node) => node.id}>
        {(child, index) => {
          const pos = () => childPos(index())
          const endPos = () => pos() + child().nodeSize
          return (
            <>
              {/* Widgets before this node (if any, with side < 0) */}
              <Show when={props.decorations}>
                <WidgetsAt decorations={props.decorations!} pos={pos()} side="before" />
              </Show>

              {/* The node itself */}
              <NodeView
                node={child()}
                pos={pos()}
                nodeViews={props.nodeViews}
                decorations={props.decorations}
                selection={props.selection}
                onSelectNode={props.onSelectNode}
              />

              {/* Widgets after this node (if any, with side >= 0) */}
              <Show when={props.decorations}>
                <WidgetsAt decorations={props.decorations!} pos={endPos()} side="after" />
              </Show>
            </>
          )
        }}
      </KeyedFor>
    </>
  )
}

/**
 * Doc node - the root of the document
 * Note: Unlike other block nodes, doc has no opening token, so content starts at pos 0, not pos + 1
 */
function DocView(props: NodeViewProps): JSX.Element {
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solidjs-editor-doc', nodeDec())

  return (
    <div {...attrs()} ref={(el) => registerNodeId(el, props.node.id)}>
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
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solidjs-editor-paragraph', nodeDec())

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

  return (
    <p {...attrs()} ref={(el) => registerNodeId(el, props.node.id)}>
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
        // Empty paragraph needs a BR for cursor positioning
        <br />
      )}

      {/* Widgets at end of paragraph content (position before closing tag) */}
      <Show when={props.decorations}>
        <WidgetsAt decorations={props.decorations!} pos={props.pos + 1 + props.node.content.size} side="after" />
      </Show>
    </p>
  )
}

/**
 * Heading node
 */
function HeadingView(props: NodeViewProps): JSX.Element {
  const level = () => (props.node.attrs.level as number) || 1
  const Tag = () => `h${Math.min(6, Math.max(1, level()))}` as keyof JSX.IntrinsicElements

  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const baseClass = () => `solidjs-editor-heading solidjs-editor-heading-${level()}`
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

  return (
    <Dynamic
      component={Tag()}
      {...attrs()}
      ref={(el: HTMLElement) => registerNodeId(el, props.node.id)}
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
  const attrs = () => withNodeDecorationAttrs('solidjs-editor-blockquote', nodeDec())

  return (
    <blockquote {...attrs()} ref={(el) => registerNodeId(el, props.node.id)}>
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
      class="solidjs-editor-code-block"
      data-language={language()}
      ref={(el) => registerNodeId(el, props.node.id)}
    >
      <code>{props.node.textContent || '\n'}</code>
    </pre>
  )
}

/**
 * Horizontal rule node
 */
function HorizontalRuleView(props: NodeViewProps): JSX.Element {
  return <hr class="solidjs-editor-hr" ref={(el) => registerNodeId(el, props.node.id)} />
}

/**
 * Hard break node (line break within a paragraph)
 */
function HardBreakView(props: NodeViewProps): JSX.Element {
  return <br class="solidjs-editor-hard-break" ref={(el) => registerNodeId(el, props.node.id)} />
}

/**
 * Bullet list node
 */
function BulletListView(props: NodeViewProps): JSX.Element {
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const attrs = () => withNodeDecorationAttrs('solidjs-editor-bullet-list', nodeDec())

  return (
    <ul {...attrs()} ref={(el) => registerNodeId(el, props.node.id)}>
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
    ...withNodeDecorationAttrs('solidjs-editor-ordered-list', nodeDec()),
    start: start(),
  })

  return (
    <ol {...attrs()} ref={(el) => registerNodeId(el, props.node.id)}>
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
  const attrs = () => withNodeDecorationAttrs('solidjs-editor-list-item', nodeDec())

  return (
    <li {...attrs()} ref={(el) => registerNodeId(el, props.node.id)}>
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
      class={`solidjs-editor-leaf solidjs-editor-${props.node.type.name}`}
      data-node-type={props.node.type.name}
      ref={(el) => registerNodeId(el, props.node.id)}
    >
      {props.node.type.spec.leafText?.(props.node) || '\u200B'}
    </span>
  )
}

/**
 * Default node view for unhandled node types
 */
function DefaultNodeView(props: NodeViewProps): JSX.Element {
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

  if (isBlock) {
    const attrs = () => withNodeDecorationAttrs(`solidjs-editor-block solidjs-editor-${props.node.type.name}`, nodeDec())

    return (
      <div {...attrs()} ref={(el) => registerNodeId(el, props.node.id)}>
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
    withNodeDecorationAttrs(`solidjs-editor-inline solidjs-editor-${props.node.type.name}`, nodeDec())

  return (
    <span {...inlineAttrs()} ref={(el) => registerNodeId(el, props.node.id)}>
      {props.node.isText ? props.node.text : '\u200B'}
    </span>
  )
}

/**
 * Fallback table views for when no custom node views are registered.
 * These provide basic table rendering using standard HTML table elements.
 * For full table editing support, use tableNodeViews() from src/tables.
 */
function TableFallbackView(props: NodeViewProps): JSX.Element {
  return (
    <div class="solidjs-editor-table-wrapper" ref={(el) => registerNodeId(el, props.node.id)}>
      <table class="solidjs-editor-table">
        <tbody>
          <BlockChildren
            node={props.node}
            startPos={props.pos + 1}
            nodeViews={props.nodeViews}
            decorations={props.decorations}
            selection={props.selection}
            onSelectNode={props.onSelectNode}
          />
        </tbody>
      </table>
    </div>
  )
}

function TableRowFallbackView(props: NodeViewProps): JSX.Element {
  return (
    <tr class="solidjs-editor-table-row" ref={(el) => registerNodeId(el, props.node.id)}>
      <BlockChildren
        node={props.node}
        startPos={props.pos + 1}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </tr>
  )
}

function TableCellFallbackView(props: NodeViewProps): JSX.Element {
  const colspan = () => (props.node.attrs.colspan as number) || 1
  const rowspan = () => (props.node.attrs.rowspan as number) || 1

  return (
    <td
      class="solidjs-editor-table-cell"
      colspan={colspan() > 1 ? colspan() : undefined}
      rowspan={rowspan() > 1 ? rowspan() : undefined}
      ref={(el) => registerNodeId(el, props.node.id)}
    >
      <BlockChildren
        node={props.node}
        startPos={props.pos + 1}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </td>
  )
}

function TableHeaderFallbackView(props: NodeViewProps): JSX.Element {
  const colspan = () => (props.node.attrs.colspan as number) || 1
  const rowspan = () => (props.node.attrs.rowspan as number) || 1

  return (
    <th
      class="solidjs-editor-table-header"
      colspan={colspan() > 1 ? colspan() : undefined}
      rowspan={rowspan() > 1 ? rowspan() : undefined}
      ref={(el) => registerNodeId(el, props.node.id)}
    >
      <BlockChildren
        node={props.node}
        startPos={props.pos + 1}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </th>
  )
}
