import { For, type JSX, Show, createMemo, createSignal } from 'solid-js'
import type { Node as PMNode } from '../model'
import type { EditorState } from '../state'

export interface DebugOverlayProps {
  state: EditorState
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
}

interface NodeInfo {
  type: string
  pos: number
  endPos: number
  nodeSize: number
  contentSize: number
  text?: string
  fullText?: string // Full text for cursor positioning
  children?: NodeInfo[]
}

function buildNodeTree(node: PMNode, startPos: number): NodeInfo {
  const info: NodeInfo = {
    type: node.type.name,
    pos: startPos,
    endPos: startPos + node.nodeSize,
    nodeSize: node.nodeSize,
    contentSize: node.content.size,
  }

  if (node.isText) {
    info.fullText = node.text
    info.text = node.text?.slice(0, 30) + (node.text && node.text.length > 30 ? '...' : '')
  }

  if (node.content.size > 0 && !node.isText) {
    info.children = []
    let _pos = startPos + 1 // +1 for opening token of block nodes, or just startPos for doc
    if (node.type.name === 'doc') {
      _pos = startPos // doc has no opening token in position model
    }
    node.content.forEach((child, offset) => {
      const childPos = node.type.name === 'doc' ? offset : startPos + 1 + offset
      info.children!.push(buildNodeTree(child, childPos))
    })
  }

  return info
}

function NodeTreeView(props: { node: NodeInfo; selection: { from: number; to: number }; depth?: number }): JSX.Element {
  const depth = props.depth ?? 0
  const indent = depth * 12

  const isInSelection = () => {
    const { from, to } = props.selection
    return props.node.pos < to && props.node.endPos > from
  }

  const containsCursor = () => {
    const { from, to } = props.selection
    return from === to && props.node.pos <= from && props.node.endPos > from
  }

  // For text nodes, show the cursor position with a | character
  const textWithCursor = () => {
    if (!props.node.text) return null
    const { from, to } = props.selection
    const isCollapsed = from === to
    const fullText = props.node.fullText || props.node.text
    const displayText = props.node.text

    // Check if cursor is within this text node
    if (isCollapsed && from >= props.node.pos && from <= props.node.endPos) {
      const cursorOffset = from - props.node.pos
      const before = fullText.slice(0, cursorOffset)
      const after = fullText.slice(cursorOffset)
      // Truncate display if too long
      const displayBefore = before.length > 20 ? `...${before.slice(-17)}` : before
      const displayAfter = after.length > 20 ? `${after.slice(0, 17)}...` : after
      return (
        <>
          <span style={{ color: '#059669' }}>"{displayBefore}</span>
          <span style={{ color: '#ef4444', 'font-weight': 'bold' }}>|</span>
          <span style={{ color: '#059669' }}>{displayAfter}"</span>
        </>
      )
    }

    // Check if there's a range selection within this text node
    if (!isCollapsed && from < props.node.endPos && to > props.node.pos) {
      const startOffset = Math.max(0, from - props.node.pos)
      const endOffset = Math.min(props.node.nodeSize, to - props.node.pos)
      const before = fullText.slice(0, startOffset)
      const selected = fullText.slice(startOffset, endOffset)
      const after = fullText.slice(endOffset)
      // Truncate display if too long
      const displayBefore = before.length > 10 ? `...${before.slice(-7)}` : before
      const displaySelected = selected.length > 20 ? `${selected.slice(0, 8)}...${selected.slice(-8)}` : selected
      const displayAfter = after.length > 10 ? `${after.slice(0, 7)}...` : after
      return (
        <>
          <span style={{ color: '#059669' }}>"{displayBefore}</span>
          <span style={{ color: '#059669', background: '#bfdbfe' }}>{displaySelected}</span>
          <span style={{ color: '#059669' }}>{displayAfter}"</span>
        </>
      )
    }

    return <span style={{ color: '#059669' }}>"{displayText}"</span>
  }

  return (
    <div style={{ 'margin-left': `${indent}px` }}>
      <div
        style={{
          'font-family': 'monospace',
          'font-size': '9px',
          padding: '1px 3px',
          background: containsCursor() ? '#fef08a' : isInSelection() ? '#dbeafe' : 'transparent',
          'border-radius': '2px',
          'line-height': '1.4',
        }}
      >
        <span style={{ color: '#7c3aed', 'font-weight': 'bold' }}>{props.node.type}</span>
        <span style={{ color: '#6b7280' }}>
          @{props.node.pos}-{props.node.endPos}
        </span>
        <span style={{ color: '#9ca3af' }}>({props.node.nodeSize})</span>
        <Show when={props.node.text}> {textWithCursor()}</Show>
      </div>
      <Show when={props.node.children}>
        <For each={props.node.children}>
          {(child) => <NodeTreeView node={child} selection={props.selection} depth={depth + 1} />}
        </For>
      </Show>
    </div>
  )
}

