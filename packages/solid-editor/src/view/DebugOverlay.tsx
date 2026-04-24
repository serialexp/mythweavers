import { For, type JSX, Show, createMemo, createSignal } from 'solid-js'
import type { Node as PMNode } from '../model'
import type { EditorState } from '../state'
import type { Transaction } from '../state'

// ─── Recording types ─────────────────────────────────────────────────────────

/**
 * A serialized transaction — enough to replay the exact operation.
 */
export interface RecordedTransaction {
  kind: 'transaction'
  /** Monotonic index */
  index: number
  /** Timestamp relative to recording start (ms) */
  time: number
  /** Steps as JSON */
  steps: Array<{ stepType: string; [key: string]: unknown }>
  /** Selection after the transaction */
  selection: object
  /** Whether the document changed */
  docChanged: boolean
  /** Whether the selection was explicitly set */
  selectionSet: boolean
  /** Human-readable summary */
  summary: string
}

/**
 * A recorded DOM↔Model selection sync — captures the full roundtrip
 * so position mapping bugs are reproducible.
 */
export interface RecordedSelectionEvent {
  kind: 'selection'
  /** Monotonic index */
  index: number
  /** Timestamp relative to recording start (ms) */
  time: number
  /** What triggered this: 'click', 'selectionchange', or 'sync-to-dom' */
  trigger: string
  /** DOM selection info */
  dom: {
    anchorNodeName: string
    anchorOffset: number
    focusNodeName: string
    focusOffset: number
    anchorText?: string
    focusText?: string
  }
  /** Model position computed from DOM (posFromDOM result) */
  modelFrom: number | null
  /** Model position computed from DOM (posFromDOM result) */
  modelTo: number | null
  /** Previous model selection (before this event) */
  previousModel: { from: number; to: number }
  /** Whether this resulted in a dispatch */
  dispatched: boolean
  /** If domFromPos was called (sync-to-dom), the reverse mapping result */
  reverseMap?: {
    /** Input model position */
    pos: number
    /** Output DOM node name */
    nodeName: string
    /** Output DOM offset */
    offset: number
    /** Text content for context */
    text?: string
  }
  /** Human-readable summary */
  summary: string
}

export type RecordedEvent = RecordedTransaction | RecordedSelectionEvent

/**
 * A full recording: initial state → events → final state.
 * Paste directly into a test fixture.
 */
export interface Recording {
  /** ISO timestamp of when recording started */
  startedAt: string
  /** The state at the start of recording */
  initialState: {
    doc: ReturnType<PMNode['toJSON']>
    selection: object
  }
  /** Every event (transactions + selection syncs) in order */
  events: RecordedEvent[]
  /** The state at the end of recording */
  finalState: {
    doc: ReturnType<PMNode['toJSON']>
    selection: object
    /** The editor's innerHTML at the time recording stopped */
    html?: string
  }
  /** Schema info for reconstructing (node/mark names) */
  schemaInfo: {
    nodes: string[]
    marks: string[]
  }
}

/**
 * Handle to a transaction recorder. Wire `record` into your dispatch path
 * and `recordSelection` into selection change handlers.
 */
export interface TransactionRecorder {
  /** Whether recording is active */
  readonly recording: () => boolean
  /** Start recording. Captures the current state as the baseline. */
  start: (state: EditorState) => void
  /** Record a single transaction. Call from dispatch. */
  record: (tr: Transaction) => void
  /** Record a DOM↔Model selection sync event. */
  recordSelection: (event: Omit<RecordedSelectionEvent, 'kind' | 'index' | 'time'>) => void
  /** Stop recording and return the result. Pass the editor container to capture its HTML. */
  stop: (state: EditorState, container?: HTMLElement) => Recording
  /** All recorded events (reactive) */
  readonly events: () => RecordedEvent[]
  /** Count (reactive, cheap) */
  readonly count: () => number
}

/**
 * Create a transaction recorder.
 */
