import { createStore } from 'solid-js/store'

export type GenerationPhase = 'streaming' | 'refining'

interface GenerationState {
  /** Id of the message currently being generated, or null when idle */
  messageId: string | null
  /** Raw accumulated text as received from the provider (not yet committed to the message) */
  text: string
  /** Word count of `text`, recomputed on every flush */
  wordCount: number
  /** Epoch ms when generation started, or null when idle */
  startedAt: number | null
  phase: GenerationPhase
}

const initialState: GenerationState = {
  messageId: null,
  text: '',
  wordCount: 0,
  startedAt: null,
  phase: 'streaming',
}

const [state, setState] = createStore<GenerationState>({ ...initialState })

const countWords = (text: string): number => {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Holds the in-flight generation for a single message.
 *
 * Streamed text lives here instead of in messagesStore so that the editor is never
 * fed partial content: messagesStore (and therefore the editor) is only updated once
 * the turn is complete or aborted. The UI renders a progress panel from this store
 * while a message is streaming.
 */
export const generationStore = {
  state,

  start: (messageId: string) => {
    setState({
      messageId,
      text: '',
      wordCount: 0,
      startedAt: Date.now(),
      phase: 'streaming',
    })
  },

  /** Replace the streamed text (callers pass the full accumulated text) */
  setText: (text: string) => {
    setState({ text, wordCount: countWords(text) })
  },

  setPhase: (phase: GenerationPhase) => {
    setState('phase', phase)
  },

  end: () => {
    setState({ ...initialState })
  },

  isStreaming: (messageId: string) => state.messageId === messageId,

  /** Streamed text for a message, or null when that message is not currently streaming */
  textFor: (messageId: string): string | null => (state.messageId === messageId ? state.text : null),
}
