import { createSignal } from 'solid-js'
import { getApiBaseUrl } from '../client/config'
import { errorStore } from '../stores/errorStore'
import { emit } from '../stores/storeEvents'

let socket: WebSocket | null = null
let currentStoryId: string | null = null
let reconnectAttempts = 0
let hasConnectedOnce = false
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_BASE = 1000
const RECONNECT_DELAY_MAX = 30000

const [isConnected, setIsConnected] = createSignal(false)

/** Build the WebSocket URL from the HTTP API base URL. */
function getWsUrl(): string {
  const base = getApiBaseUrl()
  const url = new URL(base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws'
  return url.toString()
}

export const websocketManager = {
  isConnected,

  connect(storyId: string) {
    // If already connected to this story, do nothing
    if (socket && currentStoryId === storyId && isConnected()) {
      return
    }

    // Disconnect from previous story if connected
    if (socket && currentStoryId !== storyId) {
      this.disconnect()
    }

    currentStoryId = storyId
    reconnectAttempts = 0

    const wsUrl = getWsUrl()
    socket = new WebSocket(wsUrl)

    socket.addEventListener('open', () => {
      setIsConnected(true)
      hasConnectedOnce = true
      reconnectAttempts = 0

      // Join the story room
      socket!.send(JSON.stringify({ type: 'join-story', storyId }))
    })

    socket.addEventListener('close', () => {
      setIsConnected(false)
      this.attemptReconnect()
    })

    socket.addEventListener('error', () => {
      // Error events are followed by a close event, reconnect happens there
    })

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleEvent(data)
      } catch {
        // Ignore malformed messages
      }
    })
  },

  disconnect() {
    if (socket) {
      if (currentStoryId) {
        try {
          socket.send(JSON.stringify({ type: 'leave-story', storyId: currentStoryId }))
        } catch {
          // Socket may already be closed
        }
      }

      socket.close()
      socket = null
      currentStoryId = null
      setIsConnected(false)
    }
  },

  attemptReconnect() {
    // If we've never connected and exceeded max attempts, stop trying
    if (!hasConnectedOnce && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      errorStore.addError('Unable to connect to sync server. Changes from MCP will not be reflected in real-time.')
      return
    }

    reconnectAttempts++

    const delay = Math.min(RECONNECT_DELAY_BASE * 2 ** (reconnectAttempts - 1), RECONNECT_DELAY_MAX)

    setTimeout(() => {
      if (currentStoryId && !isConnected()) {
        this.connect(currentStoryId)
      }
    }, delay)
  },

  handleEvent(data: any) {
    const { type } = data
    switch (type) {
      case 'message:updated':
        emit('ws:message-updated', { storyId: data.storyId, message: data.message })
        break
      case 'message:created':
        emit('ws:message-created', {
          storyId: data.storyId,
          message: data.message,
          afterMessageId: data.afterMessageId,
        })
        break
      case 'message:deleted':
        emit('ws:message-deleted', { storyId: data.storyId, messageId: data.messageId })
        break
      case 'node:created':
        emit('ws:node-created', { storyId: data.storyId, node: data.node })
        break
      case 'node:updated':
        emit('ws:node-updated', { storyId: data.storyId, node: data.node })
        break
      case 'node:deleted':
        emit('ws:node-deleted', { storyId: data.storyId, nodeId: data.nodeId })
        break
      case 'story:reloaded':
        emit('ws:story-reloaded', { storyId: data.storyId })
        break
      case 'pong':
        // Keepalive response, nothing to do
        break
    }
  },
}