export function createTransactionRecorder(): TransactionRecorder {
  const [recording, setRecording] = createSignal(false)
  const [events, setEvents] = createSignal<RecordedEvent[]>([])
  let initialState: EditorState | null = null
  let startTime = 0
  let idx = 0

  function summarizeTr(tr: Transaction): string {
    const parts: string[] = []
    if (tr.docChanged) {
      for (const step of tr.steps) {
        const j = step.toJSON()
        parts.push(j.stepType as string)
      }
    }
    if (tr.selectionSet && !tr.docChanged) {
      parts.push(`sel(${tr.selection.from}→${tr.selection.to})`)
    }
    if (!tr.docChanged && !tr.selectionSet) {
      parts.push('meta-only')
    }
    return parts.join(', ')
  }

  return {
    recording,
    events,
    count: () => events().length,

    start(state) {
      initialState = state
      startTime = Date.now()
      idx = 0
      setEvents([])
      setRecording(true)
    },

    record(tr) {
      if (!recording()) return
      const entry: RecordedTransaction = {
        kind: 'transaction',
        index: idx++,
        time: Date.now() - startTime,
        steps: tr.steps.map((s) => s.toJSON()),
        selection: tr.selection.toJSON(),
        docChanged: tr.docChanged,
        selectionSet: tr.selectionSet,
        summary: summarizeTr(tr),
      }
      setEvents((prev) => [...prev, entry])
    },

    recordSelection(partial) {
      if (!recording()) return
      const entry: RecordedSelectionEvent = {
        kind: 'selection',
        index: idx++,
        time: Date.now() - startTime,
        ...partial,
      }
      setEvents((prev) => [...prev, entry])
    },

    stop(state, container?) {
      setRecording(false)
      return {
        startedAt: new Date(startTime).toISOString(),
        initialState: {
          doc: initialState!.doc.toJSON(),
          selection: initialState!.selection.toJSON(),
        },
        events: events(),
        finalState: {
          doc: state.doc.toJSON(),
          selection: state.selection.toJSON(),
          html: container?.innerHTML,
        },
        schemaInfo: {
          nodes: Object.keys(state.schema.nodes),
          marks: Object.keys(state.schema.marks),
        },
      }
    },
  }
}

// ─── Node tree helpers ───────────────────────────────────────────────────────

interface NodeInfo {
  type: string
  id: string
  pos: number
  endPos: number
  nodeSize: number
  contentSize: number
  text?: string
  fullText?: string
  children?: NodeInfo[]
}

