/**
 * SolidJS table view components.
 *
 * Unlike ProseMirror's imperative TableView class (with dom/contentDOM/update),
 * these are plain SolidJS components that render reactively.
 */

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { Node as PMNode } from '../model'
import type { Selection } from '../state'
import { KeyedFor } from '../view/KeyedFor'
import type { NodeViewProps, NodeViewMap } from '../view/NodeView'
import { NodeView } from '../view/NodeView'
import { DecorationSet, type NodeDecoration } from '../view/decoration'
import { InlineContent } from '../view/TextView'
import { registerNodeId } from '../view/selection'
import { WidgetsAt } from '../view/NodeView'

/**
 * Table node view. Renders a <table> wrapped in a scrollable container.
 */
export function TableNodeView(props: NodeViewProps): JSX.Element {
  return (
    <div class="solidjs-editor-table-wrapper" ref={(el) => registerNodeId(el, props.node.id)}>
      <table class="solidjs-editor-table">
        <tbody>
          <TableBlockChildren
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

/**
 * Table row node view. Renders a <tr>.
 */
export function TableRowView(props: NodeViewProps): JSX.Element {
  return (
    <tr class="solidjs-editor-table-row" ref={(el) => registerNodeId(el, props.node.id)}>
      <TableBlockChildren
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

/**
 * Table cell node view. Renders a <td> with colspan/rowspan attributes.
 * The cell content is rendered as block children (paragraphs, etc).
 */
export function TableCellView(props: NodeViewProps): JSX.Element {
  const colspan = () => (props.node.attrs.colspan as number) || 1
  const rowspan = () => (props.node.attrs.rowspan as number) || 1
  const colwidth = () => props.node.attrs.colwidth as number[] | null

  // Compute width style from colwidth attribute
  const style = (): JSX.CSSProperties | undefined => {
    const cw = colwidth()
    if (!cw) return undefined
    const totalWidth = cw.reduce((sum, w) => sum + (w || 0), 0)
    if (totalWidth === 0) return undefined
    return { 'min-width': `${totalWidth}px` }
  }

  // Check if this cell has a selectedCell decoration
  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const cellClass = () => {
    let cls = 'solidjs-editor-table-cell'
    if (nodeDec()?.attrs?.class) {
      cls += ` ${nodeDec()!.attrs!.class}`
    }
    return cls
  }

  return (
    <td
      class={cellClass()}
      colspan={colspan() > 1 ? colspan() : undefined}
      rowspan={rowspan() > 1 ? rowspan() : undefined}
      style={style()}
      ref={(el) => registerNodeId(el, props.node.id)}
    >
      <CellContent
        node={props.node}
        pos={props.pos}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </td>
  )
}

/**
 * Table header cell node view. Renders a <th> with colspan/rowspan attributes.
 */
export function TableHeaderView(props: NodeViewProps): JSX.Element {
  const colspan = () => (props.node.attrs.colspan as number) || 1
  const rowspan = () => (props.node.attrs.rowspan as number) || 1
  const colwidth = () => props.node.attrs.colwidth as number[] | null

  const style = (): JSX.CSSProperties | undefined => {
    const cw = colwidth()
    if (!cw) return undefined
    const totalWidth = cw.reduce((sum, w) => sum + (w || 0), 0)
    if (totalWidth === 0) return undefined
    return { 'min-width': `${totalWidth}px` }
  }

  const nodeDec = () => getNodeDecoration(props.decorations, props.pos, props.pos + props.node.nodeSize)
  const cellClass = () => {
    let cls = 'solidjs-editor-table-header'
    if (nodeDec()?.attrs?.class) {
      cls += ` ${nodeDec()!.attrs!.class}`
    }
    return cls
  }

  return (
    <th
      class={cellClass()}
      colspan={colspan() > 1 ? colspan() : undefined}
      rowspan={rowspan() > 1 ? rowspan() : undefined}
      style={style()}
      ref={(el) => registerNodeId(el, props.node.id)}
    >
      <CellContent
        node={props.node}
        pos={props.pos}
        nodeViews={props.nodeViews}
        decorations={props.decorations}
        selection={props.selection}
        onSelectNode={props.onSelectNode}
      />
    </th>
  )
}

/**
 * Renders cell content. Cells contain block content (typically paragraphs).
 */
function CellContent(props: {
  node: PMNode
  pos: number
  nodeViews?: NodeViewMap
  decorations?: DecorationSet
  selection?: Selection
  onSelectNode?: (from: number, to: number) => void
}): JSX.Element {
  return (
    <TableBlockChildren
      node={props.node}
      startPos={props.pos + 1}
      nodeViews={props.nodeViews}
      decorations={props.decorations}
      selection={props.selection}
      onSelectNode={props.onSelectNode}
    />
  )
}

/**
 * Block children renderer for table nodes.
 * Similar to the BlockChildren in NodeView.tsx but extracted here
 * to avoid circular dependencies with table-specific rendering.
 */
function TableBlockChildren(props: {
  node: PMNode
  startPos: number
  nodeViews?: NodeViewMap
  decorations?: DecorationSet
  selection?: Selection
  onSelectNode?: (from: number, to: number) => void
}): JSX.Element {
  const getChildren = () => {
    const children: PMNode[] = []
    props.node.forEach((child) => {
      children.push(child)
    })
    return children
  }

  const childPos = (index: number): number => {
    let pos = props.startPos
    for (let i = 0; i < index; i++) {
      pos += props.node.child(i).nodeSize
    }
    return pos
  }

  return (
    <>
      <Show when={props.decorations}>
        <WidgetsAt decorations={props.decorations!} pos={props.startPos} side="before" />
      </Show>

      <KeyedFor each={getChildren()} by={(node) => node.id}>
        {(child, index) => {
          const pos = () => childPos(index())
          const endPos = () => pos() + child().nodeSize
          return (
            <>
              <Show when={props.decorations}>
                <WidgetsAt decorations={props.decorations!} pos={pos()} side="before" />
              </Show>

              <NodeView
                node={child()}
                pos={pos()}
                nodeViews={props.nodeViews}
                decorations={props.decorations}
                selection={props.selection}
                onSelectNode={props.onSelectNode}
              />

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
 * Returns a NodeViewMap with the default table views registered.
 * Merge this with your own nodeViews when creating the editor.
 */
export function tableNodeViews(): Record<string, (props: NodeViewProps) => JSX.Element> {
  return {
    table: TableNodeView,
    table_row: TableRowView,
    table_cell: TableCellView,
    table_header: TableHeaderView,
  }
}