export function DebugOverlay(props: DebugOverlayProps): JSX.Element {
  const [collapsed, setCollapsed] = createSignal(false)
  const [showJson, setShowJson] = createSignal(false)
  const [copied, setCopied] = createSignal(false)

  const position = props.position ?? 'bottom-right'

  const positionStyles = (): JSX.CSSProperties => {
    const base: JSX.CSSProperties = {
      position: 'absolute',
      'z-index': '1000',
      'max-width': '350px',
      'max-height': '40vh',
    }
    switch (position) {
      case 'top-right':
        return { ...base, top: '4px', right: '4px' }
      case 'top-left':
        return { ...base, top: '4px', left: '4px' }
      case 'bottom-left':
        return { ...base, bottom: '4px', left: '4px' }
      default:
        return { ...base, bottom: '4px', right: '4px' }
    }
  }

  const selection = createMemo(() => ({
    from: props.state.selection.from,
    to: props.state.selection.to,
  }))

  const nodeTree = createMemo(() => buildNodeTree(props.state.doc, 0))

  const debugJson = createMemo(() => {
    const sel = selection()
    return JSON.stringify(
      {
        selection: {
          from: sel.from,
          to: sel.to,
          isCollapsed: sel.from === sel.to,
        },
        document: nodeTree(),
      },
      null,
      2,
    )
  })

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(debugJson())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  return (
    <div
      style={{
        ...positionStyles(),
        background: 'white',
        border: '1px solid #d1d5db',
        'border-radius': '6px',
        'box-shadow': '0 2px 4px rgb(0 0 0 / 0.1)',
        'font-family': 'system-ui, sans-serif',
        'font-size': '10px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '4px 8px',
          background: '#f3f4f6',
          'border-bottom': '1px solid #e5e7eb',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed())}
      >
        <span style={{ 'font-weight': '600', 'font-size': '10px', color: '#374151' }}>🔍 Debug</span>
        <span style={{ color: '#9ca3af', 'font-size': '10px' }}>{collapsed() ? '▸' : '▾'}</span>
      </div>

      <Show when={!collapsed()}>
        <div style={{ padding: '8px', overflow: 'auto', 'max-height': 'calc(40vh - 30px)' }}>
          {/* Selection Info */}
          <div style={{ 'margin-bottom': '8px' }}>
            <div
              style={{
                'font-family': 'monospace',
                'font-size': '11px',
                padding: '4px 6px',
                background: '#f3f4f6',
                'border-radius': '3px',
              }}
            >
              <Show
                when={selection().from === selection().to}
                fallback={
                  <span>
                    sel: <strong>{selection().from}</strong>→<strong>{selection().to}</strong>
                    <span style={{ color: '#6b7280' }}> ({selection().to - selection().from})</span>
                  </span>
                }
              >
                <span>
                  pos: <strong>{selection().from}</strong>
                </span>
              </Show>
            </div>
          </div>

          {/* Toggle buttons */}
          <div style={{ display: 'flex', gap: '4px', 'margin-bottom': '8px' }}>
            <button
              style={{
                flex: 1,
                padding: '2px 6px',
                'font-size': '9px',
                'font-weight': '500',
                border: '1px solid #d1d5db',
                'border-radius': '3px',
                background: !showJson() ? '#3b82f6' : 'white',
                color: !showJson() ? 'white' : '#374151',
                cursor: 'pointer',
              }}
              onClick={() => setShowJson(false)}
            >
              Tree
            </button>
            <button
              style={{
                flex: 1,
                padding: '2px 6px',
                'font-size': '9px',
                'font-weight': '500',
                border: '1px solid #d1d5db',
                'border-radius': '3px',
                background: showJson() ? '#3b82f6' : 'white',
                color: showJson() ? 'white' : '#374151',
                cursor: 'pointer',
              }}
              onClick={() => setShowJson(true)}
            >
              JSON
            </button>
          </div>

          {/* Tree View */}
          <Show when={!showJson()}>
            <div
              style={{
                background: '#f9fafb',
                'border-radius': '3px',
                padding: '6px',
                overflow: 'auto',
              }}
            >
              <NodeTreeView node={nodeTree()} selection={selection()} />
            </div>
          </Show>

          {/* JSON View */}
          <Show when={showJson()}>
            <div style={{ display: 'flex', 'justify-content': 'flex-end', 'margin-bottom': '4px' }}>
              <button
                style={{
                  padding: '2px 6px',
                  'font-size': '9px',
                  border: '1px solid #d1d5db',
                  'border-radius': '3px',
                  background: copied() ? '#10b981' : 'white',
                  color: copied() ? 'white' : '#374151',
                  cursor: 'pointer',
                }}
                onClick={copyJson}
              >
                {copied() ? '✓' : 'Copy'}
              </button>
            </div>
            <pre
              style={{
                'font-family': 'monospace',
                'font-size': '9px',
                background: '#1f2937',
                color: '#e5e7eb',
                padding: '8px',
                'border-radius': '3px',
                overflow: 'auto',
                'white-space': 'pre-wrap',
                'word-break': 'break-all',
                margin: 0,
              }}
            >
              {debugJson()}
            </pre>
          </Show>
        </div>
      </Show>
    </div>
  )
}
