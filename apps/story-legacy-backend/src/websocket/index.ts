import { Server as HTTPServer } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { type StoryEvent, isRedisEventBusEnabled, publishStoryEvent, subscribeToStoryEvents } from '../lib/eventBus'
import { createLogger } from '../lib/logger'

const log = createLogger('websocket')
let io: SocketIOServer | null = null

export function initializeWebSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Allow all origins in development
      methods: ['GET', 'POST'],
    },
  })

  // Add middleware to log all incoming events
  io.use((socket, next) => {
    const originalEmit = socket.emit
    socket.emit = (...args: any[]) => {
      if (args[0] !== 'error') {
        log.debug(
          {
            socketId: socket.id,
            event: args[0],
            direction: 'outgoing',
          },
          'Socket event',
        )
      }
      return originalEmit.apply(socket, args as any)
    }
    next()
  })

  io.on('connection', (socket) => {
    log.info(
      {
        socketId: socket.id,
        ip: socket.handshake.address,
        query: socket.handshake.query,
        headers: {
          'user-agent': socket.handshake.headers['user-agent'],
          origin: socket.handshake.headers.origin,
        },
      },
      'Client connected',
    )

    // Log all incoming events generically
    socket.onAny((eventName, ...args) => {
      log.debug(
        {
          socketId: socket.id,
          event: eventName,
          direction: 'incoming',
          argsCount: args.length,
        },
        'Socket event received',
      )
    })

    // Join a room for a specific story
    socket.on('join-story', (storyId: string) => {
      socket.join(`story:${storyId}`)
      log.info({ socketId: socket.id, storyId }, 'Client joined story room')
    })

    // Leave a story room
    socket.on('leave-story', (storyId: string) => {
      socket.leave(`story:${storyId}`)
      log.info({ socketId: socket.id, storyId }, 'Client left story room')
    })

    socket.on('disconnect', (reason) => {
      log.info({ socketId: socket.id, reason }, 'Client disconnected')
    })

    socket.on('error', (error) => {
      log.error({ socketId: socket.id, error }, 'WebSocket error')
    })
  })

  subscribeToStoryEvents((event: StoryEvent) => {
    log.info(
      {
        eventType: event.type,
        storyId: event.storyId,
        hasPayload: !!event.payload,
      },
      'Received story event from event bus',
    )
    emitToStory(event.storyId, event.type, event.payload)
  })

  if (!isRedisEventBusEnabled()) {
    log.info('Redis URL not configured; WebSocket updates will only work within the current backend process')
  }

  log.info('WebSocket server initialized')
}

export function getIO(): SocketIOServer | null {
  return io
}

// Helper function to emit events to a specific story room
export function emitToStory(storyId: string, event: string, data: any) {
  if (!io) {
    log.warn('Cannot emit event - WebSocket server not initialized')
    return
  }

  const room = `story:${storyId}`
  const sockets = io.sockets.adapter.rooms.get(room)
  const clientCount = sockets ? sockets.size : 0

  log.info({ event, storyId, room, clientCount }, `Emitting ${event} to story room (${clientCount} clients)`)
  io.to(room).emit(event, data)
}

// Emit message updated event
export function emitMessageUpdated(storyId: string, message: any) {
  void publishStoryEvent({
    type: 'message:updated',
    storyId,
    payload: {
      storyId,
      message,
    },
  })
}

// Await version for CLI use - ensures event is published before returning
export async function emitMessageUpdatedAwait(storyId: string, message: any) {
  await publishStoryEvent({
    type: 'message:updated',
    storyId,
    payload: {
      storyId,
      message,
    },
  })
}

// Emit message created event
export function emitMessageCreated(storyId: string, message: any, afterMessageId: string | null) {
  void publishStoryEvent({
    type: 'message:created',
    storyId,
    payload: {
      storyId,
      message,
      afterMessageId,
    },
  })
}

// Await version for CLI use - ensures event is published before returning
export async function emitMessageCreatedAwait(storyId: string, message: any, afterMessageId: string | null) {
  await publishStoryEvent({
    type: 'message:created',
    storyId,
    payload: {
      storyId,
      message,
      afterMessageId,
    },
  })
}

// Emit message deleted event
export function emitMessageDeleted(storyId: string, messageId: string) {
  void publishStoryEvent({
    type: 'message:deleted',
    storyId,
    payload: {
      storyId,
      messageId,
    },
  })
}

// Await version for CLI use - ensures event is published before returning
export async function emitMessageDeletedAwait(storyId: string, messageId: string) {
  await publishStoryEvent({
    type: 'message:deleted',
    storyId,
    payload: {
      storyId,
      messageId,
    },
  })
}

// Emit node created event
export function emitNodeCreated(storyId: string, node: any) {
  void publishStoryEvent({
    type: 'node:created',
    storyId,
    payload: {
      storyId,
      node,
    },
  })
}

// Emit node updated event
export function emitNodeUpdated(storyId: string, node: any) {
  void publishStoryEvent({
    type: 'node:updated',
    storyId,
    payload: {
      storyId,
      node,
    },
  })
}

// Emit node deleted event
export function emitNodeDeleted(storyId: string, nodeId: string) {
  void publishStoryEvent({
    type: 'node:deleted',
    storyId,
    payload: {
      storyId,
      nodeId,
    },
  })
}

// Emit story reloaded event (for major changes)
export function emitStoryReloaded(storyId: string) {
  void publishStoryEvent({
    type: 'story:reloaded',
    storyId,
    payload: {
      storyId,
    },
  })
}