function buildNodeTree(node: PMNode, startPos: number): NodeInfo {
  const info: NodeInfo = {
    type: node.type.name,
    id: node.id,
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
    node.content.forEach((child, offset) => {
      const childPos = node.type.name === 'doc' ? offset : startPos + 1 + offset
      info.children!.push(buildNodeTree(child, childPos))
    })
  }

  return info
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NodeTreeView(props: {
  node: NodeInfo
  selection: { from: number; to: number }
  depth?: number
}): JSX.Element {
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

  const textWithCursor = () => {
    if (!props.node.text) return null
    const { from, to } = props.selection
    const isCollapsed = from === to
    const fullText = props.node.fullText || props.node.text

    if (isCollapsed && from >= props.node.pos && from <= props.node.endPos) {
      const cursorOffset = from - props.node.pos
      const before = fullText.slice(0, cursorOffset)
      const after = fullText.slice(cursorOffset)
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

    if (!isCollapsed && from < props.node.endPos && to > props.node.pos) {
      const startOffset = Math.max(0, from - props.node.pos)
      const endOffset = Math.min(props.node.nodeSize, to - props.node.pos)
      const before = fullText.slice(0, startOffset)
      const selected = fullText.slice(startOffset, endOffset)
      const after = fullText.slice(endOffset)
      const displayBefore = before.length > 10 ? `...${before.slice(-7)}` : before
      const displaySelected =
        selected.length > 20 ? `${selected.slice(0, 8)}...${selected.slice(-8)}` : selected
      const displayAfter = after.length > 10 ? `${after.slice(0, 7)}...` : after
      return (
        <>
          <span style={{ color: '#059669' }}>"{displayBefore}</span>
          <span style={{ color: '#059669', background: '#bfdbfe' }}>{displaySelected}</span>
          <span style={{ color: '#059669' }}>{displayAfter}"</span>
        </>
      )
    }

    return <span style={{ color: '#059669' }}>"{props.node.text}"</span>
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
        <span style={{ color: '#d97706', 'font-size': '8px' }} title={props.node.id}>
          #{props.node.id.slice(0, 4)}
        </span>
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

function EventList(props: { events: RecordedEvent[] }): JSX.Element {
  const [expanded, setExpanded] = createSignal<Set<number>>(new Set())

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const eventDetail = (evt: RecordedEvent) => {
    if (evt.kind === 'transaction') {
      return { steps: evt.steps, selection: evt.selection }
    }
    const sel = evt as RecordedSelectionEvent
    return {
      trigger: sel.trigger,
      dom: sel.dom,
      modelFrom: sel.modelFrom,
      modelTo: sel.modelTo,
      previousModel: sel.previousModel,
      dispatched: sel.dispatched,
      ...(sel.reverseMap ? { reverseMap: sel.reverseMap } : {}),
    }
  }

  return (
    <div style={{ 'font-family': 'monospace', 'font-size': '9px' }}>
      <For each={props.events}>
        {(evt) => (
          <div style={{ 'border-bottom': '1px solid #e5e7eb', padding: '3px 0' }}>
            <div
              style={{ cursor: 'pointer', display: 'flex', gap: '4px', 'align-items': 'baseline' }}
              onClick={() => toggle(evt.index)}
            >
              <span style={{ color: '#9ca3af', 'min-width': '16px' }}>
                {expanded().has(evt.index) ? '\u25BE' : '\u25B8'}
              </span>
              <span
                style={{
                  color: evt.kind === 'selection' ? '#d97706' : '#6b7280',
                  'font-size': '8px',
                  'min-width': '20px',
                }}
              >
                {evt.kind === 'selection' ? 'SEL' : 'TR'}
              </span>
              <span style={{ color: '#3b82f6', 'font-weight': '500' }}>{evt.summary}</span>
              <span style={{ color: '#9ca3af', 'margin-left': 'auto', 'white-space': 'nowrap' }}>
                +{evt.time}ms
              </span>
            </div>
            <Show when={expanded().has(evt.index)}>
              <pre
                style={{
                  'font-size': '8px',
                  background: '#1f2937',
                  color: '#e5e7eb',
                  padding: '6px',
                  'border-radius': '3px',
                  'margin-top': '3px',
                  'margin-left': '20px',
                  overflow: 'auto',
                  'white-space': 'pre-wrap',
                  'word-break': 'break-all',
                }}
              >
                {JSON.stringify(eventDetail(evt), null, 2)}
              </pre>
            </Show>
          </div>
        )}
      </For>
      <Show when={props.events.length === 0}>
        <div style={{ color: '#9ca3af', 'font-style': 'italic', padding: '8px 0' }}>
          No events yet. Click or type in the editor...
        </div>
      </Show>
    </div>
  )
}

// ─── Inline styles ───────────────────────────────────────────────────────────

const tabBtn = (active: boolean, accent?: string): JSX.CSSProperties => ({
  flex: '1',
  padding: '2px 6px',
  'font-size': '9px',
  'font-weight': '500',
  border: '1px solid #d1d5db',
  'border-radius': '3px',
  background: active ? (accent ?? '#3b82f6') : 'white',
  color: active ? 'white' : '#374151',
  cursor: 'pointer',
})

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DebugOverlayProps {
  state: EditorState
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
  /** Pass a recorder to enable transaction recording.
   *  Create one with `createTransactionRecorder()` and wire
   *  `recorder.record(tr)` into your dispatch path. */
  recorder?: TransactionRecorder
}

// ─── Main component ──────────────────────────────────────────────────────────

export function DebugOverlay(props: DebugOverlayProps): JSX.Element {
  const [collapsed, setCollapsed] = createSignal(false)
  const [tab, setTab] = createSignal<'tree' | 'json' | 'record'>('tree')
  const [copied, setCopied] = createSignal(false)
  const [lastRecording, setLastRecording] = createSignal<Recording | null>(null)

  const recorder = () => props.recorder
  const isRecording = () => recorder()?.recording() ?? false

  const position = props.position ?? 'bottom-right'

  const positionStyles = (): JSX.CSSProperties => {
    const base: JSX.CSSProperties = {
      position: 'absolute',
      'z-index': '1000',
      'max-width': 'min(400px, calc(100% - 8px))',
      'max-height': 'calc(100% - 8px)',
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

  const debugJson = createMemo(() =>
    JSON.stringify(
      {
        selection: { from: selection().from, to: selection().to, isCollapsed: selection().from === selection().to },
        document: nodeTree(),
      },
      null,
      2,
    ),
  )

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  let overlayRef: HTMLDivElement | undefined

  /** Find the editor's contenteditable container.
   *  The overlay is a sibling of the contenteditable div (not a descendant),
   *  so we walk up to our parent and then search its children. */
  const findEditorContainer = (): HTMLElement | undefined => {
    const parent = overlayRef?.parentElement
    if (!parent) return undefined
    // Check siblings first (most common case — overlay is next to the editor)
    for (const child of parent.children) {
      if (child instanceof HTMLElement && child.contentEditable === 'true') return child
    }
    // Fall back to a deeper search within the parent
    return parent.querySelector<HTMLElement>('[contenteditable="true"]') ?? undefined
  }

  const handleRecord = () => {
    const rec = recorder()
    if (!rec) return
    if (rec.recording()) {
      const result = rec.stop(props.state, findEditorContainer())
      setLastRecording(result)
    } else {
      setLastRecording(null)
      rec.start(props.state)
      setTab('record')
    }
  }

  const downloadRecording = () => {
    const rec = lastRecording()
    if (!rec) return
    const json = JSON.stringify(rec, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      ref={overlayRef}
      class="solidjs-editor-debug-overlay"
      style={{
        ...positionStyles(),
        background: 'white',
        border: `1px solid ${isRecording() ? '#ef4444' : '#d1d5db'}`,
        'border-radius': '6px',
        'box-shadow': '0 2px 4px rgb(0 0 0 / 0.1)',
        'font-family': 'system-ui, sans-serif',
        'font-size': '10px',
        overflow: 'hidden',
        display: 'flex',
        'flex-direction': 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '4px 8px',
          background: isRecording() ? '#fef2f2' : '#f3f4f6',
          'border-bottom': '1px solid #e5e7eb',
          gap: '6px',
        }}
      >
        <span
          style={{ 'font-weight': '600', 'font-size': '10px', color: '#374151', cursor: 'pointer', flex: '1' }}
          onClick={() => setCollapsed(!collapsed())}
        >
          {collapsed() ? '▸' : '▾'} Debug
        </span>
        <Show when={recorder()}>
          <button
            style={{
              padding: '1px 8px',
              'font-size': '9px',
              'font-weight': '600',
              border: 'none',
              'border-radius': '3px',
              background: isRecording() ? '#ef4444' : '#10b981',
              color: 'white',
              cursor: 'pointer',
            }}
            onClick={handleRecord}
          >
            {isRecording() ? `\u25A0 Stop (${recorder()!.count()})` : '\u25CF Record'}
          </button>
        </Show>
      </div>

      <Show when={!collapsed()}>
        <div style={{ padding: '8px', overflow: 'auto', flex: '1', 'min-height': '0' }}>
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

          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: '4px', 'margin-bottom': '8px' }}>
            <button style={tabBtn(tab() === 'tree')} onClick={() => setTab('tree')}>
              Tree
            </button>
            <button style={tabBtn(tab() === 'json')} onClick={() => setTab('json')}>
              JSON
            </button>
            <Show when={recorder()}>
              <button
                style={tabBtn(tab() === 'record', isRecording() ? '#ef4444' : undefined)}
                onClick={() => setTab('record')}
              >
                Record{isRecording() ? ` (${recorder()!.count()})` : ''}
              </button>
            </Show>
          </div>

          {/* Tree tab */}
          <Show when={tab() === 'tree'}>
            <div style={{ background: '#f9fafb', 'border-radius': '3px', padding: '6px', overflow: 'auto' }}>
              <NodeTreeView node={nodeTree()} selection={selection()} />
            </div>
          </Show>

          {/* JSON tab */}
          <Show when={tab() === 'json'}>
            <div style={{ display: 'flex', 'justify-content': 'flex-end', 'margin-bottom': '4px' }}>
              <button style={tabBtn(copied())} onClick={() => copyText(debugJson())}>
                {copied() ? '\u2713 Copied' : 'Copy'}
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

          {/* Record tab */}
          <Show when={tab() === 'record'}>
            <Show when={isRecording()}>
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  background: '#fef2f2',
                  'border-radius': '3px',
                  'margin-bottom': '8px',
                  color: '#991b1b',
                  'font-weight': '500',
                }}
              >
                <span style={{ color: '#ef4444' }}>●</span>
                Recording... {recorder()!.count()} transactions
              </div>
            </Show>

            <Show when={lastRecording()}>
              <div style={{ display: 'flex', gap: '4px', 'margin-bottom': '8px' }}>
                <button style={tabBtn(false)} onClick={() => copyText(JSON.stringify(lastRecording(), null, 2))}>
                  {copied() ? '\u2713 Copied' : 'Copy JSON'}
                </button>
                <button style={tabBtn(false)} onClick={downloadRecording}>
                  Download
                </button>
              </div>
              <div
                style={{
                  padding: '4px 8px',
                  background: '#f0fdf4',
                  'border-radius': '3px',
                  'margin-bottom': '8px',
                  color: '#166534',
                  'font-size': '9px',
                }}
              >
                Recorded {lastRecording()!.events.length} events
              </div>
            </Show>

            <EventList
              events={isRecording() ? recorder()!.events() : (lastRecording()?.events ?? [])}
            />
          </Show>
        </div>
      </Show>
    </div>
  )
}
