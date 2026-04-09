import { Button } from '@mythweavers/ui'
import { Component, For, Show, createSignal } from 'solid-js'
import { settingsStore } from '../stores/settingsStore'
import { LLMClientFactory } from '../utils/llm/LLMClientFactory'
import { resolveModel } from '../utils/llm/resolveModel'
import type { LLMMessage } from '../types/llm'
import * as styles from './QuickLlmDialog.css'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export const QuickLlmDialog: Component = () => {
  const [messages, setMessages] = createSignal<ChatMessage[]>([])
  const [input, setInput] = createSignal('')
  const [isGenerating, setIsGenerating] = createSignal(false)
  const [streamingContent, setStreamingContent] = createSignal('')
  let messagesEndRef: HTMLDivElement | undefined
  let textareaRef: HTMLTextAreaElement | undefined

  function scrollToBottom() {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' })
  }

  function autoResizeTextarea() {
    if (textareaRef) {
      textareaRef.style.height = 'auto'
      textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 120)}px`
    }
  }

  async function handleSend() {
    const text = input().trim()
    if (!text || isGenerating()) return

    if (!settingsStore.model || !settingsStore.provider) {
      return
    }

    const userMessage: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages(), userMessage]
    setMessages(updatedMessages)
    setInput('')
    setStreamingContent('')
    setIsGenerating(true)

    // Reset textarea height
    if (textareaRef) {
      textareaRef.style.height = 'auto'
    }

    // Scroll to show user message
    requestAnimationFrame(scrollToBottom)

    try {
      const resolved = resolveModel('utility')
      const client = LLMClientFactory.getClient(resolved.provider)

      // Build LLM messages from conversation history
      const llmMessages: LLMMessage[] = updatedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      let accumulated = ''
      let doneThinking = false

      const response = client.generate({
        model: resolved.model,
        messages: llmMessages,
        max_tokens: settingsStore.maxTokens,
        thinking_budget: settingsStore.thinkingBudget
          ? Math.min(
              settingsStore.thinkingBudget,
              Math.floor(settingsStore.maxTokens / 2),
            )
          : undefined,
        metadata: { callType: 'utility' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
          if (accumulated.includes('</think>')) {
            doneThinking = true
          }
          if (doneThinking || !accumulated.includes('<think>')) {
            const display = accumulated
              .replace(/<think>[\s\S]*?<\/think>/g, '')
              .trim()
            if (display) {
              setStreamingContent(display)
              requestAnimationFrame(scrollToBottom)
            }
          }
        }
      }

      const cleaned = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim()

      if (cleaned) {
        setMessages([...updatedMessages, { role: 'assistant', content: cleaned }])
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate response'
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: `Error: ${message}` },
      ])
      console.error('Quick LLM error:', err)
    } finally {
      setIsGenerating(false)
      setStreamingContent('')
      requestAnimationFrame(scrollToBottom)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleClear() {
    setMessages([])
    setStreamingContent('')
  }

  const resolvedModelLabel = () => {
    try {
      const resolved = resolveModel('utility')
      return `${resolved.provider}/${resolved.model}`
    } catch {
      return ''
    }
  }

  return (
    <div class={styles.container}>
      <div class={styles.messages}>
        <Show
          when={messages().length > 0 || isGenerating()}
          fallback={
            <div class={styles.emptyState}>
              <div class={styles.emptyStateIcon}>💬</div>
              <div>Ask the LLM anything.</div>
              <div style={{ 'font-size': '0.8rem' }}>
                Uses the meta model. Conversation resets when closed.
              </div>
            </div>
          }
        >
          <For each={messages()}>
            {(msg) => (
              <div
                class={
                  msg.role === 'user'
                    ? styles.userBubble
                    : styles.assistantBubble
                }
              >
                {msg.content}
              </div>
            )}
          </For>
          <Show when={isGenerating()}>
            <div class={styles.assistantBubble}>
              <Show
                when={streamingContent()}
                fallback={
                  <div class={styles.streamingDots}>
                    <div class={styles.streamingDot} />
                    <div class={styles.streamingDot} />
                    <div class={styles.streamingDot} />
                  </div>
                }
              >
                {streamingContent()}
              </Show>
            </div>
          </Show>
        </Show>
        <div ref={messagesEndRef} />
      </div>

      <Show when={messages().length > 0}>
        <div class={styles.footerRow}>
          <span class={styles.modelLabel}>{resolvedModelLabel()}</span>
          <button
            class={styles.clearButton}
            onClick={handleClear}
            disabled={isGenerating()}
          >
            Clear conversation
          </button>
        </div>
      </Show>

      <div class={styles.inputArea}>
        <textarea
          ref={textareaRef}
          class={styles.textInput}
          value={input()}
          onInput={(e) => {
            setInput(e.currentTarget.value)
            autoResizeTextarea()
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            settingsStore.model
              ? 'Ask something... (Enter to send, Shift+Enter for newline)'
              : 'Configure an AI provider first'
          }
          disabled={!settingsStore.model || isGenerating()}
          rows={1}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={!input().trim() || !settingsStore.model || isGenerating()}
        >
          Send
        </Button>
      </div>
    </div>
  )
}
