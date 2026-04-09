import { createSignal } from 'solid-js'
import { getApiBaseUrl } from '../client/config'
import { errorStore } from '../stores/errorStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import type { Message, Node } from '../types/core'

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
        this.handleMessageUpdated(data)
        break
      case 'message:created':
        this.handleMessageCreated(data)
        break
      case 'message:deleted':
        this.handleMessageDeleted(data)
        break
      case 'node:created':
        this.handleNodeCreated(data)
        break
      case 'node:updated':
        this.handleNodeUpdated(data)
        break
      case 'node:deleted':
        this.handleNodeDeleted(data)
        break
      case 'story:reloaded':
        this.handleStoryReloaded(data)
        break
      case 'pong':
        // Keepalive response, nothing to do
        break
    }
  },

  handleMessageUpdated(data: { storyId: string; message: any }) {
    if (data.storyId !== currentStoryId) return

    const message: Message = {
      ...data.message,
      timestamp: new Date(data.message.timestamp),
      sceneId: data.message.sceneId,
    }

    const currentMessage = messagesStore.messages.find((m) => m.id === message.id)
    if (currentMessage && messagesStore.isLoading) {
      errorStore.addError(`Message ${message.id} was updated from MCP but local edit takes priority`)
      return
    }

    messagesStore.updateMessageNoSave(message.id, message)
    if (message.paragraphs) {
      messagesStore.bumpContentVersion(message.id)
    }
  },

  handleMessageCreated(data: { storyId: string; message: any; afterMessageId: string | null }) {
    if (data.storyId !== currentStoryId) return

    const message: Message = {
      ...data.message,
      timestamp: new Date(data.message.timestamp),
      sceneId: data.message.sceneId,
    }

    messagesStore.insertMessageNoSave(data.afterMessageId, message)
  },

  handleMessageDeleted(data: { storyId: string; messageId: string }) {
    if (data.storyId !== currentStoryId) return
    messagesStore.deleteMessageNoSave(data.messageId)
  },

  handleNodeCreated(data: { storyId: string; node: unknown }) {
    if (data.storyId !== currentStoryId || !data.node) return
    nodeStore.upsertNodeFromServer(data.node as Node)
  },

  handleNodeUpdated(data: { storyId: string; node: unknown }) {
    if (data.storyId !== currentStoryId || !data.node) return
    nodeStore.upsertNodeFromServer(data.node as Node)
  },

  handleNodeDeleted(data: { storyId: string; nodeId: string }) {
    if (data.storyId !== currentStoryId || !data.nodeId) return
    nodeStore.deleteNodeNoSave(data.nodeId)
  },

  handleStoryReloaded(data: { storyId: string }) {
    if (data.storyId !== currentStoryId) return
    errorStore.addError('Story has been significantly modified from MCP. Reloading...')
    messagesStore.reloadDataForStory(data.storyId)
  },
}
